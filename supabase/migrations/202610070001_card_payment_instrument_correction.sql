-- Casa Finance: audited correction of the card used by an existing purchase.
-- Only moves a clean, unpaid, non-installment card purchase between cards.
-- It never creates a new expense and preserves the original transaction/history.

create or replace function public.correct_card_payment_instrument(
  p_household_id uuid,
  p_transaction_id uuid,
  p_target_card_id uuid,
  p_reason text,
  p_request_key text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx public.transactions;
  current_instrument public.transaction_payment_instruments;
  target_card public.cards;
  old_invoice public.card_invoices;
  target_invoice public.card_invoices;
  dates record;
  existing public.transaction_adjustment_events;
  result uuid;
  before_payload jsonb;
  after_payload jsonb;
begin
  caller:=public.require_active_member(p_household_id);

  if p_target_card_id is null
     or length(trim(coalesce(p_reason,'')))=0
     or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'invalid card correction command' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_household_id::text||':card-instrument-correction:'||trim(p_request_key),0)
  );

  select * into existing
    from public.transaction_adjustment_events
   where household_id=p_household_id
     and request_key=trim(p_request_key);

  if existing.id is not null then
    if existing.kind<>'correction'
       or existing.source_transaction_id<>p_transaction_id
       or existing.reason<>trim(p_reason)
       or existing.after_payload->>'target_card_id'<>p_target_card_id::text
    then raise exception 'idempotency key already used with different payload' using errcode='23505'; end if;
    return existing.id;
  end if;

  select * into tx
    from public.transactions
   where id=p_transaction_id
     and household_id=p_household_id
     and type='expense'
     and deleted_at is null
   for update;

  if tx.id is null then raise exception 'transaction not found' using errcode='23514'; end if;
  if tx.status in ('cancelled','refunded') or tx.economic_state in ('cancelled','reversed')
  then raise exception 'closed expense cannot change card' using errcode='0A000'; end if;
  if tx.invoice_id is null
  then raise exception 'card purchase invoice not found' using errcode='0A000'; end if;

  select * into current_instrument
    from public.transaction_payment_instruments
   where household_id=p_household_id
     and transaction_id=tx.id
     and kind='card'
   for update;

  if current_instrument.id is null or current_instrument.card_id is null
  then raise exception 'card payment instrument not found' using errcode='0A000'; end if;
  if current_instrument.card_id=p_target_card_id
  then raise exception 'target card is already selected' using errcode='22023'; end if;

  select * into target_card
    from public.cards
   where household_id=p_household_id
     and id=p_target_card_id
     and deactivated_at is null
   for update;

  if target_card.id is null then raise exception 'target card not found or inactive' using errcode='23514'; end if;

  if exists(select 1 from public.funding_events f where f.household_id=p_household_id and f.financed_transaction_id=tx.id)
     or exists(select 1 from public.external_payment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations o where o.household_id=p_household_id and o.source_transaction_id=tx.id)
     or exists(select 1 from public.installment_plans ip where ip.household_id=p_household_id and ip.purchase_transaction_id=tx.id)
     or exists(select 1 from public.recurring_occurrences ro where ro.household_id=p_household_id and ro.transaction_id=tx.id)
     or exists(select 1 from public.transaction_adjustment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id)
  then raise exception 'linked financial facts require a dedicated card correction route' using errcode='0A000'; end if;

  select * into old_invoice
    from public.card_invoices
   where household_id=p_household_id
     and id=tx.invoice_id
   for update;

  if old_invoice.id is null then raise exception 'current card invoice not found' using errcode='23514'; end if;

  -- The purchase must still be part of the unpaid amount of the current invoice.
  if old_invoice.total_amount < tx.amount
     or old_invoice.settled_amount > old_invoice.total_amount-tx.amount+0.005
  then raise exception 'purchase is already covered by the current invoice and cannot be moved safely' using errcode='0A000'; end if;

  select * into dates
    from public.invoice_dates(target_card,tx.transaction_date);

  select * into target_invoice
    from public.card_invoices
   where household_id=p_household_id
     and card_id=target_card.id
     and competence_date=dates.competence
   for update;

  if target_invoice.id is not null and target_invoice.status not in ('open')
  then raise exception 'target card invoice is already closed or paid' using errcode='0A000'; end if;

  if target_invoice.id is null then
    insert into public.card_invoices(
      household_id,card_id,competence_date,closing_date,due_date,total_amount
    ) values (
      p_household_id,target_card.id,dates.competence,dates.closing_date,dates.due_date,tx.amount
    ) returning * into target_invoice;
  else
    update public.card_invoices
       set total_amount=total_amount+tx.amount,
           updated_at=now()
     where id=target_invoice.id;
  end if;

  update public.card_invoices
     set total_amount=greatest(0,total_amount-tx.amount),
         updated_at=now()
   where id=old_invoice.id;

  update public.transaction_payment_instruments
     set card_id=p_target_card_id
   where household_id=p_household_id
     and transaction_id=tx.id;

  update public.financing_allocations
     set card_id=p_target_card_id,
         invoice_id=target_invoice.id
   where household_id=p_household_id
     and transaction_id=tx.id
     and mechanism='card_purchase';

  before_payload:=jsonb_build_object(
    'card_id',current_instrument.card_id,
    'invoice_id',old_invoice.id,
    'due_date',tx.due_date
  );
  after_payload:=jsonb_build_object(
    'card_id',p_target_card_id,
    'target_card_id',p_target_card_id,
    'invoice_id',target_invoice.id,
    'due_date',dates.due_date
  );

  insert into public.transaction_adjustment_events(
    household_id,source_transaction_id,kind,amount,before_payload,after_payload,
    reason,request_key,created_by_member_id
  ) values (
    p_household_id,tx.id,'correction',tx.amount,before_payload,after_payload,
    trim(p_reason),trim(p_request_key),caller.id
  ) returning id into result;

  update public.transactions
     set invoice_id=target_invoice.id,
         due_date=dates.due_date,
         updated_at=now()
   where id=tx.id;

  return result;
end
$$;

revoke all on function public.correct_card_payment_instrument(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.correct_card_payment_instrument(uuid,uuid,uuid,text,text) to authenticated;
