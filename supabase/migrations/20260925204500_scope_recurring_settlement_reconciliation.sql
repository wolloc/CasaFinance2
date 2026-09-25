-- Guardrails after Release 1 monthly recurrence.
--
-- 1) Scope settlement-reconciliation deferral only to recurring occurrence
--    assembly. Refunds/corrections/rescales outside that assembly keep the
--    canonical immediate reconciliation behavior.
-- 2) Preserve installment assembly batching from 202609120072.
--
-- This is intentionally forward-only because 20260925170500 is already in main.

create or replace function public.trigger_reconcile_member_settlements()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  tx_id uuid;
  plan_id uuid;
  expected_count integer;
  actual_count integer;
begin
  if coalesce(
       current_setting('casa_finance.defer_member_settlement_reconcile', true),
       'off'
     )='on'
  then
    return null;
  end if;

  if tg_table_name='economic_allocations' then
    tx_id:=coalesce(new.transaction_id,old.transaction_id);
  elsif tg_table_name='installments' then
    plan_id:=coalesce(new.installment_plan_id,old.installment_plan_id);

    select p.purchase_transaction_id,p.installment_count
      into tx_id,expected_count
      from public.installment_plans p
     where p.id=plan_id;

    if tx_id is null then
      return null;
    end if;

    if tg_op='INSERT' then
      select count(*)::integer
        into actual_count
        from public.installments i
       where i.installment_plan_id=plan_id;

      if actual_count<expected_count then
        return null;
      end if;
    end if;
  else
    tx_id:=coalesce(new.financed_transaction_id,old.financed_transaction_id);
  end if;

  perform public.reconcile_member_settlements(tx_id);
  return null;
end
$$;

revoke all on function public.trigger_reconcile_member_settlements()
from public,anon,authenticated;

create or replace function public.generate_recurring_occurrence(
  p_household_id uuid,
  p_rule_id uuid,
  p_occurrence_date date
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  rule public.recurring_rules;
  template public.transactions;
  instrument public.transaction_payment_instruments;
  card public.cards;
  dates record;
  existing uuid;
  tx uuid;
  key text:=p_occurrence_date::text;
  estimate numeric;
  projected_due date:=p_occurrence_date;
  previous_defer_setting text;
begin
  caller:=public.require_active_member(p_household_id);

  select * into rule
    from public.recurring_rules
   where id=p_rule_id
     and household_id=p_household_id
     and deactivated_at is null
   for update;

  if rule.id is null
     or p_occurrence_date<rule.start_date
     or (rule.end_date is not null and p_occurrence_date>rule.end_date)
  then
    raise exception 'invalid recurring occurrence' using errcode='23514';
  end if;

  select transaction_id into existing
    from public.recurring_occurrences
   where recurring_rule_id=p_rule_id
     and idempotency_key=key;

  if existing is not null then
    return existing;
  end if;

  select * into template
    from public.transactions
   where id=rule.template_transaction_id
     and household_id=p_household_id
     and deleted_at is null;

  if template.id is null then
    raise exception 'active recurring template required' using errcode='23514';
  end if;

  select * into instrument
    from public.transaction_payment_instruments
   where household_id=p_household_id
     and transaction_id=template.id;

  if instrument.transaction_id is null then
    raise exception 'recurring expense template requires a payment instrument'
      using errcode='23514';
  end if;

  if instrument.kind='card' then
    select * into card
      from public.cards
     where id=instrument.card_id
       and household_id=p_household_id;

    if card.id is null then
      raise exception 'recurring card required' using errcode='23514';
    end if;

    select * into dates
      from public.invoice_dates(card,p_occurrence_date);
    projected_due:=dates.due_date;
  elsif instrument.kind='account' then
    projected_due:=public.adjust_projected_business_date(
      p_occurrence_date,
      'next'
    );
  else
    raise exception 'unsupported recurring expense instrument'
      using errcode='0A000';
  end if;

  estimate:=coalesce(
    rule.estimated_amount,
    template.estimated_amount,
    template.amount
  );

  insert into public.transactions(
    household_id,
    created_by_member_id,
    buyer_member_id,
    category_id,
    type,
    status,
    economic_state,
    description,
    amount,
    estimated_amount,
    confirmed_amount,
    realized_amount,
    transaction_date,
    competence_date,
    due_date,
    notes
  ) values(
    p_household_id,
    caller.id,
    template.buyer_member_id,
    template.category_id,
    template.type,
    'planned',
    'forecast',
    template.description,
    estimate,
    estimate,
    null,
    0,
    p_occurrence_date,
    date_trunc('month',p_occurrence_date)::date,
    projected_due,
    template.notes
  )
  returning id into tx;

  if template.type='expense' then
    previous_defer_setting:=current_setting(
      'casa_finance.defer_member_settlement_reconcile',
      true
    );

    perform set_config(
      'casa_finance.defer_member_settlement_reconcile',
      'on',
      true
    );

    begin
      insert into public.transaction_payment_instruments(
        household_id,
        transaction_id,
        kind,
        account_id,
        card_id
      )
      select
        p_household_id,
        tx,
        kind,
        account_id,
        card_id
      from public.transaction_payment_instruments
      where transaction_id=template.id;

      insert into public.economic_allocations(
        household_id,
        transaction_id,
        responsible_member_id,
        responsible_party_id,
        allocation_order,
        percentage,
        amount
      )
      select
        p_household_id,
        tx,
        responsible_member_id,
        responsible_party_id,
        allocation_order,
        percentage,
        amount
      from public.economic_allocations
      where transaction_id=template.id;

      insert into public.transaction_splits(
        household_id,
        transaction_id,
        responsible_member_id,
        percentage,
        amount
      )
      select
        p_household_id,
        tx,
        responsible_member_id,
        percentage,
        amount
      from public.transaction_splits
      where transaction_id=template.id;

      perform public.rescale_economic_allocations(tx,estimate);
    exception
      when others then
        perform set_config(
          'casa_finance.defer_member_settlement_reconcile',
          coalesce(previous_defer_setting,'off'),
          true
        );
        raise;
    end;

    perform set_config(
      'casa_finance.defer_member_settlement_reconcile',
      coalesce(previous_defer_setting,'off'),
      true
    );

    perform public.reconcile_member_settlements(tx);
  end if;

  insert into public.recurring_occurrences(
    household_id,
    recurring_rule_id,
    transaction_id,
    competence_date,
    due_date,
    status,
    idempotency_key,
    estimated_amount
  ) values(
    p_household_id,
    p_rule_id,
    tx,
    p_occurrence_date,
    projected_due,
    'planned',
    key,
    estimate
  );

  return tx;
end
$$;

revoke all on function public.generate_recurring_occurrence(uuid,uuid,date)
from public,anon;

grant execute on function public.generate_recurring_occurrence(uuid,uuid,date)
to authenticated;

comment on function public.trigger_reconcile_member_settlements() is
  'Canonical settlement trigger. Deferral is honored only while an internal recurring occurrence explicitly sets the transaction-local Casa Finance assembly flag; normal refunds, corrections and allocation rescales reconcile immediately.';

comment on function public.generate_recurring_occurrence(uuid,uuid,date) is
  'Creates one forecast expense occurrence. Economic-allocation trigger work is transaction-locally deferred only during atomic occurrence assembly, then member settlements are reconciled once after the occurrence is financially complete.';
