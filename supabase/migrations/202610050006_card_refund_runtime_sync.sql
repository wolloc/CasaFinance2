-- Etapa 10AO: estorno de compra no cartão como crédito explícito em fatura/parcela.
-- Refund reduz o efeito econômico do gasto e a obrigação do cartão, mas não cria renda nem caixa.
-- A fatura/parcela afetada é escolhida explicitamente; o Casa não presume como o emissor tratou a devolução.

create table if not exists public.card_refund_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_transaction_id uuid not null references public.transactions(id) on delete restrict,
  target_invoice_id uuid not null references public.card_invoices(id) on delete restrict,
  target_installment_id uuid references public.installments(id) on delete restrict,
  related_transaction_id uuid not null references public.transactions(id) on delete restrict,
  amount numeric(19,2) not null check(amount>0),
  occurred_at timestamptz not null,
  reason text not null,
  request_key text not null,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(household_id,request_key)
);

alter table public.card_refund_events enable row level security;
drop policy if exists card_refund_events_select on public.card_refund_events;
create policy card_refund_events_select on public.card_refund_events for select to authenticated
using(public.is_active_household_member(household_id));
revoke all on public.card_refund_events from public,anon;
grant select on public.card_refund_events to authenticated;

create or replace function public.record_card_invoice_credit_refund(
  p_household_id uuid,
  p_transaction_id uuid,
  p_target_invoice_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
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
  inv public.card_invoices;
  card_id uuid;
  plan_id uuid;
  target_installment public.installments;
  existing public.card_refund_events;
  refund_tx uuid;
  event_id uuid;
  gross_amount numeric;
  refunded_before numeric;
  refunded_after numeric;
  net_after numeric;
  already_funded numeric;
  invoice_outstanding numeric;
begin
  caller:=public.require_active_member(p_household_id);
  if p_amount<=0 or p_occurred_at is null or length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'invalid card refund command' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':card-refund:'||trim(p_request_key),0));
  select * into existing from public.card_refund_events where household_id=p_household_id and request_key=trim(p_request_key);
  if existing.id is not null then
    if existing.source_transaction_id<>p_transaction_id or existing.target_invoice_id<>p_target_invoice_id
       or existing.amount<>p_amount or existing.occurred_at<>p_occurred_at or existing.reason<>trim(p_reason)
    then raise exception 'idempotency key already used with different payload' using errcode='23505'; end if;
    return existing.id;
  end if;

  select t.* into tx
  from public.transactions t
  where t.id=p_transaction_id and t.household_id=p_household_id and t.type='expense' and t.deleted_at is null
  for update;
  if tx.id is null or tx.economic_state not in ('realized','reversed') or tx.status in ('cancelled')
  then raise exception 'realized card expense required' using errcode='23514'; end if;

  select pi.card_id into card_id
  from public.transaction_payment_instruments pi
  where pi.household_id=p_household_id and pi.transaction_id=tx.id and pi.kind='card';
  if card_id is null then raise exception 'card expense required' using errcode='0A000'; end if;
  if exists(select 1 from public.external_payment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations o where o.household_id=p_household_id and o.source_transaction_id=tx.id)
  then raise exception 'external payer or obligation refund requires a dedicated route' using errcode='0A000'; end if;

  select ci.* into inv from public.card_invoices ci
  where ci.id=p_target_invoice_id and ci.household_id=p_household_id and ci.card_id=card_id and ci.deleted_at is null
  for update;
  if inv.id is null or inv.status in ('paid','cancelled') then raise exception 'active target invoice required' using errcode='23514'; end if;
  invoice_outstanding:=greatest(inv.total_amount-inv.settled_amount-inv.financed_balance,0);
  if p_amount>invoice_outstanding then raise exception 'refund exceeds unpaid target invoice amount' using errcode='23514'; end if;

  select ip.id into plan_id from public.installment_plans ip
  where ip.household_id=p_household_id and ip.purchase_transaction_id=tx.id;
  if plan_id is null then
    if tx.invoice_id is distinct from inv.id then raise exception 'single card purchase refund must credit its purchase invoice' using errcode='0A000'; end if;
    select coalesce(sum(f.amount),0) into already_funded from public.funding_events f
    where f.household_id=p_household_id and f.financed_transaction_id=tx.id and f.invoice_id=inv.id;
    if already_funded>0 then raise exception 'already funded card purchase requires a post-payment credit route' using errcode='0A000'; end if;
  else
    select i.* into target_installment from public.installments i
    where i.household_id=p_household_id and i.installment_plan_id=plan_id and i.invoice_id=inv.id and i.status not in ('cancelled','refunded')
    for update;
    if target_installment.id is null then raise exception 'target invoice must contain an active installment from this purchase' using errcode='0A000'; end if;
    select coalesce(sum(f.amount),0) into already_funded from public.funding_events f
    where f.household_id=p_household_id and f.financed_transaction_id=tx.id and f.invoice_id=inv.id and f.installment_id=target_installment.id;
    if already_funded>0 then raise exception 'already funded installment requires a post-payment credit route' using errcode='0A000'; end if;
    if p_amount>target_installment.amount then raise exception 'refund exceeds target installment amount' using errcode='23514'; end if;
  end if;

  gross_amount:=tx.realized_amount;
  select coalesce(sum(r.amount),0) into refunded_before from public.card_refund_events r
  where r.household_id=p_household_id and r.source_transaction_id=tx.id;
  if refunded_before>=gross_amount or p_amount>gross_amount-refunded_before
  then raise exception 'refund exceeds remaining refundable purchase amount' using errcode='23514'; end if;
  refunded_after:=refunded_before+p_amount;
  net_after:=gross_amount-refunded_after;

  insert into public.transactions(
    household_id,created_by_member_id,type,status,economic_state,description,amount,
    estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at,notes
  ) values (
    p_household_id,caller.id,'adjustment','paid','realized','Crédito de estorno no cartão: '||tx.description,p_amount,
    p_amount,p_amount,p_amount,p_occurred_at::date,date_trunc('month',p_occurred_at)::date,p_occurred_at,trim(p_reason)
  ) returning id into refund_tx;

  insert into public.transaction_links(household_id,source_transaction_id,related_transaction_id,kind,amount)
  values(p_household_id,tx.id,refund_tx,'refund',p_amount);

  insert into public.card_refund_events(
    household_id,source_transaction_id,target_invoice_id,target_installment_id,related_transaction_id,
    amount,occurred_at,reason,request_key,created_by_member_id
  ) values (
    p_household_id,tx.id,inv.id,target_installment.id,refund_tx,p_amount,p_occurred_at,trim(p_reason),trim(p_request_key),caller.id
  ) returning id into event_id;

  insert into public.transaction_adjustment_events(
    household_id,source_transaction_id,related_transaction_id,kind,amount,before_payload,after_payload,
    reason,request_key,created_by_member_id,occurred_at
  ) values (
    p_household_id,tx.id,refund_tx,'refund',p_amount,
    jsonb_build_object('refunded_total',refunded_before,'effective_expense_amount',gross_amount-refunded_before,'target_invoice_id',inv.id),
    jsonb_build_object('refunded_total',refunded_after,'effective_expense_amount',net_after,'target_invoice_id',inv.id,'target_installment_id',target_installment.id),
    trim(p_reason),'card-adjustment:'||trim(p_request_key),caller.id,p_occurred_at
  );

  update public.card_invoices set
    total_amount=total_amount-p_amount,
    status=case when total_amount-p_amount=settled_amount+financed_balance then 'paid' else status end,
    settled_at=case when total_amount-p_amount=settled_amount+financed_balance then coalesce(settled_at,p_occurred_at) else settled_at end,
    updated_at=now()
  where id=inv.id;

  if plan_id is not null then
    if p_amount=target_installment.amount then
      update public.installments set status='refunded',settled_at=p_occurred_at where id=target_installment.id;
    else
      update public.installments set amount=amount-p_amount where id=target_installment.id;
    end if;
  end if;

  if net_after>0 then
    perform public.rescale_economic_allocations(tx.id,net_after);
  else
    update public.transactions set economic_state='reversed',status='refunded',updated_at=now() where id=tx.id;
  end if;
  return event_id;
end
$$;

create or replace view public.financial_card_refund_positions
with (security_invoker=true) as
with refund_totals as (
  select household_id,source_transaction_id,coalesce(sum(amount),0)::numeric(19,2) refunded_amount,max(occurred_at) last_refunded_at
  from public.card_refund_events group by household_id,source_transaction_id
), plan as (
  select ip.household_id,ip.purchase_transaction_id,ip.id plan_id,ip.installment_count
  from public.installment_plans ip
)
select t.household_id,t.id transaction_id,t.description,t.transaction_date,
       t.realized_amount::numeric(19,2) original_amount,
       coalesce(r.refunded_amount,0)::numeric(19,2) refunded_amount,
       greatest(t.realized_amount-coalesce(r.refunded_amount,0),0)::numeric(19,2) remaining_refundable_amount,
       r.last_refunded_at,pi.card_id,c.name card_name,coalesce(p.installment_count,1) installment_count,
       case when p.plan_id is null then jsonb_build_array(jsonb_build_object(
              'invoice_id',inv.id,'invoice_month',inv.competence_date,'due_date',inv.due_date,'installment_id',null,'installment_number',null,
              'commitment_amount',greatest(t.realized_amount-coalesce(r.refunded_amount,0),0),
              'invoice_outstanding',greatest(inv.total_amount-inv.settled_amount-inv.financed_balance,0)
            ))
            else coalesce((select jsonb_agg(jsonb_build_object(
              'invoice_id',ii.id,'invoice_month',ii.competence_date,'due_date',ii.due_date,'installment_id',ins.id,'installment_number',ins.number,
              'commitment_amount',case when ins.status='refunded' then 0 else ins.amount end,
              'invoice_outstanding',greatest(ii.total_amount-ii.settled_amount-ii.financed_balance,0)
            ) order by ins.number)
            from public.installments ins join public.card_invoices ii on ii.id=ins.invoice_id and ii.household_id=ins.household_id
            where ins.household_id=t.household_id and ins.installment_plan_id=p.plan_id and ins.status not in ('cancelled','refunded')
              and ii.deleted_at is null and ii.status not in ('paid','cancelled')
              and not exists(select 1 from public.funding_events f where f.household_id=t.household_id and f.financed_transaction_id=t.id and f.invoice_id=ii.id and f.installment_id=ins.id)
            ),'[]'::jsonb) end eligible_invoice_targets
from public.transactions t
join public.transaction_payment_instruments pi on pi.household_id=t.household_id and pi.transaction_id=t.id and pi.kind='card'
join public.cards c on c.id=pi.card_id and c.household_id=t.household_id and c.deactivated_at is null
left join refund_totals r on r.household_id=t.household_id and r.source_transaction_id=t.id
left join plan p on p.household_id=t.household_id and p.purchase_transaction_id=t.id
left join public.card_invoices inv on inv.id=t.invoice_id and inv.household_id=t.household_id and inv.deleted_at is null and inv.status not in ('paid','cancelled')
where t.type='expense' and t.deleted_at is null and t.economic_state in ('realized','reversed')
  and t.status not in ('cancelled')
  and not exists(select 1 from public.external_payment_events e where e.household_id=t.household_id and e.source_transaction_id=t.id)
  and not exists(select 1 from public.financial_obligations o where o.household_id=t.household_id and o.source_transaction_id=t.id);

comment on view public.financial_card_refund_positions is
  'Card purchase refund position. Refund is an economic reversal plus an explicit invoice/installment credit, never true income or account cash. Only unfunded purchase commitments are offered in this first safe route.';


create or replace view public.financial_card_refund_positions
with (security_invoker=true) as
with refund_totals as (
  select household_id,source_transaction_id,coalesce(sum(amount),0)::numeric(19,2) refunded_amount,max(occurred_at) last_refunded_at
  from public.card_refund_events group by household_id,source_transaction_id
), plan as (
  select ip.household_id,ip.purchase_transaction_id,ip.id plan_id,ip.installment_count
  from public.installment_plans ip
)
select t.household_id,t.id transaction_id,t.description,t.transaction_date,
       t.realized_amount::numeric(19,2) original_amount,
       coalesce(r.refunded_amount,0)::numeric(19,2) refunded_amount,
       greatest(t.realized_amount-coalesce(r.refunded_amount,0),0)::numeric(19,2) remaining_refundable_amount,
       r.last_refunded_at,pi.card_id,c.name card_name,coalesce(p.installment_count,1) installment_count,
       case when p.plan_id is null then jsonb_build_array(jsonb_build_object(
              'invoice_id',inv.id,'invoice_month',inv.competence_date,'due_date',inv.due_date,'installment_id',null,'installment_number',null,
              'commitment_amount',greatest(t.realized_amount-coalesce(r.refunded_amount,0),0),
              'invoice_outstanding',greatest(inv.total_amount-inv.settled_amount-inv.financed_balance,0)
            ))
            else coalesce((select jsonb_agg(jsonb_build_object(
              'invoice_id',ii.id,'invoice_month',ii.competence_date,'due_date',ii.due_date,'installment_id',ins.id,'installment_number',ins.number,
              'commitment_amount',case when ins.status='refunded' then 0 else ins.amount end,
              'invoice_outstanding',greatest(ii.total_amount-ii.settled_amount-ii.financed_balance,0)
            ) order by ins.number)
            from public.installments ins join public.card_invoices ii on ii.id=ins.invoice_id and ii.household_id=ins.household_id
            where ins.household_id=t.household_id and ins.installment_plan_id=p.plan_id and ins.status not in ('cancelled','refunded')
              and ii.deleted_at is null and ii.status not in ('paid','cancelled')
              and not exists(select 1 from public.funding_events f where f.household_id=t.household_id and f.financed_transaction_id=t.id and f.invoice_id=ii.id and f.installment_id=ins.id)
            ),'[]'::jsonb) end eligible_invoice_targets
from public.transactions t
join public.transaction_payment_instruments pi on pi.household_id=t.household_id and pi.transaction_id=t.id and pi.kind='card'
join public.cards c on c.id=pi.card_id and c.household_id=t.household_id and c.deactivated_at is null
left join refund_totals r on r.household_id=t.household_id and r.source_transaction_id=t.id
left join plan p on p.household_id=t.household_id and p.purchase_transaction_id=t.id
left join public.card_invoices inv on inv.id=t.invoice_id and inv.household_id=t.household_id and inv.deleted_at is null and inv.status not in ('paid','cancelled')
where t.type='expense' and t.deleted_at is null and t.economic_state in ('realized','reversed')
  and t.status not in ('cancelled')
  and not exists(select 1 from public.external_payment_events e where e.household_id=t.household_id and e.source_transaction_id=t.id)
  and not exists(select 1 from public.financial_obligations o where o.household_id=t.household_id and o.source_transaction_id=t.id);

comment on view public.financial_card_refund_positions is
  'Card purchase refund position. Refund is an economic reversal plus an explicit invoice/installment credit, never true income or account cash. Only unfunded purchase commitments are offered in this first safe route.';

-- Expense story becomes refund-aware for direct and card refunds without changing the original gross fact.
create or replace view public.financial_expense_story_positions
with (security_invoker=true) as
with responsibility as (
  select a.household_id,a.transaction_id,
    coalesce(jsonb_agg(jsonb_build_object('member_id',a.responsible_member_id,'party_id',a.responsible_party_id,'amount',a.amount,'percentage',a.percentage) order by a.allocation_order),'[]'::jsonb) responsibility_breakdown
  from public.economic_allocations a group by a.household_id,a.transaction_id
), member_funding as (
  select f.household_id,f.financed_transaction_id transaction_id,coalesce(sum(f.amount),0)::numeric(19,2) member_funded_amount,
    coalesce(jsonb_agg(jsonb_build_object('funder_member_id',f.funder_member_id,'source_account_id',f.source_account_id,'amount',f.amount,'funded_at',f.funded_at,'invoice_id',f.invoice_id,'installment_id',f.installment_id) order by f.funded_at,f.id),'[]'::jsonb) funding_breakdown
  from public.funding_events f group by f.household_id,f.financed_transaction_id
), external_funding as (
  select e.household_id,e.source_transaction_id transaction_id,coalesce(sum(e.amount),0)::numeric(19,2) external_paid_amount,
    coalesce(jsonb_agg(jsonb_build_object('payer_party_id',e.payer_party_id,'intent',e.intent,'amount',e.amount,'occurred_at',e.occurred_at,'payable_obligation_id',e.payable_obligation_id) order by e.occurred_at,e.id),'[]'::jsonb) external_payment_breakdown
  from public.external_payment_events e group by e.household_id,e.source_transaction_id
), settlements as (
  select s.household_id,s.source_transaction_id transaction_id,
    coalesce(jsonb_agg(jsonb_build_object('debtor_member_id',s.debtor_member_id,'creditor_member_id',s.creditor_member_id,'amount',s.amount,'state',s.state,'kind',s.kind,'financial_date',s.financial_date,'occurred_at',s.occurred_at) order by s.financial_date,s.created_at,s.id) filter(where s.state in ('projected','realized')),'[]'::jsonb) settlement_breakdown
  from public.member_settlement_events s where s.source_transaction_id is not null group by s.household_id,s.source_transaction_id
), refunds as (
  select household_id,source_transaction_id,coalesce(sum(amount),0)::numeric(19,2) refunded_amount
  from public.transaction_adjustment_events where kind='refund' group by household_id,source_transaction_id
), base as (
  select t.*,public.financial_effective_total_amount(t.economic_state,t.estimated_amount,t.confirmed_amount,t.realized_amount,t.amount)::numeric(19,2) gross_effective_amount
  from public.transactions t where t.type='expense' and t.deleted_at is null
)
select t.household_id,t.id transaction_id,t.amount::numeric(19,2) economic_amount,
       greatest(t.gross_effective_amount-coalesce(ref.refunded_amount,0),0)::numeric(19,2) effective_amount,
       coalesce(r.responsibility_breakdown,'[]'::jsonb) responsibility_breakdown,
       coalesce(m.member_funded_amount,0)::numeric(19,2) member_funded_amount,
       coalesce(x.external_paid_amount,0)::numeric(19,2) external_paid_amount,
       greatest(t.gross_effective_amount-coalesce(ref.refunded_amount,0)-coalesce(m.member_funded_amount,0)-coalesce(x.external_paid_amount,0),0)::numeric(19,2) remaining_to_fund,
       coalesce(m.funding_breakdown,'[]'::jsonb) funding_breakdown,
       coalesce(x.external_payment_breakdown,'[]'::jsonb) external_payment_breakdown,
       coalesce(s.settlement_breakdown,'[]'::jsonb) settlement_breakdown,
       coalesce(ref.refunded_amount,0)::numeric(19,2) refunded_amount
from base t
left join responsibility r on r.household_id=t.household_id and r.transaction_id=t.id
left join member_funding m on m.household_id=t.household_id and m.transaction_id=t.id
left join external_funding x on x.household_id=t.household_id and x.transaction_id=t.id
left join settlements s on s.household_id=t.household_id and s.transaction_id=t.id
left join refunds ref on ref.household_id=t.household_id and ref.source_transaction_id=t.id;


revoke all on function public.record_card_invoice_credit_refund(uuid,uuid,uuid,numeric,timestamptz,text,text) from public,anon;
grant execute on function public.record_card_invoice_credit_refund(uuid,uuid,uuid,numeric,timestamptz,text,text) to authenticated;
grant select on public.financial_card_refund_positions to authenticated;
grant select on public.financial_expense_story_positions to authenticated;
grant select on public.financial_card_journey_positions to authenticated;