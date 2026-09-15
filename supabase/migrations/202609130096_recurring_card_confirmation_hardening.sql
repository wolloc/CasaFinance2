-- Hardening forward-only for card recurrence confirmation. A forecast may not
-- become a fact before its economic date, and a late fact cannot be hidden in
-- a paid/cancelled invoice.

create or replace function public.confirm_recurring_card_expense_occurrence(
  p_household_id uuid,
  p_occurrence_id uuid,
  p_confirmed_amount numeric
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  occurrence public.recurring_occurrences;
  tx public.transactions;
  instrument public.transaction_payment_instruments;
  card public.cards;
  dates record;
  invoice uuid;
  existing_invoice public.card_invoices;
  event_id uuid;
  event_key text;
begin
  caller:=public.require_active_member(p_household_id);
  select * into occurrence from public.recurring_occurrences
  where id=p_occurrence_id and household_id=p_household_id for update;
  if occurrence.id is null or occurrence.status='cancelled' then
    raise exception 'active recurring expense occurrence required' using errcode='23514';
  end if;

  select * into tx from public.transactions
  where id=occurrence.transaction_id and household_id=p_household_id and type='expense' and deleted_at is null for update;
  if tx.id is null or tx.economic_state not in ('forecast','confirmed') or tx.realized_amount<>0 or tx.invoice_id is not null then
    raise exception 'unrealized uninvoiced recurring card expense required' using errcode='0A000';
  end if;
  if tx.transaction_date>current_date then
    raise exception 'future recurring card occurrence cannot be confirmed before its economic date' using errcode='22023';
  end if;
  if p_confirmed_amount is null or p_confirmed_amount<=0 then
    raise exception 'positive confirmed amount required' using errcode='22023';
  end if;

  select * into instrument from public.transaction_payment_instruments
  where household_id=p_household_id and transaction_id=tx.id and kind='card';
  if instrument.transaction_id is null then
    raise exception 'recurring card payment instrument required' using errcode='23514';
  end if;
  select * into card from public.cards
  where id=instrument.card_id and household_id=p_household_id and deactivated_at is null;
  if card.id is null then raise exception 'active recurring card required' using errcode='23514'; end if;

  if exists(select 1 from public.installment_plans where household_id=p_household_id and purchase_transaction_id=tx.id)
     or exists(select 1 from public.funding_events where household_id=p_household_id and financed_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations where household_id=p_household_id and source_transaction_id=tx.id)
     or exists(select 1 from public.external_payment_events where household_id=p_household_id and source_transaction_id=tx.id)
     or exists(
       select 1 from public.recurring_rules rr
       join public.financing_allocations fa on fa.transaction_id=rr.template_transaction_id and fa.household_id=rr.household_id
       where rr.id=occurrence.recurring_rule_id and rr.household_id=p_household_id and fa.mechanism='card_pix'
     ) then
    raise exception 'dependent or unsupported card facts require a dedicated route' using errcode='0A000';
  end if;

  select * into dates from public.invoice_dates(card,tx.transaction_date);
  select * into existing_invoice from public.card_invoices
  where household_id=p_household_id and card_id=card.id and competence_date=dates.competence
  for update;
  if existing_invoice.id is not null then
    if existing_invoice.status='cancelled' then
      raise exception 'cancelled card invoice cannot receive a late recurring charge' using errcode='0A000';
    end if;
    update public.card_invoices
    set total_amount=total_amount+p_confirmed_amount,
        status=case when status='paid' then 'open' else status end,
        settled_at=case when status='paid' then null else settled_at end,
        updated_at=now()
    where id=existing_invoice.id
    returning id into invoice;
  else
    insert into public.card_invoices(household_id,card_id,competence_date,closing_date,due_date,total_amount)
    values(p_household_id,card.id,dates.competence,dates.closing_date,dates.due_date,p_confirmed_amount)
    returning id into invoice;
  end if;

  perform public.rescale_economic_allocations(tx.id,p_confirmed_amount);
  event_key:='recurring-card-confirm:'||occurrence.id::text||':'||gen_random_uuid()::text;
  insert into public.transaction_adjustment_events(
    household_id,source_transaction_id,kind,before_payload,after_payload,reason,request_key,created_by_member_id
  ) values (
    p_household_id,tx.id,'correction',
    jsonb_build_object('amount',tx.amount,'economic_state',tx.economic_state,'invoice_id',tx.invoice_id,'recurring_occurrence_id',occurrence.id),
    jsonb_build_object('amount',p_confirmed_amount,'economic_state','realized','invoice_id',invoice,'recurring_occurrence_id',occurrence.id),
    'Cobrança recorrente confirmada no cartão pelo usuário',event_key,caller.id
  ) returning id into event_id;

  update public.transactions
  set amount=p_confirmed_amount,confirmed_amount=p_confirmed_amount,realized_amount=p_confirmed_amount,
      economic_state='realized',status='pending',invoice_id=invoice,due_date=dates.due_date,settled_at=null,updated_at=now()
  where id=tx.id;
  update public.recurring_occurrences
  set status='pending',confirmed_amount=p_confirmed_amount,confirmed_at=now(),due_date=dates.due_date,settled_at=null
  where id=occurrence.id;
  return event_id;
end
$$;

revoke all on function public.confirm_recurring_card_expense_occurrence(uuid,uuid,numeric) from public,anon;
grant execute on function public.confirm_recurring_card_expense_occurrence(uuid,uuid,numeric) to authenticated;

comment on function public.confirm_recurring_card_expense_occurrence(uuid,uuid,numeric) is
  'Materializes only an occurrence whose economic date has arrived. It reuses the forecast transaction, attaches one active invoice, reopens a paid invoice only for the new unpaid balance, and never creates cash or funding.';
