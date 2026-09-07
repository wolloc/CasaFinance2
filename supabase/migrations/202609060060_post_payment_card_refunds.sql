-- Etapa 10AP: estorno de cartão depois do pagamento.
-- O Casa distingue crédito em fatura futura de dinheiro realmente devolvido.
-- Esta primeira rota pós-pagamento é conservadora: só aceita compras sem ambiguidade
-- entre responsável econômico e financiador. Casos compartilhados exigem uma rota
-- posterior de redistribuição explícita do benefício do estorno.

create table if not exists public.card_post_payment_refund_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_transaction_id uuid not null references public.transactions(id) on delete restrict,
  outcome text not null check(outcome in ('future_invoice_credit','cash_return')),
  beneficiary_member_id uuid not null references public.household_members(id) on delete restrict,
  target_invoice_id uuid references public.card_invoices(id) on delete restrict,
  destination_account_id uuid references public.accounts(id) on delete restrict,
  related_transaction_id uuid not null references public.transactions(id) on delete restrict,
  amount numeric(19,2) not null check(amount>0),
  occurred_at timestamptz not null,
  reason text not null,
  request_key text not null,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(household_id,request_key),
  check((outcome='future_invoice_credit' and target_invoice_id is not null and destination_account_id is null)
     or (outcome='cash_return' and destination_account_id is not null and target_invoice_id is null))
);

alter table public.card_post_payment_refund_events enable row level security;
drop policy if exists card_post_payment_refund_events_select on public.card_post_payment_refund_events;
create policy card_post_payment_refund_events_select on public.card_post_payment_refund_events for select to authenticated
using(public.is_active_household_member(household_id));
revoke all on public.card_post_payment_refund_events from public,anon;
grant select on public.card_post_payment_refund_events to authenticated;

create or replace function public.record_post_payment_card_refund(
  p_household_id uuid,
  p_transaction_id uuid,
  p_outcome text,
  p_amount numeric,
  p_beneficiary_member_id uuid,
  p_target_invoice_id uuid default null,
  p_destination_account_id uuid default null,
  p_occurred_at timestamptz default now(),
  p_reason text default 'Estorno pós-pagamento',
  p_request_key text default null
)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  caller public.household_members; tx public.transactions; v_card_id uuid; v_funder uuid; v_account uuid;
  v_funder_count integer; v_account_count integer; v_responsible uuid; v_responsible_count integer;
  v_refunded_before numeric; v_refunded_after numeric; v_gross numeric; v_net numeric;
  v_target public.card_invoices; v_refund_tx uuid; v_event uuid; v_movement uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if p_outcome not in ('future_invoice_credit','cash_return') or p_amount<=0 or p_occurred_at is null
     or length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'invalid post-payment refund command' using errcode='22023'; end if;
  if not exists(select 1 from public.household_members where id=p_beneficiary_member_id and household_id=p_household_id and deactivated_at is null)
  then raise exception 'beneficiary must be active in household' using errcode='23514'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':post-card-refund:'||trim(p_request_key),0));
  if exists(select 1 from public.card_post_payment_refund_events where household_id=p_household_id and request_key=trim(p_request_key)) then
    select id into v_event from public.card_post_payment_refund_events where household_id=p_household_id and request_key=trim(p_request_key);
    return v_event;
  end if;

  select * into tx from public.transactions where id=p_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null for update;
  if tx.id is null or tx.economic_state not in ('realized','reversed') then raise exception 'realized expense required' using errcode='23514'; end if;
  select pi.card_id into v_card_id from public.transaction_payment_instruments pi where pi.household_id=p_household_id and pi.transaction_id=tx.id and pi.kind='card';
  if v_card_id is null then raise exception 'card expense required' using errcode='0A000'; end if;

  select count(distinct f.funder_member_id),min(f.funder_member_id::text)::uuid,count(distinct f.source_account_id),min(f.source_account_id::text)::uuid
    into v_funder_count,v_funder,v_account_count,v_account
  from public.funding_events f where f.household_id=p_household_id and f.financed_transaction_id=tx.id;
  if v_funder_count<>1 or v_account_count<>1 or v_funder is null or v_account is null
  then raise exception 'shared or multi-route funding requires explicit refund redistribution' using errcode='0A000'; end if;

  select count(*),min(a.responsible_member_id::text)::uuid into v_responsible_count,v_responsible
  from public.economic_allocations a
  where a.household_id=p_household_id and a.transaction_id=tx.id and a.responsible_member_id is not null and a.amount>0;
  if exists(select 1 from public.economic_allocations a where a.household_id=p_household_id and a.transaction_id=tx.id and a.responsible_party_id is not null and a.amount>0)
     or v_responsible_count<>1 or v_responsible is distinct from v_funder or p_beneficiary_member_id is distinct from v_funder
  then raise exception 'refund beneficiary differs from the unambiguous original responsible funder' using errcode='0A000'; end if;

  v_gross:=tx.realized_amount;
  select coalesce(sum(x.amount),0) into v_refunded_before from (
    select amount from public.card_refund_events where household_id=p_household_id and source_transaction_id=tx.id
    union all
    select amount from public.card_post_payment_refund_events where household_id=p_household_id and source_transaction_id=tx.id
  ) x;
  if v_refunded_before>=v_gross or p_amount>v_gross-v_refunded_before then raise exception 'refund exceeds remaining refundable amount' using errcode='23514'; end if;
  v_refunded_after:=v_refunded_before+p_amount; v_net:=v_gross-v_refunded_after;

  if p_outcome='future_invoice_credit' then
    if p_target_invoice_id is null or p_destination_account_id is not null then raise exception 'future invoice target required' using errcode='22023'; end if;
    select * into v_target from public.card_invoices i where i.id=p_target_invoice_id and i.household_id=p_household_id and i.card_id=v_card_id and i.deleted_at is null and i.status not in ('paid','cancelled') for update;
    if v_target.id is null or v_target.competence_date<=date_trunc('month',p_occurred_at)::date
    then raise exception 'an active future invoice of the same card is required' using errcode='23514'; end if;
    if p_amount>greatest(v_target.total_amount-v_target.settled_amount-v_target.financed_balance,0)
    then raise exception 'refund exceeds future invoice outstanding amount' using errcode='23514'; end if;
    update public.card_invoices set total_amount=total_amount-p_amount,updated_at=now() where id=v_target.id;
  else
    if p_destination_account_id is null or p_target_invoice_id is not null then raise exception 'cash return destination required' using errcode='22023'; end if;
    if p_destination_account_id is distinct from v_account then raise exception 'cash return must use the original unambiguous funding account in this safe route' using errcode='0A000'; end if;
  end if;

  insert into public.transactions(household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at,notes)
  values(p_household_id,caller.id,'adjustment','paid','realized','Estorno pós-pagamento: '||tx.description,p_amount,p_amount,p_amount,p_amount,p_occurred_at::date,date_trunc('month',p_occurred_at)::date,p_occurred_at,trim(p_reason)) returning id into v_refund_tx;
  insert into public.transaction_links(household_id,source_transaction_id,related_transaction_id,kind,amount) values(p_household_id,tx.id,v_refund_tx,'refund',p_amount);

  if p_outcome='cash_return' then
    insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,destination_account_id,beneficiary_member_id,related_transaction_id,movement_date,competence_date,notes,realized_at)
    values(p_household_id,caller.id,'refund','realized',p_amount,'Estorno pós-pagamento: '||tx.description,p_destination_account_id,p_beneficiary_member_id,tx.id,p_occurred_at::date,date_trunc('month',p_occurred_at)::date,trim(p_reason),p_occurred_at) returning id into v_movement;
  end if;

  insert into public.card_post_payment_refund_events(household_id,source_transaction_id,outcome,beneficiary_member_id,target_invoice_id,destination_account_id,related_transaction_id,amount,occurred_at,reason,request_key,created_by_member_id)
  values(p_household_id,tx.id,p_outcome,p_beneficiary_member_id,p_target_invoice_id,p_destination_account_id,v_refund_tx,p_amount,p_occurred_at,trim(p_reason),trim(p_request_key),caller.id) returning id into v_event;
  insert into public.transaction_adjustment_events(household_id,source_transaction_id,related_transaction_id,kind,amount,before_payload,after_payload,reason,request_key,created_by_member_id,occurred_at)
  values(p_household_id,tx.id,v_refund_tx,'refund',p_amount,
    jsonb_build_object('refunded_total',v_refunded_before,'effective_expense_amount',v_gross-v_refunded_before),
    jsonb_build_object('refunded_total',v_refunded_after,'effective_expense_amount',v_net,'outcome',p_outcome,'beneficiary_member_id',p_beneficiary_member_id,'target_invoice_id',p_target_invoice_id,'destination_account_id',p_destination_account_id,'movement_id',v_movement),
    trim(p_reason),'post-card-adjustment:'||trim(p_request_key),caller.id,p_occurred_at);

  if v_net>0 then perform public.rescale_economic_allocations(tx.id,v_net);
  else update public.transactions set economic_state='reversed',status='refunded',updated_at=now() where id=tx.id; end if;
  return v_event;
end $$;

create or replace view public.financial_post_payment_card_refund_positions with (security_invoker=true) as
with funding as (
  select household_id,financed_transaction_id,count(distinct funder_member_id) funder_count,min(funder_member_id::text)::uuid funder_member_id,
         count(distinct source_account_id) account_count,min(source_account_id::text)::uuid source_account_id,coalesce(sum(amount),0)::numeric(19,2) funded_amount
  from public.funding_events group by household_id,financed_transaction_id
), responsibility as (
  select household_id,transaction_id,count(*) filter(where responsible_member_id is not null and amount>0) member_count,
         min(responsible_member_id::text)::uuid responsible_member_id,
         count(*) filter(where responsible_party_id is not null and amount>0) party_count
  from public.economic_allocations group by household_id,transaction_id
), refunds as (
  select household_id,source_transaction_id,coalesce(sum(amount),0)::numeric(19,2) refunded_amount from (
    select household_id,source_transaction_id,amount from public.card_refund_events
    union all select household_id,source_transaction_id,amount from public.card_post_payment_refund_events
  ) q group by household_id,source_transaction_id
)
select t.household_id,t.id transaction_id,t.description,t.transaction_date,t.realized_amount original_amount,
       coalesce(r.refunded_amount,0)::numeric(19,2) refunded_amount,greatest(t.realized_amount-coalesce(r.refunded_amount,0),0)::numeric(19,2) remaining_refundable_amount,
       pi.card_id,c.name card_name,f.funder_member_id beneficiary_member_id,f.source_account_id original_funding_account_id,a.name original_funding_account_name,
       coalesce((select jsonb_agg(jsonb_build_object('invoice_id',i.id,'invoice_month',i.competence_date,'due_date',i.due_date,'outstanding',greatest(i.total_amount-i.settled_amount-i.financed_balance,0)) order by i.competence_date)
         from public.card_invoices i where i.household_id=t.household_id and i.card_id=pi.card_id and i.deleted_at is null and i.status not in ('paid','cancelled') and i.competence_date>date_trunc('month',current_date)::date and i.total_amount>i.settled_amount+i.financed_balance),'[]'::jsonb) future_invoice_targets
from public.transactions t
join public.transaction_payment_instruments pi on pi.household_id=t.household_id and pi.transaction_id=t.id and pi.kind='card'
join public.cards c on c.id=pi.card_id and c.household_id=t.household_id and c.deactivated_at is null
join funding f on f.household_id=t.household_id and f.financed_transaction_id=t.id and f.funder_count=1 and f.account_count=1 and f.funded_amount>0
join responsibility rp on rp.household_id=t.household_id and rp.transaction_id=t.id and rp.member_count=1 and rp.party_count=0 and rp.responsible_member_id=f.funder_member_id
left join refunds r on r.household_id=t.household_id and r.source_transaction_id=t.id
left join public.accounts a on a.id=f.source_account_id and a.household_id=t.household_id
where t.type='expense' and t.deleted_at is null and t.economic_state in ('realized','reversed')
  and greatest(t.realized_amount-coalesce(r.refunded_amount,0),0)>0;

comment on view public.financial_post_payment_card_refund_positions is
  'Safe post-payment card refunds only when original responsibility, funder and funding account are unambiguous. Outcome is explicitly future-invoice credit or actual cash return; neither is true income.';

revoke all on function public.record_post_payment_card_refund(uuid,uuid,text,numeric,uuid,uuid,uuid,timestamptz,text,text) from public,anon;
grant execute on function public.record_post_payment_card_refund(uuid,uuid,text,numeric,uuid,uuid,uuid,timestamptz,text,text) to authenticated;
revoke all on public.financial_post_payment_card_refund_positions from public,anon;
grant select on public.financial_post_payment_card_refund_positions to authenticated;
