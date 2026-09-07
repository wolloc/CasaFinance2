-- Etapa 10AV: estorno pos-pagamento compartilhado com beneficio explicito.
-- Fecha a lacuna deixada pela rota conservadora 10AP: o estorno pode beneficiar
-- pessoa diferente do funder original, cair em outra conta ou envolver compra
-- economicamente compartilhada. O Casa preserva funding/historico original e
-- registra apenas a recuperacao posterior + o delta de acerto entre membros.

create table if not exists public.card_shared_post_payment_refund_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_transaction_id uuid not null references public.transactions(id) on delete restrict,
  outcome text not null check(outcome in ('future_invoice_credit','cash_return')),
  target_invoice_id uuid references public.card_invoices(id) on delete restrict,
  destination_account_id uuid references public.accounts(id) on delete restrict,
  related_transaction_id uuid not null references public.transactions(id) on delete restrict,
  amount numeric(19,2) not null check(amount>0),
  benefit_payload jsonb not null check(jsonb_typeof(benefit_payload)='array'),
  occurred_at timestamptz not null,
  reason text not null check(length(trim(reason))>0),
  request_key text not null check(length(trim(request_key))>0),
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(household_id,request_key),
  check((outcome='future_invoice_credit' and target_invoice_id is not null and destination_account_id is null)
     or (outcome='cash_return' and destination_account_id is not null and target_invoice_id is null))
);

create table if not exists public.funding_recovery_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  shared_refund_event_id uuid not null references public.card_shared_post_payment_refund_events(id) on delete restrict,
  source_transaction_id uuid not null references public.transactions(id) on delete restrict,
  beneficiary_member_id uuid not null references public.household_members(id) on delete restrict,
  amount numeric(19,2) not null check(amount>0),
  percentage numeric(9,6) not null check(percentage>0 and percentage<=100),
  created_at timestamptz not null default now(),
  unique(shared_refund_event_id,beneficiary_member_id)
);

comment on table public.card_shared_post_payment_refund_events is
  'Immutable parent event for post-payment card refunds that require explicit benefit redistribution. Refund never becomes true income.';
comment on table public.funding_recovery_events is
  'Immutable allocation of refund benefit/recovery by household member. This reduces effective funding burden without rewriting original funding_events.';

alter table public.card_shared_post_payment_refund_events enable row level security;
alter table public.funding_recovery_events enable row level security;
drop policy if exists card_shared_post_payment_refund_events_select on public.card_shared_post_payment_refund_events;
create policy card_shared_post_payment_refund_events_select on public.card_shared_post_payment_refund_events
for select to authenticated using(public.is_active_household_member(household_id));
drop policy if exists funding_recovery_events_select on public.funding_recovery_events;
create policy funding_recovery_events_select on public.funding_recovery_events
for select to authenticated using(public.is_active_household_member(household_id));
revoke all on public.card_shared_post_payment_refund_events from public,anon;
revoke all on public.funding_recovery_events from public,anon;
grant select on public.card_shared_post_payment_refund_events to authenticated;
grant select on public.funding_recovery_events to authenticated;

create or replace function public.enforce_card_refund_cumulative_cap()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_gross numeric; v_existing numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.household_id::text||':card-refund-total:'||new.source_transaction_id::text,0));
  select realized_amount into v_gross from public.transactions
   where id=new.source_transaction_id and household_id=new.household_id and type='expense' and deleted_at is null;
  if v_gross is null then raise exception 'valid source expense required' using errcode='23514'; end if;
  select coalesce(sum(amount),0) into v_existing from (
    select amount from public.card_refund_events where household_id=new.household_id and source_transaction_id=new.source_transaction_id
    union all
    select amount from public.card_post_payment_refund_events where household_id=new.household_id and source_transaction_id=new.source_transaction_id
    union all
    select amount from public.card_shared_post_payment_refund_events where household_id=new.household_id and source_transaction_id=new.source_transaction_id
  ) q;
  if v_existing+new.amount>v_gross then raise exception 'refund exceeds remaining refundable amount' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function public.enforce_card_refund_cumulative_cap() from public,anon,authenticated;

drop trigger if exists card_refund_cumulative_cap on public.card_refund_events;
create trigger card_refund_cumulative_cap before insert on public.card_refund_events for each row execute function public.enforce_card_refund_cumulative_cap();
drop trigger if exists card_post_payment_refund_cumulative_cap on public.card_post_payment_refund_events;
create trigger card_post_payment_refund_cumulative_cap before insert on public.card_post_payment_refund_events for each row execute function public.enforce_card_refund_cumulative_cap();
drop trigger if exists card_shared_post_payment_refund_cumulative_cap on public.card_shared_post_payment_refund_events;
create trigger card_shared_post_payment_refund_cumulative_cap before insert on public.card_shared_post_payment_refund_events for each row execute function public.enforce_card_refund_cumulative_cap();

create or replace function public.record_shared_post_payment_card_refund(
  p_household_id uuid,p_transaction_id uuid,p_outcome text,p_amount numeric,p_benefit_allocations jsonb,
  p_target_invoice_id uuid default null,p_destination_account_id uuid default null,p_occurred_at timestamptz default now(),
  p_reason text default 'Estorno pos-pagamento compartilhado',p_request_key text default null
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  caller public.household_members; tx public.transactions; v_card_id uuid; v_target public.card_invoices;
  v_gross numeric; v_refunded_before numeric; v_refunded_after numeric; v_net numeric; v_current_net numeric;
  v_refund_tx uuid; v_parent_event uuid; v_movement uuid; v_single_beneficiary uuid;
  v_allocation jsonb; v_sum numeric:=0; v_pct numeric:=0; v_count integer:=0;
  v_debtor uuid; v_creditor uuid; v_debit numeric; v_credit numeric; v_effect numeric;
  v_existing public.card_shared_post_payment_refund_events;
begin
  caller:=public.require_active_member(p_household_id);
  if p_outcome not in ('future_invoice_credit','cash_return') or p_amount is null or p_amount<=0 or p_occurred_at is null
     or length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0
     or jsonb_typeof(coalesce(p_benefit_allocations,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_benefit_allocations,'[]'::jsonb))=0
  then raise exception 'invalid shared post-payment refund command' using errcode='22023'; end if;

  select * into v_existing from public.card_shared_post_payment_refund_events where household_id=p_household_id and request_key=trim(p_request_key);
  if v_existing.id is not null then
    if v_existing.source_transaction_id<>p_transaction_id or v_existing.outcome<>p_outcome or v_existing.amount<>p_amount
       or v_existing.target_invoice_id is distinct from p_target_invoice_id or v_existing.destination_account_id is distinct from p_destination_account_id
       or v_existing.occurred_at<>p_occurred_at or v_existing.benefit_payload<>p_benefit_allocations or v_existing.reason<>trim(p_reason)
    then raise exception 'idempotency key already used with different payload' using errcode='23505'; end if;
    return v_existing.id;
  end if;

  select * into tx from public.transactions where id=p_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null for update;
  if tx.id is null or tx.economic_state not in ('realized','reversed') then raise exception 'realized card expense required' using errcode='23514'; end if;
  select pi.card_id into v_card_id from public.transaction_payment_instruments pi where pi.household_id=p_household_id and pi.transaction_id=tx.id and pi.kind='card';
  if v_card_id is null then raise exception 'card expense required' using errcode='23514'; end if;
  if not exists(select 1 from public.funding_events f where f.household_id=p_household_id and f.financed_transaction_id=tx.id)
  then raise exception 'post-payment refund requires prior funding' using errcode='23514'; end if;
  if exists(select 1 from public.economic_allocations a where a.household_id=p_household_id and a.transaction_id=tx.id and a.responsible_party_id is not null and a.amount>0)
  then raise exception 'external responsibility requires a separate recovery route' using errcode='0A000'; end if;

  v_gross:=tx.realized_amount;
  select coalesce(sum(x.amount),0) into v_refunded_before from (
    select amount from public.card_refund_events where household_id=p_household_id and source_transaction_id=tx.id
    union all select amount from public.card_post_payment_refund_events where household_id=p_household_id and source_transaction_id=tx.id
    union all select amount from public.card_shared_post_payment_refund_events where household_id=p_household_id and source_transaction_id=tx.id
  ) x;
  v_current_net:=v_gross-v_refunded_before;
  if v_current_net<=0 or p_amount>v_current_net then raise exception 'refund exceeds remaining refundable amount' using errcode='23514'; end if;

  for v_allocation in select value from jsonb_array_elements(p_benefit_allocations) loop
    if not (v_allocation?'member_id') or (v_allocation->>'amount') is null or (v_allocation->>'percentage') is null
    then raise exception 'each refund benefit allocation requires member_id, amount and percentage' using errcode='23514'; end if;
    if not exists(select 1 from public.household_members where id=(v_allocation->>'member_id')::uuid and household_id=p_household_id and deactivated_at is null)
    then raise exception 'refund beneficiary must be an active household member' using errcode='23514'; end if;
    v_sum:=v_sum+(v_allocation->>'amount')::numeric; v_pct:=v_pct+(v_allocation->>'percentage')::numeric; v_count:=v_count+1;
    if v_count=1 then v_single_beneficiary:=(v_allocation->>'member_id')::uuid; else v_single_beneficiary:=null; end if;
  end loop;
  if v_sum<>p_amount or abs(v_pct-100)>0.000001 then raise exception 'refund benefit allocations must equal amount and 100 percent' using errcode='23514'; end if;
  if (select count(distinct (value->>'member_id')) from jsonb_array_elements(p_benefit_allocations))<>jsonb_array_length(p_benefit_allocations)
  then raise exception 'each refund beneficiary must appear once' using errcode='23514'; end if;

  if p_outcome='future_invoice_credit' then
    if p_target_invoice_id is null or p_destination_account_id is not null then raise exception 'future invoice target required' using errcode='22023'; end if;
    select * into v_target from public.card_invoices i where i.id=p_target_invoice_id and i.household_id=p_household_id and i.card_id=v_card_id and i.deleted_at is null and i.status not in ('paid','cancelled') for update;
    if v_target.id is null or v_target.competence_date<=date_trunc('month',p_occurred_at)::date then raise exception 'active future invoice of the same card required' using errcode='23514'; end if;
    if p_amount>greatest(v_target.total_amount-v_target.settled_amount-v_target.financed_balance,0) then raise exception 'refund exceeds future invoice outstanding amount' using errcode='23514'; end if;
    update public.card_invoices set total_amount=total_amount-p_amount,updated_at=now() where id=v_target.id;
  else
    if p_destination_account_id is null or p_target_invoice_id is not null then raise exception 'cash return destination required' using errcode='22023'; end if;
    if not exists(select 1 from public.accounts where id=p_destination_account_id and household_id=p_household_id and deactivated_at is null)
    then raise exception 'cash return destination must be an active household account' using errcode='23514'; end if;
  end if;

  create temporary table if not exists refund_member_deltas(member_id uuid primary key,before_amount numeric not null default 0,after_amount numeric not null default 0,benefit_amount numeric not null default 0,delta numeric not null default 0) on commit drop;
  truncate table refund_member_deltas;
  insert into refund_member_deltas(member_id,before_amount)
  select m.id,coalesce(sum(a.amount),0) from public.household_members m
  left join public.economic_allocations a on a.household_id=p_household_id and a.transaction_id=tx.id and a.responsible_member_id=m.id
  where m.household_id=p_household_id and m.deactivated_at is null group by m.id;
  for v_allocation in select value from jsonb_array_elements(p_benefit_allocations) loop
    update refund_member_deltas set benefit_amount=(v_allocation->>'amount')::numeric where member_id=(v_allocation->>'member_id')::uuid;
  end loop;

  insert into public.transactions(household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at,notes)
  values(p_household_id,caller.id,'adjustment','paid','realized','Estorno pos-pagamento: '||tx.description,p_amount,p_amount,p_amount,p_amount,p_occurred_at::date,date_trunc('month',p_occurred_at)::date,p_occurred_at,trim(p_reason)) returning id into v_refund_tx;
  insert into public.transaction_links(household_id,source_transaction_id,related_transaction_id,kind,amount) values(p_household_id,tx.id,v_refund_tx,'refund',p_amount);

  if p_outcome='cash_return' then
    insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,destination_account_id,beneficiary_member_id,related_transaction_id,movement_date,competence_date,notes,realized_at)
    values(p_household_id,caller.id,'refund','realized',p_amount,'Estorno pos-pagamento: '||tx.description,p_destination_account_id,v_single_beneficiary,tx.id,p_occurred_at::date,date_trunc('month',p_occurred_at)::date,trim(p_reason),p_occurred_at) returning id into v_movement;
  end if;

  insert into public.card_shared_post_payment_refund_events(household_id,source_transaction_id,outcome,target_invoice_id,destination_account_id,related_transaction_id,amount,benefit_payload,occurred_at,reason,request_key,created_by_member_id)
  values(p_household_id,tx.id,p_outcome,p_target_invoice_id,p_destination_account_id,v_refund_tx,p_amount,p_benefit_allocations,p_occurred_at,trim(p_reason),trim(p_request_key),caller.id) returning id into v_parent_event;
  for v_allocation in select value from jsonb_array_elements(p_benefit_allocations) loop
    insert into public.funding_recovery_events(household_id,shared_refund_event_id,source_transaction_id,beneficiary_member_id,amount,percentage)
    values(p_household_id,v_parent_event,tx.id,(v_allocation->>'member_id')::uuid,(v_allocation->>'amount')::numeric,(v_allocation->>'percentage')::numeric);
  end loop;

  v_refunded_after:=v_refunded_before+p_amount; v_net:=v_gross-v_refunded_after;
  insert into public.transaction_adjustment_events(household_id,source_transaction_id,related_transaction_id,kind,amount,before_payload,after_payload,reason,request_key,created_by_member_id,occurred_at)
  values(p_household_id,tx.id,v_refund_tx,'refund',p_amount,
    jsonb_build_object('refunded_total',v_refunded_before,'effective_expense_amount',v_current_net),
    jsonb_build_object('refunded_total',v_refunded_after,'effective_expense_amount',v_net,'outcome',p_outcome,'benefit_allocations',p_benefit_allocations,'target_invoice_id',p_target_invoice_id,'destination_account_id',p_destination_account_id,'movement_id',v_movement),
    trim(p_reason),'shared-post-card-adjustment:'||trim(p_request_key),caller.id,p_occurred_at);

  if v_net>0 then
    perform public.rescale_economic_allocations(tx.id,v_net);
    update refund_member_deltas d set after_amount=coalesce((select sum(a.amount) from public.economic_allocations a where a.household_id=p_household_id and a.transaction_id=tx.id and a.responsible_member_id=d.member_id),0);
  else
    update public.transactions set economic_state='reversed',status='refunded',updated_at=now() where id=tx.id;
    update public.member_settlement_events set state='cancelled',updated_at=now() where source_transaction_id=tx.id and state='projected' and kind='responsibility_funding';
  end if;

  update refund_member_deltas set delta=(before_amount-after_amount)-benefit_amount;
  if abs((select coalesce(sum(delta),0) from refund_member_deltas))>0.01 then raise exception 'refund redistribution does not close among household members' using errcode='23514'; end if;

  loop
    v_debtor:=null; v_creditor:=null;
    select member_id,-delta into v_debtor,v_debit from refund_member_deltas where delta<-0.004 order by delta,member_id limit 1;
    select member_id,delta into v_creditor,v_credit from refund_member_deltas where delta>0.004 order by delta desc,member_id limit 1;
    exit when v_debtor is null or v_creditor is null;
    v_effect:=round(least(v_debit,v_credit),2); exit when v_effect<=0;
    insert into public.member_settlement_events(household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,occurred_at,source_transaction_id,notes)
    values(p_household_id,caller.id,v_debtor,v_creditor,v_effect,'realized','adjustment',p_occurred_at::date,p_occurred_at,tx.id,'Redistribuicao por estorno pos-pagamento '||v_parent_event::text);
    update refund_member_deltas set delta=delta+v_effect where member_id=v_debtor;
    update refund_member_deltas set delta=delta-v_effect where member_id=v_creditor;
  end loop;
  return v_parent_event;
end $$;

comment on function public.record_shared_post_payment_card_refund(uuid,uuid,text,numeric,jsonb,uuid,uuid,timestamptz,text,text) is
  'Records a post-payment card refund with explicit benefit allocation. Original funding/history is immutable; the refund creates recovery and append-only settlement adjustments, never true income.';
revoke all on function public.record_shared_post_payment_card_refund(uuid,uuid,text,numeric,jsonb,uuid,uuid,timestamptz,text,text) from public,anon;
grant execute on function public.record_shared_post_payment_card_refund(uuid,uuid,text,numeric,jsonb,uuid,uuid,timestamptz,text,text) to authenticated;

create or replace view public.financial_shared_post_payment_card_refund_positions with (security_invoker=true) as
with refunds as (
  select household_id,source_transaction_id,coalesce(sum(amount),0)::numeric(19,2) refunded_amount from (
    select household_id,source_transaction_id,amount from public.card_refund_events
    union all select household_id,source_transaction_id,amount from public.card_post_payment_refund_events
    union all select household_id,source_transaction_id,amount from public.card_shared_post_payment_refund_events
  ) q group by household_id,source_transaction_id
)
select t.household_id,t.id transaction_id,t.description,t.transaction_date,t.realized_amount original_amount,
       coalesce(r.refunded_amount,0)::numeric(19,2) refunded_amount,greatest(t.realized_amount-coalesce(r.refunded_amount,0),0)::numeric(19,2) remaining_refundable_amount,
       pi.card_id,c.name card_name,
       coalesce((select jsonb_agg(jsonb_build_object('member_id',a.responsible_member_id,'amount',a.amount,'percentage',a.percentage) order by a.allocation_order) from public.economic_allocations a where a.household_id=t.household_id and a.transaction_id=t.id and a.responsible_member_id is not null and a.amount>0),'[]'::jsonb) responsibility_allocations,
       coalesce((select jsonb_agg(jsonb_build_object('funder_member_id',f.funder_member_id,'source_account_id',f.source_account_id,'amount',f.amount,'funded_at',f.funded_at) order by f.funded_at,f.id) from public.funding_events f where f.household_id=t.household_id and f.financed_transaction_id=t.id),'[]'::jsonb) original_funding_routes,
       coalesce((select jsonb_agg(jsonb_build_object('invoice_id',i.id,'invoice_month',i.competence_date,'due_date',i.due_date,'outstanding',greatest(i.total_amount-i.settled_amount-i.financed_balance,0)) order by i.competence_date) from public.card_invoices i where i.household_id=t.household_id and i.card_id=pi.card_id and i.deleted_at is null and i.status not in ('paid','cancelled') and i.competence_date>date_trunc('month',current_date)::date and i.total_amount>i.settled_amount+i.financed_balance),'[]'::jsonb) future_invoice_targets
from public.transactions t
join public.transaction_payment_instruments pi on pi.household_id=t.household_id and pi.transaction_id=t.id and pi.kind='card'
join public.cards c on c.id=pi.card_id and c.household_id=t.household_id and c.deactivated_at is null
left join refunds r on r.household_id=t.household_id and r.source_transaction_id=t.id
where t.type='expense' and t.deleted_at is null and t.economic_state in ('realized','reversed')
  and exists(select 1 from public.funding_events f where f.household_id=t.household_id and f.financed_transaction_id=t.id)
  and not exists(select 1 from public.economic_allocations a where a.household_id=t.household_id and a.transaction_id=t.id and a.responsible_party_id is not null and a.amount>0)
  and exists(select 1 from public.economic_allocations a where a.household_id=t.household_id and a.transaction_id=t.id and a.responsible_member_id is not null and a.amount>0)
  and greatest(t.realized_amount-coalesce(r.refunded_amount,0),0)>0;

comment on view public.financial_shared_post_payment_card_refund_positions is
  'Post-payment card purchases eligible for explicit household-member refund redistribution, including shared responsibility, different beneficiary, multiple funders and different cash destination account.';
revoke all on public.financial_shared_post_payment_card_refund_positions from public,anon;
grant select on public.financial_shared_post_payment_card_refund_positions to authenticated;
