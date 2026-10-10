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
    for funded in
      select distinct f.financed_transaction_id
        from public.funding_events f
       where f.household_id=p_household_id
         and f.funding_transaction_id=payment_tx
    loop
      perform public.reconcile_member_settlements(funded.financed_transaction_id);
    end loop;
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
