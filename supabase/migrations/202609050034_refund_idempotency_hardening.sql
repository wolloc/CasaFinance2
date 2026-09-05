-- Etapa 10H.16: exact replay hardening for direct refunds.
-- Forward-only companion to migration 033 in the same unreleased branch.

create or replace function public.refund_direct_expense(
  p_household_id uuid,
  p_transaction_id uuid,
  p_amount numeric,
  p_refunded_at timestamptz,
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
  existing public.transaction_adjustment_events;
  source_account uuid;
  refund_tx uuid;
  movement_id uuid;
  member_funded numeric;
  result uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if p_amount<=0 or p_refunded_at is null
     or length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'invalid refund command' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':direct-refund:'||trim(p_request_key),0));
  select * into existing from public.transaction_adjustment_events
   where household_id=p_household_id and request_key=trim(p_request_key);
  if existing.id is not null then
    if existing.kind<>'refund' or existing.source_transaction_id<>p_transaction_id
       or existing.amount<>p_amount or existing.reason<>trim(p_reason)
       or existing.occurred_at<>p_refunded_at
    then raise exception 'idempotency key already used with different payload' using errcode='23505'; end if;
    return existing.id;
  end if;

  select * into tx from public.transactions
   where id=p_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null
   for update;
  if tx.id is null or tx.economic_state<>'realized' or tx.status<>'paid'
  then raise exception 'fully realized paid expense required' using errcode='23514'; end if;
  if exists(select 1 from public.transaction_adjustment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id and e.kind='refund')
  then raise exception 'multiple or partial refunds require the dedicated partial-refund model' using errcode='0A000'; end if;
  if p_amount<>tx.realized_amount
  then raise exception 'only full direct refunds are supported by this command' using errcode='0A000'; end if;
  if exists(select 1 from public.external_payment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations o where o.household_id=p_household_id and o.source_transaction_id=tx.id)
     or exists(select 1 from public.installment_plans ip where ip.household_id=p_household_id and ip.purchase_transaction_id=tx.id)
     or tx.invoice_id is not null
  then raise exception 'refund route has linked card, obligation, or external-payer facts and needs a dedicated command' using errcode='0A000'; end if;

  select pi.account_id into source_account from public.transaction_payment_instruments pi
   where pi.household_id=p_household_id and pi.transaction_id=tx.id and pi.kind='account';
  if source_account is null
     or exists(select 1 from public.transaction_payment_instruments pi where pi.household_id=p_household_id and pi.transaction_id=tx.id and pi.kind='card')
  then raise exception 'only direct account-paid expenses are supported by this refund command' using errcode='0A000'; end if;

  select coalesce(sum(f.amount),0) into member_funded from public.funding_events f
   where f.household_id=p_household_id and f.financed_transaction_id=tx.id and f.invoice_id is null;
  if member_funded<>tx.realized_amount
  then raise exception 'refund requires fully realized direct member funding' using errcode='0A000'; end if;

  insert into public.transactions(
    household_id,created_by_member_id,type,status,economic_state,description,amount,
    estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at,notes
  ) values (
    p_household_id,caller.id,'adjustment','paid','realized','Estorno: '||tx.description,p_amount,
    p_amount,p_amount,p_amount,p_refunded_at::date,date_trunc('month',p_refunded_at)::date,p_refunded_at,trim(p_reason)
  ) returning id into refund_tx;

  insert into public.transaction_links(household_id,source_transaction_id,related_transaction_id,kind,amount)
  values(p_household_id,tx.id,refund_tx,'refund',p_amount);

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,destination_account_id,
    related_transaction_id,movement_date,competence_date,notes,realized_at
  ) values (
    p_household_id,caller.id,'refund','realized',p_amount,'Estorno: '||tx.description,source_account,
    tx.id,p_refunded_at::date,date_trunc('month',p_refunded_at)::date,trim(p_reason),p_refunded_at
  ) returning id into movement_id;

  insert into public.transaction_adjustment_events(
    household_id,source_transaction_id,related_transaction_id,kind,amount,before_payload,after_payload,
    reason,request_key,created_by_member_id,occurred_at
  ) values (
    p_household_id,tx.id,refund_tx,'refund',p_amount,
    jsonb_build_object('economic_state',tx.economic_state,'status',tx.status,'realized_amount',tx.realized_amount),
    jsonb_build_object('economic_state','reversed','status','refunded','realized_amount',tx.realized_amount),
    trim(p_reason),trim(p_request_key),caller.id,p_refunded_at
  ) returning id into result;

  update public.transactions
  set economic_state='reversed',status='refunded',updated_at=now()
  where id=tx.id;

  return result;
end
$$;

revoke all on function public.refund_direct_expense(uuid,uuid,numeric,timestamptz,text,text) from public,anon;
grant execute on function public.refund_direct_expense(uuid,uuid,numeric,timestamptz,text,text) to authenticated;
