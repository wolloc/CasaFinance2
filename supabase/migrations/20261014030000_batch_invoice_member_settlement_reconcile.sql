-- Batch invoice-payment projection reconciliation to avoid repeated expensive view scans.
-- P0 homologation fix: direct and recurring expenses were hitting the authenticated
-- role's statement_timeout while recalculating projected member settlements.
--
-- Preserve the exact financial semantics and event model. The only change is query
-- shape: materialize the relevant responsibility/funding rows once per source
-- transaction instead of reopening the same complex read models once per
-- commitment/member scalar subquery.

create or replace function public.reconcile_member_settlements(p_transaction_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare tx public.transactions; c record; fe record; debtor uuid; creditor uuid; effect numeric; tx_total numeric;
begin
 select * into tx from public.transactions where id=p_transaction_id and deleted_at is null;
 if tx.id is null or tx.type<>'expense' then return; end if;
 update public.member_settlement_events set state='cancelled',updated_at=now()
  where source_transaction_id=tx.id and state='projected' and kind='responsibility_funding';
 if tx.economic_state in ('cancelled','reversed') then return; end if;
 tx_total:=public.financial_effective_total_amount(tx.economic_state,tx.estimated_amount,tx.confirmed_amount,tx.realized_amount,tx.amount);

 -- Keep the canonical realized-funding semantics: validate the actual funder and
 -- source account; split account funding only for exactly two active owners;
 -- and do not realize an installment obligation until the installment is fully
 -- funded. The final funding event realizes the existing installment settlement.
 for fe in select f.* from public.funding_events f where f.financed_transaction_id=tx.id loop
  if not exists(select 1 from public.household_members where id=fe.funder_member_id and household_id=tx.household_id and deactivated_at is null)
     or not exists(select 1 from public.accounts where id=fe.source_account_id and household_id=tx.household_id and deactivated_at is null) then
   raise exception 'funding member and source account must be active in household' using errcode='23514';
  end if;

  funded_total:=fe.amount;
  if fe.installment_id is not null then
   select i.amount,coalesce(sum(f.amount),0) into effect,funded_total
     from public.installments i left join public.funding_events f on f.installment_id=i.id
    where i.id=fe.installment_id group by i.amount;
   if funded_total<effect then continue; end if;
   if fe.id<>(select f.id from public.funding_events f where f.installment_id=fe.installment_id order by f.created_at desc,f.id desc fetch first 1 row only) then continue; end if;
  end if;

  with funding_sources as (
   select f.* from public.funding_events f
    where (fe.installment_id is null and f.id=fe.id)
       or (fe.installment_id is not null and f.installment_id=fe.installment_id)
  ), owner_counts as (
   select fs.id funding_id,count(om.id) owner_count
     from funding_sources fs
     left join public.account_ownerships ao on ao.account_id=fs.source_account_id and ao.household_id=tx.household_id
     left join public.household_members om on om.id=ao.member_id and om.household_id=tx.household_id and om.deactivated_at is null
    group by fs.id
  ), funders as (
   select ao.member_id,sum(fs.amount/2) funding_amount
     from funding_sources fs join owner_counts oc on oc.funding_id=fs.id and oc.owner_count=2
     join public.account_ownerships ao on ao.account_id=fs.source_account_id and ao.household_id=tx.household_id
     join public.household_members om on om.id=ao.member_id and om.household_id=tx.household_id and om.deactivated_at is null
    group by ao.member_id
   union all
   select fs.funder_member_id,sum(fs.amount) funding_amount
     from funding_sources fs join owner_counts oc on oc.funding_id=fs.id and oc.owner_count<>2
    group by fs.funder_member_id
  ), balances as (
   select m.id member_id,coalesce(sum(f.funding_amount),0)-coalesce(sum(a.amount)*funded_total/tx_total,0) balance
   from public.household_members m left join funders f on f.member_id=m.id
   left join public.economic_allocations a on a.transaction_id=tx.id and a.responsible_member_id=m.id
   where m.household_id=tx.household_id and m.deactivated_at is null
   group by m.id
  ) select (array_agg(member_id order by balance,member_id) filter(where balance<0))[1],
           (array_agg(member_id order by balance desc,member_id) filter(where balance>0))[1],
           round(least(abs(min(balance) filter(where balance<0)),max(balance) filter(where balance>0)),2)
      into debtor,creditor,effect from balances;

  if fe.installment_id is not null then
   update public.member_settlement_events set state='cancelled',updated_at=now()
    where source_installment_id=fe.installment_id and kind='responsibility_funding' and state='projected'
      and (debtor is null or creditor is null or effect<=0 or debtor_member_id<>debtor or creditor_member_id<>creditor);
  end if;
  if debtor is not null and creditor is not null and effect>0 then
   if fe.installment_id is not null and exists(select 1 from public.member_settlement_events where source_installment_id=fe.installment_id and debtor_member_id=debtor and creditor_member_id=creditor) then
    update public.member_settlement_events set state='realized',amount=effect,occurred_at=fe.funded_at,source_funding_event_id=fe.id,updated_at=now()
     where source_installment_id=fe.installment_id and debtor_member_id=debtor and creditor_member_id=creditor and state='projected';
   else
    insert into public.member_settlement_events(household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,occurred_at,source_transaction_id,source_funding_event_id)
    values(tx.household_id,tx.created_by_member_id,debtor,creditor,effect,'realized','responsibility_funding',fe.funded_at::date,fe.funded_at,tx.id,fe.id)
    on conflict(source_funding_event_id,debtor_member_id,creditor_member_id) where source_funding_event_id is not null do nothing;
   end if;
  end if;
 end loop;

 if current_setting('casa_finance.defer_member_settlement_projection',true) is distinct from 'on' then
 for c in
  with responsibility_rows as materialized (
   select commitment_key,source_installment_id,financial_date,member_id,remaining_responsibility_amount
   from public.financial_member_commitment_responsibility_positions
   where household_id=tx.household_id and source_transaction_id=tx.id
  ), commitments as (
   select distinct commitment_key,source_installment_id,financial_date
   from responsibility_rows
  ), responsibility as (
   select commitment_key,member_id,sum(remaining_responsibility_amount) amount
   from responsibility_rows
   where member_id is not null
   group by commitment_key,member_id
  ), funding as materialized (
   select commitment_key,member_id,sum(amount) amount
   from public.financial_member_funding_positions
   where household_id=tx.household_id
     and source_transaction_id=tx.id
     and member_id is not null
     and funding_state='projected'
   group by commitment_key,member_id
  ), member_balances as (
   select base.commitment_key,base.source_installment_id,base.financial_date,m.id member_id,
    coalesce(f.amount,0)-coalesce(r.amount,0) balance
   from commitments base
   cross join public.household_members m
   left join responsibility r on r.commitment_key=base.commitment_key and r.member_id=m.id
   left join funding f on f.commitment_key=base.commitment_key and f.member_id=m.id
   where m.household_id=tx.household_id and m.deactivated_at is null
  )
  select commitment_key,source_installment_id,financial_date,
    (array_agg(member_id order by balance,member_id) filter(where balance<0))[1] debtor,
    (array_agg(member_id order by balance desc,member_id) filter(where balance>0))[1] creditor,
    round(least(abs(min(balance) filter(where balance<0)),max(balance) filter(where balance>0)),2) effect
   from member_balances
   group by commitment_key,source_installment_id,financial_date
 loop
  debtor:=c.debtor;creditor:=c.creditor;effect:=c.effect;
  if debtor is not null and creditor is not null and effect>0 then
   insert into public.member_settlement_events(household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,source_transaction_id,source_installment_id)
   values(tx.household_id,tx.created_by_member_id,debtor,creditor,effect,'projected','responsibility_funding',c.financial_date,tx.id,c.source_installment_id);
  end if;
 end loop;
 end if;
end $$;
revoke all on function public.reconcile_member_settlements(uuid) from public,anon,authenticated;


create or replace function public.reconcile_member_settlements_for_invoice_payment(p_payment_transaction_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_household_id uuid;
begin
 select household_id into v_household_id from public.transactions
 where id=p_payment_transaction_id and type='invoice_payment' and deleted_at is null;
 if v_household_id is null then raise exception 'invoice payment transaction not found' using errcode='23503'; end if;

 update public.member_settlement_events e set state='cancelled',updated_at=now()
 where e.state='projected' and e.kind='responsibility_funding'
 and e.source_transaction_id in (
   select distinct t.id
   from public.funding_events f
   join public.transactions t on t.id=f.financed_transaction_id
   where f.household_id=v_household_id
     and f.funding_transaction_id=p_payment_transaction_id
     and t.household_id=v_household_id
     and t.deleted_at is null
     and t.type='expense'
 );

 with affected as materialized (
   select distinct f.financed_transaction_id transaction_id from public.funding_events f
   where f.household_id=v_household_id and f.funding_transaction_id=p_payment_transaction_id
 ), eligible as materialized (
   select t.id transaction_id,t.household_id,t.created_by_member_id
   from public.transactions t join affected a on a.transaction_id=t.id
   where t.deleted_at is null and t.type='expense' and t.economic_state not in ('cancelled','reversed')
 ), responsibility_rows as materialized (
   select v.household_id,v.source_transaction_id transaction_id,v.commitment_key,
          v.source_installment_id,v.financial_date,v.member_id,v.remaining_responsibility_amount
   from public.financial_member_commitment_responsibility_positions v
   join eligible e on e.transaction_id=v.source_transaction_id
   where v.household_id=v_household_id
 ), commitments as (
   select distinct transaction_id,commitment_key,source_installment_id,financial_date from responsibility_rows
 ), responsibility as (
   select transaction_id,commitment_key,member_id,sum(remaining_responsibility_amount) amount
   from responsibility_rows where member_id is not null group by transaction_id,commitment_key,member_id
 ), funding as materialized (
   select v.source_transaction_id transaction_id,v.commitment_key,v.member_id,sum(v.amount) amount
   from public.financial_member_funding_positions v join eligible e on e.transaction_id=v.source_transaction_id
   where v.household_id=v_household_id and v.member_id is not null and v.funding_state='projected'
   group by v.source_transaction_id,v.commitment_key,v.member_id
 ), balances as (
   select c.transaction_id,c.commitment_key,c.source_installment_id,c.financial_date,m.id member_id,
          coalesce(f.amount,0)-coalesce(r.amount,0) balance
   from commitments c join eligible e on e.transaction_id=c.transaction_id
   join public.household_members m on m.household_id=e.household_id and m.deactivated_at is null
   left join responsibility r on r.transaction_id=c.transaction_id and r.commitment_key=c.commitment_key and r.member_id=m.id
   left join funding f on f.transaction_id=c.transaction_id and f.commitment_key=c.commitment_key and f.member_id=m.id
 ), settlements as (
   select transaction_id,source_installment_id,financial_date,
     (array_agg(member_id order by balance,member_id) filter(where balance<0))[1] debtor,
     (array_agg(member_id order by balance desc,member_id) filter(where balance>0))[1] creditor,
     round(least(abs(min(balance) filter(where balance<0)),max(balance) filter(where balance>0)),2) amount
   from balances group by transaction_id,commitment_key,source_installment_id,financial_date
 )
 insert into public.member_settlement_events(
   household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,source_transaction_id,source_installment_id
 )
 select e.household_id,e.created_by_member_id,s.debtor,s.creditor,s.amount,'projected','responsibility_funding',s.financial_date,s.transaction_id,s.source_installment_id
 from settlements s join eligible e on e.transaction_id=s.transaction_id
 where s.debtor is not null and s.creditor is not null and s.amount>0;
end $$;
revoke all on function public.reconcile_member_settlements_for_invoice_payment(uuid) from public,anon,authenticated;

-- Prevent repeated full member-settlement reconciliation for every funding row
-- created by one card-invoice payment. Keep all financial writes atomic, then
-- reconcile each affected purchase once after the complete payment allocation.
create or replace function public.pay_card_invoice(
  p_household_id uuid,
  p_invoice_id uuid,
  p_source_account_id uuid,
  p_funder_member_id uuid,
  p_amount numeric,
  p_paid_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  inv public.card_invoices;
  payment_tx uuid;
  movement uuid;
  purchase record;
  funded record;
  allocation numeric;
  remaining numeric;
  previous_defer_setting text;
  previous_projection_defer_setting text;
begin
  caller:=public.require_active_member(p_household_id);

  select * into inv
    from public.card_invoices
   where id=p_invoice_id
     and household_id=p_household_id
     and deleted_at is null
   for update;

  if inv.id is null
     or p_amount<=0
     or inv.settled_amount+inv.opening_settled_amount+p_amount>inv.total_amount
  then
    raise exception 'invalid invoice payment' using errcode='23514';
  end if;

  if not exists(
    select 1
      from public.household_members
     where id=p_funder_member_id
       and household_id=p_household_id
       and deactivated_at is null
  ) then
    raise exception 'funder must be active in household' using errcode='23514';
  end if;

  -- Validate the source account before creating any payment or cash-movement
  -- rows. SECURITY DEFINER must not allow a cross-household or deactivated
  -- account to be recorded as the source of a real invoice payment.
  if not exists(
    select 1
      from public.accounts
     where id=p_source_account_id
       and household_id=p_household_id
       and deactivated_at is null
  ) then
    raise exception 'source account must be active in household' using errcode='23514';
  end if;

  insert into public.transactions(
    household_id,created_by_member_id,type,status,description,amount,
    transaction_date,competence_date,settled_at
  ) values(
    p_household_id,caller.id,'invoice_payment','paid','Pagamento de fatura',
    p_amount,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at
  ) returning id into payment_tx;

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,
    source_account_id,invoice_id,movement_date,competence_date,realized_at
  ) values(
    p_household_id,caller.id,'invoice_payment','realized',p_amount,
    'Pagamento de fatura',p_source_account_id,p_invoice_id,p_paid_at::date,
    date_trunc('month',p_paid_at)::date,p_paid_at
  ) returning id into movement;

  insert into public.card_invoice_payments(
    household_id,invoice_id,payment_transaction_id,source_account_id,amount,paid_at
  ) values(
    p_household_id,p_invoice_id,payment_tx,p_source_account_id,p_amount,p_paid_at
  );

  -- The canonical settlement trigger is expensive because it rebuilds the
  -- responsibility/projection positions for a financed purchase. Defer that
  -- trigger while this payment writes multiple funding rows.
  previous_defer_setting:=current_setting(
    'casa_finance.defer_member_settlement_reconcile',
    true
  );
  perform set_config(
    'casa_finance.defer_member_settlement_reconcile',
    'on',
    true
  );

  remaining:=p_amount;
  for purchase in
    select t.id, null::uuid installment_id, t.amount, t.created_at,
           0::numeric opening_settled_amount
      from public.transactions t
     where t.invoice_id=p_invoice_id
       and t.household_id=p_household_id
       and t.deleted_at is null
    union all
    select t.id, ins.id, ins.amount, t.created_at, ins.opening_settled_amount
      from public.installments ins
      join public.installment_plans ip
        on ip.id=ins.installment_plan_id
       and ip.household_id=p_household_id
      join public.transactions t
        on t.id=ip.purchase_transaction_id
       and t.household_id=p_household_id
       and t.deleted_at is null
     where ins.invoice_id=p_invoice_id
       and ins.household_id=p_household_id
     order by created_at,id,installment_id nulls first
  loop
    allocation:=least(
      remaining,
      purchase.amount-purchase.opening_settled_amount-coalesce((
        select sum(f.amount)
          from public.funding_events f
         where f.invoice_id=p_invoice_id
           and f.financed_transaction_id=purchase.id
           and f.installment_id is not distinct from purchase.installment_id
      ),0)
    );

    if allocation>0 then
      insert into public.funding_events(
        household_id,financed_transaction_id,funding_transaction_id,
        funder_member_id,source_account_id,invoice_id,installment_id,
        amount,funded_at
      ) values(
        p_household_id,purchase.id,payment_tx,p_funder_member_id,
        p_source_account_id,p_invoice_id,purchase.installment_id,
        allocation,p_paid_at
      );
      remaining:=remaining-allocation;
    end if;
    exit when remaining=0;
  end loop;

  perform set_config(
    'casa_finance.defer_member_settlement_reconcile',
    coalesce(previous_defer_setting,'off'),
    true
  );

  if coalesce(previous_defer_setting,'off')<>'on' then
    previous_projection_defer_setting:=current_setting('casa_finance.defer_member_settlement_projection',true);
    perform set_config('casa_finance.defer_member_settlement_projection','on',true);
    for funded in
      select distinct f.financed_transaction_id
        from public.funding_events f
       where f.household_id=p_household_id
         and f.funding_transaction_id=payment_tx
    loop
      perform public.reconcile_member_settlements(funded.financed_transaction_id);
    end loop;
    perform set_config('casa_finance.defer_member_settlement_projection',coalesce(previous_projection_defer_setting,'off'),true);
    if coalesce(previous_projection_defer_setting,'off')<>'on' then
      perform public.reconcile_member_settlements_for_invoice_payment(payment_tx);
    end if;
  end if;

  if remaining<>0 then
    raise exception 'invoice purchases do not support requested funding' using errcode='23514';
  end if;

  update public.card_invoices
     set settled_amount=settled_amount+p_amount,
         status=case
           when settled_amount+opening_settled_amount+p_amount=total_amount then 'paid'
           else status
         end,
         settled_at=case
           when settled_amount+opening_settled_amount+p_amount=total_amount then p_paid_at
           else null
         end,
         updated_at=now()
   where id=p_invoice_id;

  return payment_tx;
end
$$;

comment on function public.pay_card_invoice(uuid,uuid,uuid,uuid,numeric,timestamptz) is
  'Atomically settles a card invoice from a selected account. Defers member-settlement trigger reconciliation while funding rows are allocated, then reconciles each affected purchase once to avoid repeated expensive recalculation/timeouts.';

