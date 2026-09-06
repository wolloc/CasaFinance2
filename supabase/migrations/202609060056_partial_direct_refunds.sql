-- Etapa 10AN: estornos parciais e múltiplos de gastos diretos.
-- Refund reduz o efeito econômico do gasto original e devolve caixa ao recurso que realmente financiou a compra.
-- Não é renda verdadeira e nunca troca silenciosamente a conta de destino.

create or replace function public.refund_direct_expense_partial(
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
  result uuid;
  member_funded numeric;
  funding_account_count integer;
  refunded_before numeric;
  refunded_after numeric;
  refundable_before numeric;
begin
  caller:=public.require_active_member(p_household_id);
  if p_amount<=0 or p_refunded_at is null
     or length(trim(coalesce(p_reason,'')))=0
     or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'invalid partial refund command' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':partial-direct-refund:'||trim(p_request_key),0));
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
  if tx.id is null or tx.economic_state not in ('realized','reversed')
  then raise exception 'realized expense required' using errcode='23514'; end if;
  if tx.status not in ('paid','refunded')
  then raise exception 'paid expense required' using errcode='23514'; end if;

  if exists(select 1 from public.external_payment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations o where o.household_id=p_household_id and o.source_transaction_id=tx.id)
     or exists(select 1 from public.installment_plans ip where ip.household_id=p_household_id and ip.purchase_transaction_id=tx.id)
     or tx.invoice_id is not null
  then raise exception 'linked card, obligation or external-payer refund requires a dedicated route' using errcode='0A000'; end if;

  if not exists(select 1 from public.transaction_payment_instruments pi where pi.household_id=p_household_id and pi.transaction_id=tx.id and pi.kind='account')
     or exists(select 1 from public.transaction_payment_instruments pi where pi.household_id=p_household_id and pi.transaction_id=tx.id and pi.kind='card')
  then raise exception 'partial direct refund supports account-paid expenses only' using errcode='0A000'; end if;

  select coalesce(sum(f.amount),0),count(distinct f.source_account_id),max(f.source_account_id::text)::uuid
    into member_funded,funding_account_count,source_account
  from public.funding_events f
  where f.household_id=p_household_id and f.financed_transaction_id=tx.id and f.invoice_id is null;

  if member_funded<>tx.realized_amount
  then raise exception 'refund requires fully realized direct member funding' using errcode='0A000'; end if;
  if funding_account_count<>1 or source_account is null
  then raise exception 'refund requires exactly one realized funding account' using errcode='0A000'; end if;

  select coalesce(sum(e.amount),0) into refunded_before
  from public.transaction_adjustment_events e
  where e.household_id=p_household_id and e.source_transaction_id=tx.id and e.kind='refund';
  refundable_before:=greatest(tx.realized_amount-refunded_before,0);
  if refundable_before<=0 then raise exception 'expense already fully refunded' using errcode='23514'; end if;
  if p_amount>refundable_before then raise exception 'refund exceeds remaining refundable amount' using errcode='23514'; end if;
  refunded_after:=refunded_before+p_amount;

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
  );

  insert into public.transaction_adjustment_events(
    household_id,source_transaction_id,related_transaction_id,kind,amount,before_payload,after_payload,
    reason,request_key,created_by_member_id,occurred_at
  ) values (
    p_household_id,tx.id,refund_tx,'refund',p_amount,
    jsonb_build_object('refunded_total',refunded_before,'effective_expense_amount',tx.realized_amount-refunded_before,'status',tx.status,'economic_state',tx.economic_state),
    jsonb_build_object('refunded_total',refunded_after,'effective_expense_amount',tx.realized_amount-refunded_after,'status',case when refunded_after=tx.realized_amount then 'refunded' else 'paid' end,'economic_state',case when refunded_after=tx.realized_amount then 'reversed' else 'realized' end),
    trim(p_reason),trim(p_request_key),caller.id,p_refunded_at
  ) returning id into result;

  if refunded_after=tx.realized_amount then
    update public.transactions set economic_state='reversed',status='refunded',updated_at=now() where id=tx.id;
  end if;
  return result;
end
$$;

create or replace view public.financial_direct_refund_positions
with (security_invoker=true) as
with refunds as (
  select household_id,source_transaction_id,
         coalesce(sum(amount),0)::numeric(19,2) refunded_amount,
         max(occurred_at) last_refunded_at
  from public.transaction_adjustment_events
  where kind='refund'
  group by household_id,source_transaction_id
), funding as (
  select household_id,financed_transaction_id,
         coalesce(sum(amount),0)::numeric(19,2) funded_amount,
         count(distinct source_account_id) funding_account_count,
         max(source_account_id::text)::uuid source_account_id
  from public.funding_events
  where invoice_id is null
  group by household_id,financed_transaction_id
)
select t.household_id,t.id transaction_id,t.description,t.transaction_date,
       t.realized_amount::numeric(19,2) original_amount,
       coalesce(r.refunded_amount,0)::numeric(19,2) refunded_amount,
       greatest(t.realized_amount-coalesce(r.refunded_amount,0),0)::numeric(19,2) remaining_refundable_amount,
       r.last_refunded_at,
       f.source_account_id,a.name source_account_name,
       case when coalesce(r.refunded_amount,0)=0 then 'none'
            when coalesce(r.refunded_amount,0)<t.realized_amount then 'partial'
            else 'full' end refund_state
from public.transactions t
join public.transaction_payment_instruments pi on pi.household_id=t.household_id and pi.transaction_id=t.id and pi.kind='account'
join funding f on f.household_id=t.household_id and f.financed_transaction_id=t.id
left join refunds r on r.household_id=t.household_id and r.source_transaction_id=t.id
left join public.accounts a on a.id=f.source_account_id and a.household_id=t.household_id
where t.type='expense' and t.deleted_at is null
  and t.status in ('paid','refunded') and t.economic_state in ('realized','reversed')
  and t.invoice_id is null
  and f.funded_amount=t.realized_amount and f.funding_account_count=1
  and not exists(select 1 from public.external_payment_events e where e.household_id=t.household_id and e.source_transaction_id=t.id)
  and not exists(select 1 from public.financial_obligations o where o.household_id=t.household_id and o.source_transaction_id=t.id)
  and not exists(select 1 from public.installment_plans ip where ip.household_id=t.household_id and ip.purchase_transaction_id=t.id);

comment on view public.financial_direct_refund_positions is
  'Direct account-paid expense refund position. Original economic fact remains historical; refunded amount is linked and net/effective expense is derived without classifying refund as income.';

revoke all on function public.refund_direct_expense_partial(uuid,uuid,numeric,timestamptz,text,text) from public,anon;
grant execute on function public.refund_direct_expense_partial(uuid,uuid,numeric,timestamptz,text,text) to authenticated;
grant select on public.financial_direct_refund_positions to authenticated;
