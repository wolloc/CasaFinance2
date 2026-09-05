-- Etapa 10H.15: traceable corrections, cancellations, and safe direct refunds.
-- Forward-only. Historical facts are never deleted; corrections are explicit events.

do $$ begin
  create type public.transaction_adjustment_event_kind as enum ('correction','cancellation','refund');
exception when duplicate_object then null; end $$;

create table if not exists public.transaction_adjustment_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_transaction_id uuid not null references public.transactions(id) on delete restrict,
  related_transaction_id uuid references public.transactions(id) on delete restrict,
  kind public.transaction_adjustment_event_kind not null,
  amount numeric(19,2) check (amount is null or amount>0),
  before_payload jsonb,
  after_payload jsonb,
  reason text not null check (length(trim(reason))>0),
  request_key text not null check (length(trim(request_key))>0),
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(household_id,request_key),
  check ((kind='refund')=(amount is not null)),
  check (kind<>'refund' or related_transaction_id is not null)
);

alter table public.transaction_adjustment_events enable row level security;
drop policy if exists transaction_adjustment_events_select_active_member on public.transaction_adjustment_events;
create policy transaction_adjustment_events_select_active_member
  on public.transaction_adjustment_events for select to authenticated
  using (public.is_active_household_member(household_id));
revoke all on public.transaction_adjustment_events from public,anon;
grant select on public.transaction_adjustment_events to authenticated;

comment on table public.transaction_adjustment_events is
  'Immutable audit events for transaction corrections, cancellations and refunds. The original transaction is preserved; no delete path is introduced.';

create or replace function public.correct_unrealized_transaction(
  p_household_id uuid,
  p_transaction_id uuid,
  p_description text,
  p_amount numeric,
  p_transaction_date date,
  p_due_date date,
  p_category_id uuid,
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
  result uuid;
  before_payload jsonb;
  after_payload jsonb;
begin
  caller:=public.require_active_member(p_household_id);
  if p_amount<=0 or p_transaction_date is null
     or length(trim(coalesce(p_description,'')))=0
     or length(trim(coalesce(p_reason,'')))=0
     or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'invalid correction command' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':transaction-correction:'||trim(p_request_key),0));
  select * into existing from public.transaction_adjustment_events
   where household_id=p_household_id and request_key=trim(p_request_key);
  if existing.id is not null then
    if existing.kind<>'correction' or existing.source_transaction_id<>p_transaction_id
       or existing.after_payload is distinct from jsonb_build_object(
          'description',trim(p_description),'amount',p_amount,'transaction_date',p_transaction_date,
          'due_date',p_due_date,'category_id',p_category_id)
       or existing.reason<>trim(p_reason)
    then raise exception 'idempotency key already used with different payload' using errcode='23505'; end if;
    return existing.id;
  end if;

  select * into tx from public.transactions
   where id=p_transaction_id and household_id=p_household_id and deleted_at is null
   for update;
  if tx.id is null then raise exception 'transaction not found' using errcode='23514'; end if;
  if tx.economic_state not in ('forecast','confirmed') or tx.realized_amount<>0
  then raise exception 'only unrealized forecast or confirmed transactions can be corrected directly' using errcode='0A000'; end if;
  if tx.status in ('paid','received','cancelled','refunded')
  then raise exception 'settled or closed transaction requires a linked reversal flow' using errcode='0A000'; end if;
  if exists(select 1 from public.funding_events f where f.household_id=p_household_id and f.financed_transaction_id=tx.id)
     or exists(select 1 from public.external_payment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations o where o.household_id=p_household_id and o.source_transaction_id=tx.id)
     or exists(select 1 from public.installment_plans ip where ip.household_id=p_household_id and ip.purchase_transaction_id=tx.id)
     or tx.invoice_id is not null
  then raise exception 'linked financial facts require a dedicated correction command' using errcode='0A000'; end if;

  before_payload:=jsonb_build_object(
    'description',tx.description,'amount',tx.amount,'transaction_date',tx.transaction_date,
    'due_date',tx.due_date,'category_id',tx.category_id);
  after_payload:=jsonb_build_object(
    'description',trim(p_description),'amount',p_amount,'transaction_date',p_transaction_date,
    'due_date',p_due_date,'category_id',p_category_id);

  insert into public.transaction_adjustment_events(
    household_id,source_transaction_id,kind,before_payload,after_payload,reason,request_key,created_by_member_id
  ) values (
    p_household_id,tx.id,'correction',before_payload,after_payload,trim(p_reason),trim(p_request_key),caller.id
  ) returning id into result;

  update public.transactions set
    description=trim(p_description), amount=p_amount,
    estimated_amount=case when tx.economic_state='forecast' then p_amount else estimated_amount end,
    confirmed_amount=case when tx.economic_state='confirmed' then p_amount else confirmed_amount end,
    transaction_date=p_transaction_date,
    competence_date=p_transaction_date,
    due_date=p_due_date,
    category_id=p_category_id,
    updated_at=now()
  where id=tx.id;

  return result;
end
$$;

create or replace function public.cancel_unrealized_transaction(
  p_household_id uuid,
  p_transaction_id uuid,
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
  result uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'reason and request key required' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':transaction-cancel:'||trim(p_request_key),0));
  select * into existing from public.transaction_adjustment_events
   where household_id=p_household_id and request_key=trim(p_request_key);
  if existing.id is not null then
    if existing.kind<>'cancellation' or existing.source_transaction_id<>p_transaction_id or existing.reason<>trim(p_reason)
    then raise exception 'idempotency key already used with different payload' using errcode='23505'; end if;
    return existing.id;
  end if;

  select * into tx from public.transactions
   where id=p_transaction_id and household_id=p_household_id and deleted_at is null
   for update;
  if tx.id is null then raise exception 'transaction not found' using errcode='23514'; end if;
  if tx.economic_state not in ('forecast','confirmed') or tx.realized_amount<>0
  then raise exception 'only unrealized forecast or confirmed transactions can be cancelled directly' using errcode='0A000'; end if;
  if exists(select 1 from public.funding_events f where f.household_id=p_household_id and f.financed_transaction_id=tx.id)
     or exists(select 1 from public.external_payment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations o where o.household_id=p_household_id and o.source_transaction_id=tx.id)
     or exists(select 1 from public.installment_plans ip where ip.household_id=p_household_id and ip.purchase_transaction_id=tx.id)
     or tx.invoice_id is not null
  then raise exception 'linked financial facts require a dedicated cancellation/reversal command' using errcode='0A000'; end if;

  insert into public.transaction_adjustment_events(
    household_id,source_transaction_id,kind,before_payload,after_payload,reason,request_key,created_by_member_id
  ) values (
    p_household_id,tx.id,'cancellation',
    jsonb_build_object('economic_state',tx.economic_state,'status',tx.status),
    jsonb_build_object('economic_state','cancelled','status','cancelled'),
    trim(p_reason),trim(p_request_key),caller.id
  ) returning id into result;

  update public.transactions
  set economic_state='cancelled',status='cancelled',settled_at=null,updated_at=now()
  where id=tx.id;
  return result;
end
$$;

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

create or replace view public.financial_transaction_refund_positions with (security_invoker=true) as
select t.household_id,t.id source_transaction_id,t.description,t.amount gross_amount,
  coalesce(sum(l.amount) filter (where l.kind='refund'),0)::numeric(19,2) refunded_amount,
  greatest(t.amount-coalesce(sum(l.amount) filter (where l.kind='refund'),0),0)::numeric(19,2) net_amount,
  t.economic_state,t.status
from public.transactions t
left join public.transaction_links l on l.household_id=t.household_id and l.source_transaction_id=t.id
where t.type='expense' and t.deleted_at is null
group by t.household_id,t.id,t.description,t.amount,t.economic_state,t.status;

comment on view public.financial_transaction_refund_positions is
  'Traceable gross/refunded/net expense position. Refunds are linked reversals, never income.';

revoke all on function public.correct_unrealized_transaction(uuid,uuid,text,numeric,date,date,uuid,text,text) from public,anon;
grant execute on function public.correct_unrealized_transaction(uuid,uuid,text,numeric,date,date,uuid,text,text) to authenticated;
revoke all on function public.cancel_unrealized_transaction(uuid,uuid,text,text) from public,anon;
grant execute on function public.cancel_unrealized_transaction(uuid,uuid,text,text) to authenticated;
revoke all on function public.refund_direct_expense(uuid,uuid,numeric,timestamptz,text,text) from public,anon;
grant execute on function public.refund_direct_expense(uuid,uuid,numeric,timestamptz,text,text) to authenticated;
revoke all on public.financial_transaction_refund_positions from public,anon;
grant select on public.financial_transaction_refund_positions to authenticated;

-- Deliberate safety boundaries:
-- * direct edit/cancel is only for unrealized transactions with no downstream financial facts;
-- * full refund is currently limited to direct account-paid expenses funded entirely by household members;
-- * partial refunds and card/external-payer/obligation refund routes are rejected until their canonical read-model effects are modeled explicitly;
-- * no delete path is introduced.