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

 -- Each funding event realizes only its own proportional responsibility. The
 -- actual source account determines attribution; invalid ownership is not
 -- silently replaced by the card owner, buyer, creator, or legacy account owner.
 for fe in select f.* from public.funding_events f where f.financed_transaction_id=tx.id loop
  if not exists(select 1 from public.member_settlement_events e where e.source_funding_event_id=fe.id) then
   with responsibility_raw as (
    select ea.responsible_member_id,ea.responsible_party_id,ea.allocation_order,
      floor(round(fe.amount*100)*ea.percentage/100)::bigint base_cents,
      row_number() over(order by ea.allocation_order) allocation_rank
    from public.economic_allocations ea where ea.transaction_id=tx.id
   ), responsibility_cents as (
    select r.*,(round(fe.amount*100)::bigint-sum(base_cents) over())::integer remainder_cents from responsibility_raw r
   ), responsibility as (
    select responsible_member_id member_id,sum((base_cents+case when allocation_rank<=remainder_cents then 1 else 0 end)::numeric/100) amount
    from responsibility_cents where responsible_member_id is not null group by responsible_member_id
   ), member_balances as (
    select m.id member_id,
      coalesce((select sum(x.amount) from (
        select a.member_id,(floor(round(fe.amount*100)/a.owner_count)::bigint+
          case when a.owner_order<=(round(fe.amount*100)::bigint-floor(round(fe.amount*100)/a.owner_count)::bigint*a.owner_count) then 1 else 0 end)::numeric/100 amount
        from public.financial_account_member_allocations a where a.household_id=tx.household_id and a.account_id=fe.source_account_id and a.is_valid
      ) x where x.member_id=m.id),0)
      -coalesce((select r.amount from responsibility r where r.member_id=m.id),0) balance
    from public.household_members m where m.household_id=tx.household_id and m.deactivated_at is null
   ) select (array_agg(member_id order by balance,member_id) filter(where balance<0))[1],
      (array_agg(member_id order by balance desc,member_id) filter(where balance>0))[1],
      round(least(abs(min(balance) filter(where balance<0)),max(balance) filter(where balance>0)),2)
     into debtor,creditor,effect from member_balances;
   if debtor is not null and creditor is not null and effect>0 then
    insert into public.member_settlement_events(household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,occurred_at,source_transaction_id,source_installment_id,source_funding_event_id)
    values(tx.household_id,tx.created_by_member_id,debtor,creditor,effect,'realized','responsibility_funding',fe.funded_at::date,fe.funded_at,tx.id,fe.installment_id,fe.id)
    on conflict(source_funding_event_id,debtor_member_id,creditor_member_id) where source_funding_event_id is not null do nothing;
   end if;
  end if;
 end loop;

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
end $$;
revoke all on function public.reconcile_member_settlements(uuid) from public,anon,authenticated;
