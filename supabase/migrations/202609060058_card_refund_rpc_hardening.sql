-- Hardening da 10AO: remove qualquer ambiguidade entre variável e coluna card_id.
create or replace function public.record_card_invoice_credit_refund(
  p_household_id uuid,p_transaction_id uuid,p_target_invoice_id uuid,p_amount numeric,
  p_occurred_at timestamptz,p_reason text,p_request_key text
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  caller public.household_members; tx public.transactions; inv public.card_invoices;
  v_card_id uuid; v_plan_id uuid; target_installment public.installments; existing public.card_refund_events;
  refund_tx uuid; event_id uuid; gross_amount numeric; refunded_before numeric; refunded_after numeric; net_after numeric;
  already_funded numeric; invoice_outstanding numeric;
begin
  caller:=public.require_active_member(p_household_id);
  if p_amount<=0 or p_occurred_at is null or length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'invalid card refund command' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':card-refund:'||trim(p_request_key),0));
  select r.* into existing from public.card_refund_events r where r.household_id=p_household_id and r.request_key=trim(p_request_key);
  if existing.id is not null then
    if existing.source_transaction_id<>p_transaction_id or existing.target_invoice_id<>p_target_invoice_id or existing.amount<>p_amount or existing.occurred_at<>p_occurred_at or existing.reason<>trim(p_reason)
    then raise exception 'idempotency key already used with different payload' using errcode='23505'; end if;
    return existing.id;
  end if;

  select t.* into tx from public.transactions t
  where t.id=p_transaction_id and t.household_id=p_household_id and t.type='expense' and t.deleted_at is null for update;
  if tx.id is null or tx.economic_state not in ('realized','reversed') or tx.status='cancelled'
  then raise exception 'realized card expense required' using errcode='23514'; end if;

  select pi.card_id into v_card_id from public.transaction_payment_instruments pi
  where pi.household_id=p_household_id and pi.transaction_id=tx.id and pi.kind='card';
  if v_card_id is null then raise exception 'card expense required' using errcode='0A000'; end if;
  if exists(select 1 from public.external_payment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations o where o.household_id=p_household_id and o.source_transaction_id=tx.id)
  then raise exception 'external payer or obligation refund requires a dedicated route' using errcode='0A000'; end if;

  select ci.* into inv from public.card_invoices ci
  where ci.id=p_target_invoice_id and ci.household_id=p_household_id and ci.card_id=v_card_id and ci.deleted_at is null for update;
  if inv.id is null or inv.status in ('paid','cancelled') then raise exception 'active target invoice required' using errcode='23514'; end if;
  invoice_outstanding:=greatest(inv.total_amount-inv.settled_amount-inv.financed_balance,0);
  if p_amount>invoice_outstanding then raise exception 'refund exceeds unpaid target invoice amount' using errcode='23514'; end if;

  select ip.id into v_plan_id from public.installment_plans ip where ip.household_id=p_household_id and ip.purchase_transaction_id=tx.id;
  if v_plan_id is null then
    if tx.invoice_id is distinct from inv.id then raise exception 'single card purchase refund must credit its purchase invoice' using errcode='0A000'; end if;
    select coalesce(sum(f.amount),0) into already_funded from public.funding_events f
    where f.household_id=p_household_id and f.financed_transaction_id=tx.id and f.invoice_id=inv.id;
    if already_funded>0 then raise exception 'already funded card purchase requires a post-payment credit route' using errcode='0A000'; end if;
  else
    select i.* into target_installment from public.installments i
    where i.household_id=p_household_id and i.installment_plan_id=v_plan_id and i.invoice_id=inv.id and i.status not in ('cancelled','refunded') for update;
    if target_installment.id is null then raise exception 'target invoice must contain an active installment from this purchase' using errcode='0A000'; end if;
    select coalesce(sum(f.amount),0) into already_funded from public.funding_events f
    where f.household_id=p_household_id and f.financed_transaction_id=tx.id and f.invoice_id=inv.id and f.installment_id=target_installment.id;
    if already_funded>0 then raise exception 'already funded installment requires a post-payment credit route' using errcode='0A000'; end if;
    if p_amount>target_installment.amount then raise exception 'refund exceeds target installment amount' using errcode='23514'; end if;
  end if;

  gross_amount:=tx.realized_amount;
  select coalesce(sum(r.amount),0) into refunded_before from public.card_refund_events r where r.household_id=p_household_id and r.source_transaction_id=tx.id;
  if refunded_before>=gross_amount or p_amount>gross_amount-refunded_before then raise exception 'refund exceeds remaining refundable purchase amount' using errcode='23514'; end if;
  refunded_after:=refunded_before+p_amount; net_after:=gross_amount-refunded_after;

  insert into public.transactions(household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at,notes)
  values(p_household_id,caller.id,'adjustment','paid','realized','Crédito de estorno no cartão: '||tx.description,p_amount,p_amount,p_amount,p_amount,p_occurred_at::date,date_trunc('month',p_occurred_at)::date,p_occurred_at,trim(p_reason)) returning id into refund_tx;
  insert into public.transaction_links(household_id,source_transaction_id,related_transaction_id,kind,amount) values(p_household_id,tx.id,refund_tx,'refund',p_amount);
  insert into public.card_refund_events(household_id,source_transaction_id,target_invoice_id,target_installment_id,related_transaction_id,amount,occurred_at,reason,request_key,created_by_member_id)
  values(p_household_id,tx.id,inv.id,target_installment.id,refund_tx,p_amount,p_occurred_at,trim(p_reason),trim(p_request_key),caller.id) returning id into event_id;
  insert into public.transaction_adjustment_events(household_id,source_transaction_id,related_transaction_id,kind,amount,before_payload,after_payload,reason,request_key,created_by_member_id,occurred_at)
  values(p_household_id,tx.id,refund_tx,'refund',p_amount,
    jsonb_build_object('refunded_total',refunded_before,'effective_expense_amount',gross_amount-refunded_before,'target_invoice_id',inv.id),
    jsonb_build_object('refunded_total',refunded_after,'effective_expense_amount',net_after,'target_invoice_id',inv.id,'target_installment_id',target_installment.id),
    trim(p_reason),'card-adjustment:'||trim(p_request_key),caller.id,p_occurred_at);

  update public.card_invoices ci set total_amount=ci.total_amount-p_amount,
    status=case when ci.total_amount-p_amount=ci.settled_amount+ci.financed_balance then 'paid' else ci.status end,
    settled_at=case when ci.total_amount-p_amount=ci.settled_amount+ci.financed_balance then coalesce(ci.settled_at,p_occurred_at) else ci.settled_at end,updated_at=now()
  where ci.id=inv.id;
  if v_plan_id is not null then
    if p_amount=target_installment.amount then update public.installments set status='refunded',settled_at=p_occurred_at where id=target_installment.id;
    else update public.installments set amount=amount-p_amount where id=target_installment.id; end if;
  end if;
  if net_after>0 then perform public.rescale_economic_allocations(tx.id,net_after);
  else update public.transactions set economic_state='reversed',status='refunded',updated_at=now() where id=tx.id; end if;
  return event_id;
end $$;

revoke all on function public.record_card_invoice_credit_refund(uuid,uuid,uuid,numeric,timestamptz,text,text) from public,anon;
grant execute on function public.record_card_invoice_credit_refund(uuid,uuid,uuid,numeric,timestamptz,text,text) to authenticated;
