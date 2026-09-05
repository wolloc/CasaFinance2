-- Etapa 10H.8: canonical member financial perspectives.
-- Facts persist; liquidity, responsibility, funding routes and projections derive.

do $$ begin
  create type public.commitment_funding_plan_state as enum ('active','cancelled','replaced');
exception when duplicate_object then null; end $$;

create table public.commitment_funding_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  source_account_id uuid not null references public.accounts(id) on delete restrict,
  transaction_id uuid references public.transactions(id) on delete restrict,
  installment_id uuid references public.installments(id) on delete restrict,
  obligation_id uuid references public.financial_obligations(id) on delete restrict,
  recurring_occurrence_id uuid references public.recurring_occurrences(id) on delete restrict,
  recurring_rule_id uuid references public.recurring_rules(id) on delete restrict,
  amount numeric(19,2) not null check(amount>0),
  state public.commitment_funding_plan_state not null default 'active',
  idempotency_key text not null check(length(trim(idempotency_key))>0),
  replaces_plan_id uuid references public.commitment_funding_plans(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check(num_nonnulls(transaction_id,installment_id,obligation_id,recurring_occurrence_id,recurring_rule_id)=1),
  check((state='active')=(cancelled_at is null)),
  unique(household_id,idempotency_key)
);
create index commitment_funding_plans_active_transaction on public.commitment_funding_plans(household_id,transaction_id) where state='active';
create index commitment_funding_plans_active_installment on public.commitment_funding_plans(household_id,installment_id) where state='active';
create index commitment_funding_plans_active_obligation on public.commitment_funding_plans(household_id,obligation_id) where state='active';
create index commitment_funding_plans_active_occurrence on public.commitment_funding_plans(household_id,recurring_occurrence_id) where state='active';
create index commitment_funding_plans_active_rule on public.commitment_funding_plans(household_id,recurring_rule_id) where state='active';

comment on table public.commitment_funding_plans is
  'Optional explicit future funding-route overrides. Instrument-selected accounts and card defaults remain dynamically derived fallbacks; plans are never evidence of realized funding.';

create or replace function public.assert_commitment_funding_plan_links()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare h uuid:=new.household_id;
begin
  if not exists(select 1 from public.household_members m where m.id=new.created_by_member_id and m.household_id=h and m.deactivated_at is null)
     or not exists(select 1 from public.accounts a where a.id=new.source_account_id and a.household_id=h and a.deactivated_at is null)
  then raise exception 'plan creator and source account must be active in household' using errcode='23514'; end if;
  if new.transaction_id is not null and not exists(select 1 from public.transactions x where x.id=new.transaction_id and x.household_id=h and x.deleted_at is null) then raise exception 'plan transaction belongs to another household' using errcode='23514'; end if;
  if new.installment_id is not null and not exists(select 1 from public.installments x where x.id=new.installment_id and x.household_id=h) then raise exception 'plan installment belongs to another household' using errcode='23514'; end if;
  if new.obligation_id is not null and not exists(select 1 from public.financial_obligations x where x.id=new.obligation_id and x.household_id=h) then raise exception 'plan obligation belongs to another household' using errcode='23514'; end if;
  if new.recurring_occurrence_id is not null and not exists(select 1 from public.recurring_occurrences x where x.id=new.recurring_occurrence_id and x.household_id=h) then raise exception 'plan occurrence belongs to another household' using errcode='23514'; end if;
  if new.recurring_rule_id is not null and not exists(select 1 from public.recurring_rules x where x.id=new.recurring_rule_id and x.household_id=h and x.deactivated_at is null) then raise exception 'plan rule belongs to another household' using errcode='23514'; end if;
  if new.replaces_plan_id is not null and not exists(select 1 from public.commitment_funding_plans x where x.id=new.replaces_plan_id and x.household_id=h) then raise exception 'replaced plan belongs to another household' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function public.assert_commitment_funding_plan_links() from public,anon,authenticated;
create trigger commitment_funding_plan_links before insert or update on public.commitment_funding_plans for each row execute function public.assert_commitment_funding_plan_links();

-- One canonical allocator is shared by current liquidity and both funding states.
-- It deliberately never reads accounts.owner_member_id.
create or replace view public.financial_account_member_allocations with (security_invoker=true) as
with owners as (
  select a.household_id,a.id account_id,m.id member_id,
    count(m.id) over(partition by a.id) owner_count,
    row_number() over(partition by a.id order by m.id) owner_order
  from public.accounts a
  join public.account_ownerships ao on ao.account_id=a.id and ao.household_id=a.household_id
  join public.household_members m on m.id=ao.member_id and m.household_id=a.household_id and m.deactivated_at is null
  where a.deactivated_at is null
), household_counts as (
  select household_id,count(*) active_member_count from public.household_members where deactivated_at is null group by household_id
)
select o.household_id,o.account_id,o.member_id,o.owner_count,o.owner_order,
  case when o.owner_count=1 then 1::numeric
       when o.owner_count=2 and h.active_member_count=2 then .5::numeric
  end allocation_ratio,
  (o.owner_count=1 or (o.owner_count=2 and h.active_member_count=2)) is_valid
from owners o join household_counts h using(household_id);

create or replace view public.financial_member_liquidity_positions with (security_invoker=true) as
with valid as (
 select c.*,a.member_id,a.owner_count,a.owner_order,
   floor(round(c.current_balance*100)/a.owner_count)::bigint base_cents,
   (round(c.current_balance*100)::bigint-floor(round(c.current_balance*100)/a.owner_count)::bigint*a.owner_count)::integer remainder_cents
 from public.financial_available_cash_positions c
 join public.financial_account_member_allocations a on a.account_id=c.account_id and a.household_id=c.household_id and a.is_valid
), attributed as (
 select household_id,account_id,name,type,member_id,current_balance,owner_count,
   (base_cents+case when owner_order<=remainder_cents then 1 else 0 end)::numeric/100 attributed_liquidity,
   true ownership_valid
 from valid
), unattributed as (
 select c.household_id,c.account_id,c.name,c.type,null::uuid member_id,c.current_balance,0 owner_count,
   c.current_balance attributed_liquidity,false ownership_valid
 from public.financial_available_cash_positions c
 where not exists(select 1 from public.financial_account_member_allocations a where a.account_id=c.account_id and a.household_id=c.household_id and a.is_valid)
)
select * from attributed union all select * from unattributed;

-- Responsibility is allocated from economic_allocations over the already
-- deduplicated monthly commitment unit. Third-party and missing allocations are
-- retained as a null-member amount instead of being invented for a member.
create or replace view public.financial_member_commitment_responsibility_positions with (security_invoker=true) as
with allocation_source as (
 select c.*,a.responsible_member_id,a.responsible_party_id,a.allocation_order,a.percentage,
   row_number() over(partition by c.commitment_key order by a.allocation_order) allocation_rank,
   count(a.id) over(partition by c.commitment_key) allocation_count
 from public.financial_commitment_positions c
 left join public.economic_allocations a on a.transaction_id=c.source_transaction_id and a.household_id=c.household_id
), cents as (
 select s.*,
   floor(round(effective_amount*100)*coalesce(percentage,100)/100)::bigint effective_base,
   floor(round(realized_amount*100)*coalesce(percentage,100)/100)::bigint realized_base,
   round(effective_amount*100)::bigint-sum(floor(round(effective_amount*100)*coalesce(percentage,100)/100)::bigint) over(partition by commitment_key) effective_remainder,
   round(realized_amount*100)::bigint-sum(floor(round(realized_amount*100)*coalesce(percentage,100)/100)::bigint) over(partition by commitment_key) realized_remainder
 from allocation_source s
), allocated as (
 select c.*,
   (effective_base+case when allocation_rank<=effective_remainder then 1 else 0 end)::numeric/100 responsibility_amount,
   (realized_base+case when allocation_rank<=realized_remainder then 1 else 0 end)::numeric/100 realized_responsibility_amount
 from cents c
)
select household_id,commitment_key,source_type,source_id,source_transaction_id,source_installment_id,
 source_obligation_id,source_recurring_occurrence_id,financial_date,financial_month,commitment_state,
 responsible_member_id member_id,responsible_party_id,allocation_order,
 responsibility_amount::numeric(19,2),realized_responsibility_amount::numeric(19,2),
 (responsibility_amount-realized_responsibility_amount)::numeric(19,2) remaining_responsibility_amount,
 (responsible_member_id is null) is_unattributed_to_member
from allocated;

-- Resolve explicit allocations first. Specific targets precede transaction and
-- recurring-rule plans; any uncovered residual falls through to the selected
-- account and then to the card default.
create or replace view public.financial_projected_funding_routes with (security_invoker=true) as
with commitments as (
 select c.*,greatest(c.effective_amount-coalesce((select sum(f.amount) from public.funding_events f
   where f.household_id=c.household_id and f.financed_transaction_id=c.source_transaction_id
     and f.installment_id is not distinct from c.source_installment_id),0),0)::numeric(19,2) funding_remaining
 from public.financial_commitment_positions c
 where c.commitment_state not in ('cancelled','reversed')
), candidates as (
 select c.*,p.id plan_id,p.source_account_id,p.amount plan_amount,
   case when p.installment_id=c.source_installment_id and p.installment_id is not null then 1
        when p.obligation_id=c.source_obligation_id and p.obligation_id is not null then 1
        when p.recurring_occurrence_id=c.source_recurring_occurrence_id and p.recurring_occurrence_id is not null then 1
        when p.transaction_id=c.source_transaction_id and p.transaction_id is not null then 2 else 3 end priority,
   p.created_at plan_created_at
 from commitments c join public.commitment_funding_plans p on p.household_id=c.household_id and p.state='active'
  and ((p.installment_id=c.source_installment_id and p.installment_id is not null)
    or (p.obligation_id=c.source_obligation_id and p.obligation_id is not null)
    or (p.recurring_occurrence_id=c.source_recurring_occurrence_id and p.recurring_occurrence_id is not null)
    or (p.transaction_id=c.source_transaction_id and p.transaction_id is not null)
    or (p.recurring_rule_id=(select o.recurring_rule_id from public.recurring_occurrences o where o.id=c.source_recurring_occurrence_id) and p.recurring_rule_id is not null))
), plan_amounts as (
 select x.*,greatest(least(plan_amount,funding_remaining-coalesce(sum(plan_amount) over(partition by commitment_key order by priority,plan_created_at,plan_id rows between unbounded preceding and 1 preceding),0)),0)::numeric(19,2) route_amount
 from candidates x
), explicit_routes as (
 select household_id,commitment_key,source_type,source_id,source_transaction_id,source_installment_id,source_obligation_id,source_recurring_occurrence_id,
   financial_date,financial_month,funding_remaining,plan_id,source_account_id,route_amount,'explicit_override'::text route_source,priority
 from plan_amounts where route_amount>0
), residuals as (
 select c.*,greatest(c.funding_remaining-coalesce(sum(e.route_amount),0),0)::numeric(19,2) residual
 from commitments c left join explicit_routes e using(household_id,commitment_key) group by c.household_id,c.commitment_key,c.source_type,c.source_id,c.source_transaction_id,c.source_installment_id,c.source_invoice_id,c.source_obligation_id,c.source_recurring_occurrence_id,c.commitment_type,c.direction,c.economic_type,c.financial_date,c.financial_month,c.due_date,c.economic_date,c.effective_amount,c.realized_amount,c.remaining_amount,c.economic_state,c.commitment_state,c.is_overdue,c.is_prior_pending,c.description,c.category_id,c.created_by_member_id,c.funding_remaining
), fallbacks as (
 select r.*,case when pi.kind='account' then pi.account_id when pi.kind='card' then card.default_payment_account_id end source_account_id,
   case when pi.kind='account' then 'selected_account'::text when pi.kind='card' and card.default_payment_account_id is not null then 'instrument_default'::text else 'unattributed'::text end route_source
 from residuals r left join public.transaction_payment_instruments pi on pi.transaction_id=r.source_transaction_id and pi.household_id=r.household_id
 left join public.cards card on card.id=pi.card_id and card.household_id=r.household_id and card.deactivated_at is null
)
select household_id,commitment_key,source_type,source_id,source_transaction_id,source_installment_id,source_obligation_id,source_recurring_occurrence_id,
 financial_date,financial_month,funding_remaining,plan_id,source_account_id,route_amount,route_source,priority
from explicit_routes
union all
select f.household_id,f.commitment_key,f.source_type,f.source_id,f.source_transaction_id,f.source_installment_id,f.source_obligation_id,f.source_recurring_occurrence_id,
 f.financial_date,f.financial_month,f.funding_remaining,null::uuid,
 case when a.id is not null then f.source_account_id end,
 f.residual,
 case when a.id is null then 'unattributed' else f.route_source end,4
from fallbacks f left join public.accounts a on a.id=f.source_account_id and a.household_id=f.household_id and a.deactivated_at is null
where f.residual>0;

create or replace view public.financial_member_funding_positions with (security_invoker=true) as
with realized_raw as (
 select f.household_id,c.commitment_key,
   f.financed_transaction_id source_transaction_id,f.installment_id source_installment_id,c.source_obligation_id,
   f.id funding_event_id,null::uuid plan_id,f.source_account_id,f.funded_at::date financial_date,date_trunc('month',f.funded_at)::date financial_month,
   f.amount,'realized'::text funding_state,'funding_event'::text route_source
 from public.funding_events f
 join lateral (
   select p.commitment_key,p.source_obligation_id from public.financial_commitment_positions p
   where p.household_id=f.household_id and p.source_transaction_id=f.financed_transaction_id
     and p.source_installment_id is not distinct from f.installment_id
   order by (p.source_obligation_id is not null) desc fetch first 1 row only
 ) c on true
), projected_raw as (
 select r.household_id,r.commitment_key,r.source_transaction_id,r.source_installment_id,r.source_obligation_id,
   null::uuid funding_event_id,r.plan_id,r.source_account_id,r.financial_date,r.financial_month,r.route_amount amount,
   'projected'::text funding_state,r.route_source
 from public.financial_projected_funding_routes r
), routes as (select * from realized_raw union all select * from projected_raw), valid as (
 select r.*,a.member_id,a.owner_count,a.owner_order,
   floor(round(r.amount*100)/a.owner_count)::bigint base_cents,
   (round(r.amount*100)::bigint-floor(round(r.amount*100)/a.owner_count)::bigint*a.owner_count)::integer remainder_cents
 from routes r join public.financial_account_member_allocations a on a.account_id=r.source_account_id and a.household_id=r.household_id and a.is_valid
), attributed as (
 select household_id,commitment_key,source_transaction_id,source_installment_id,source_obligation_id,funding_event_id,plan_id,source_account_id,
   financial_date,financial_month,member_id,(base_cents+case when owner_order<=remainder_cents then 1 else 0 end)::numeric/100 amount,funding_state,route_source,false is_unattributed
 from valid
), unattributed as (
 select r.household_id,r.commitment_key,r.source_transaction_id,r.source_installment_id,r.source_obligation_id,r.funding_event_id,r.plan_id,r.source_account_id,
   r.financial_date,r.financial_month,null::uuid,r.amount,r.funding_state,r.route_source,true
 from routes r where not exists(select 1 from public.financial_account_member_allocations a where a.account_id=r.source_account_id and a.household_id=r.household_id and a.is_valid)
)
select * from attributed union all select * from unattributed;

create or replace view public.financial_member_true_income_positions with (security_invoker=true) as
select i.*,m.beneficiary_member_id member_id
from public.financial_true_income_positions i join public.money_movements m on m.id=i.money_movement_id and m.household_id=i.household_id;

create or replace view public.financial_member_settlement_cash_flows with (security_invoker=true) as
select s.household_id,s.id schedule_id,s.due_date,date_trunc('month',s.due_date)::date financial_month,s.payer_member_id member_id,
  0::numeric(19,2) scheduled_inflow,s.amount::numeric(19,2) scheduled_outflow
from public.member_settlement_schedules s where s.state='scheduled'
union all
select s.household_id,s.id,s.due_date,date_trunc('month',s.due_date)::date,s.receiver_member_id,
  s.amount::numeric(19,2),0::numeric(19,2)
from public.member_settlement_schedules s where s.state='scheduled';

-- Unmaterialized recurring dates remain projections. These views mirror the
-- household projection's occurrence precedence while retaining member routing.
create or replace view public.financial_recurring_projection_positions with (security_invoker=true) as
select r.household_id,r.id recurring_rule_id,r.template_transaction_id,
 occurrence_at::date financial_date,date_trunc('month',occurrence_at)::date financial_month,
 case when r.amount_mode='estimated' then r.estimated_amount else coalesce(r.estimated_amount,t.confirmed_amount,t.estimated_amount,t.amount) end::numeric(19,2) amount,
 pi.kind instrument_kind,pi.account_id selected_account_id,card.default_payment_account_id
from public.recurring_rules r join public.transactions t on t.id=r.template_transaction_id and t.household_id=r.household_id and t.type='expense' and t.deleted_at is null and t.economic_state not in ('cancelled','reversed')
left join public.transaction_payment_instruments pi on pi.transaction_id=t.id and pi.household_id=t.household_id
left join public.cards card on card.id=pi.card_id and card.household_id=t.household_id and card.deactivated_at is null
cross join lateral generate_series(r.start_date::timestamp,least(coalesce(r.end_date,'infinity'::date),(date_trunc('month',current_date)+(120||' months')::interval-interval '1 day')::date)::timestamp,
 case r.frequency when 'weekly' then make_interval(days=>7*r.interval_count) when 'monthly' then make_interval(months=>r.interval_count) when 'yearly' then make_interval(years=>r.interval_count) end) occurrence_at
where r.deactivated_at is null and r.start_date<(date_trunc('month',current_date)+(120||' months')::interval)::date
 and (r.end_date is null or r.end_date>=date_trunc('month',current_date)::date)
 and (r.amount_mode<>'estimated' or r.estimated_amount is not null)
 and not exists(select 1 from public.recurring_occurrences o where o.household_id=r.household_id and o.recurring_rule_id=r.id and o.competence_date=occurrence_at::date);

create or replace view public.financial_member_recurring_responsibility_positions with (security_invoker=true) as
with raw as (
 select p.*,a.responsible_member_id member_id,a.allocation_order,a.percentage,
  row_number() over(partition by p.recurring_rule_id,p.financial_date order by a.allocation_order) allocation_rank
 from public.financial_recurring_projection_positions p join public.economic_allocations a on a.transaction_id=p.template_transaction_id and a.household_id=p.household_id
), cents as (
 select r.*,floor(round(amount*100)*percentage/100)::bigint base_cents,
  round(amount*100)::bigint-sum(floor(round(amount*100)*percentage/100)::bigint) over(partition by recurring_rule_id,financial_date) remainder_cents
 from raw r
)
select household_id,recurring_rule_id,template_transaction_id,financial_date,financial_month,member_id,
 (base_cents+case when allocation_rank<=remainder_cents then 1 else 0 end)::numeric/100 responsibility_amount
from cents where member_id is not null;

create or replace view public.financial_member_recurring_funding_positions with (security_invoker=true) as
with plan_candidates as (
 select p.*,fp.id plan_id,fp.source_account_id,fp.amount plan_amount,
  coalesce(sum(fp.amount) over(partition by p.recurring_rule_id,p.financial_date order by fp.created_at,fp.id rows between unbounded preceding and 1 preceding),0) prior_amount
 from public.financial_recurring_projection_positions p join public.commitment_funding_plans fp on fp.household_id=p.household_id and fp.recurring_rule_id=p.recurring_rule_id and fp.state='active'
), explicit_routes as (
 select p.household_id,p.recurring_rule_id,p.template_transaction_id,p.financial_date,p.financial_month,p.amount total_amount,p.plan_id,p.source_account_id,
  greatest(least(p.plan_amount,p.amount-p.prior_amount),0)::numeric(19,2) route_amount,'explicit_override'::text route_source
 from plan_candidates p
), residual as (
 select p.*,greatest(p.amount-coalesce((select sum(e.route_amount) from explicit_routes e where e.recurring_rule_id=p.recurring_rule_id and e.financial_date=p.financial_date),0),0)::numeric(19,2) residual,
  case when p.instrument_kind='account' then p.selected_account_id when p.instrument_kind='card' then p.default_payment_account_id end fallback_account,
  case when p.instrument_kind='account' then 'selected_account'::text when p.instrument_kind='card' and p.default_payment_account_id is not null then 'instrument_default'::text else 'unattributed'::text end fallback_source
 from public.financial_recurring_projection_positions p
), routes as (
 select household_id,recurring_rule_id,template_transaction_id,financial_date,financial_month,plan_id,source_account_id,route_amount,route_source from explicit_routes where route_amount>0
 union all
 select r.household_id,r.recurring_rule_id,r.template_transaction_id,r.financial_date,r.financial_month,null::uuid,
  case when a.id is not null then r.fallback_account end,r.residual,case when a.id is null then 'unattributed' else r.fallback_source end
 from residual r left join public.accounts a on a.id=r.fallback_account and a.household_id=r.household_id and a.deactivated_at is null where r.residual>0
), valid as (
 select r.*,a.member_id,a.owner_count,a.owner_order,floor(round(r.route_amount*100)/a.owner_count)::bigint base_cents,
  (round(r.route_amount*100)::bigint-floor(round(r.route_amount*100)/a.owner_count)::bigint*a.owner_count)::integer remainder_cents
 from routes r join public.financial_account_member_allocations a on a.account_id=r.source_account_id and a.household_id=r.household_id and a.is_valid
)
select household_id,recurring_rule_id,template_transaction_id,financial_date,financial_month,plan_id,source_account_id,member_id,
 (base_cents+case when owner_order<=remainder_cents then 1 else 0 end)::numeric/100 amount,route_source,false is_unattributed from valid
union all
select r.household_id,r.recurring_rule_id,r.template_transaction_id,r.financial_date,r.financial_month,r.plan_id,r.source_account_id,null::uuid,r.route_amount,r.route_source,true
from routes r where not exists(select 1 from public.financial_account_member_allocations a where a.account_id=r.source_account_id and a.household_id=r.household_id and a.is_valid);

create or replace function public.set_commitment_funding_plan(
 p_household_id uuid,p_source_account_id uuid,p_amount numeric,p_idempotency_key text,
 p_transaction_id uuid default null,p_installment_id uuid default null,p_obligation_id uuid default null,
 p_recurring_occurrence_id uuid default null,p_recurring_rule_id uuid default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; result uuid;
begin
 caller:=public.require_active_member(p_household_id);
 if p_amount<=0 or nullif(trim(p_idempotency_key),'') is null or num_nonnulls(p_transaction_id,p_installment_id,p_obligation_id,p_recurring_occurrence_id,p_recurring_rule_id)<>1 then raise exception 'positive amount, idempotency key and exactly one target required' using errcode='22023'; end if;
 insert into public.commitment_funding_plans(household_id,created_by_member_id,source_account_id,transaction_id,installment_id,obligation_id,recurring_occurrence_id,recurring_rule_id,amount,idempotency_key,notes)
 values(p_household_id,caller.id,p_source_account_id,p_transaction_id,p_installment_id,p_obligation_id,p_recurring_occurrence_id,p_recurring_rule_id,p_amount,trim(p_idempotency_key),p_notes)
 on conflict(household_id,idempotency_key) do nothing returning id into result;
 if result is null then select id into result from public.commitment_funding_plans where household_id=p_household_id and idempotency_key=p_idempotency_key and source_account_id=p_source_account_id and amount=p_amount and transaction_id is not distinct from p_transaction_id and installment_id is not distinct from p_installment_id and obligation_id is not distinct from p_obligation_id and recurring_occurrence_id is not distinct from p_recurring_occurrence_id and recurring_rule_id is not distinct from p_recurring_rule_id and notes is not distinct from p_notes;
   if result is null then raise exception 'idempotency key already used with different plan data' using errcode='23505'; end if;
 end if; return result;
end $$;

create or replace function public.cancel_commitment_funding_plan(p_household_id uuid,p_plan_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin perform public.require_active_member(p_household_id);
 update public.commitment_funding_plans set state='cancelled',cancelled_at=now(),updated_at=now() where id=p_plan_id and household_id=p_household_id and state='active';
 if not found and not exists(select 1 from public.commitment_funding_plans where id=p_plan_id and household_id=p_household_id and state='cancelled') then raise exception 'funding plan not found' using errcode='P0002'; end if; return p_plan_id;
end $$;

create or replace function public.replace_commitment_funding_plan(p_household_id uuid,p_plan_id uuid,p_source_account_id uuid,p_amount numeric,p_idempotency_key text,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare old public.commitment_funding_plans; caller public.household_members; result uuid;
begin caller:=public.require_active_member(p_household_id);
 select id into result from public.commitment_funding_plans where household_id=p_household_id and idempotency_key=p_idempotency_key;
 if result is not null then
   if exists(select 1 from public.commitment_funding_plans where id=result and replaces_plan_id=p_plan_id and source_account_id=p_source_account_id and amount=p_amount and notes is not distinct from p_notes) then return result; end if;
   raise exception 'idempotency key already used with different replacement data' using errcode='23505';
 end if;
 select * into old from public.commitment_funding_plans where id=p_plan_id and household_id=p_household_id and state='active' for update;
 if old.id is null then raise exception 'active funding plan not found' using errcode='P0002'; end if;
 if p_amount<=0 or nullif(trim(p_idempotency_key),'') is null then raise exception 'positive amount and idempotency key required' using errcode='22023'; end if;
 insert into public.commitment_funding_plans(household_id,created_by_member_id,source_account_id,transaction_id,installment_id,obligation_id,recurring_occurrence_id,recurring_rule_id,amount,idempotency_key,replaces_plan_id,notes)
 values(p_household_id,caller.id,p_source_account_id,old.transaction_id,old.installment_id,old.obligation_id,old.recurring_occurrence_id,old.recurring_rule_id,p_amount,trim(p_idempotency_key),old.id,p_notes) returning id into result;
 update public.commitment_funding_plans set state='replaced',cancelled_at=now(),updated_at=now() where id=old.id;
 return result;
end $$;

-- Projected settlements are conclusions and are recalculated from the resolved
-- funding routes. Realized events remain append-only and are never rewritten.
drop index if exists public.member_settlement_installment_origin_unique;
create unique index member_settlement_projected_installment_unique on public.member_settlement_events(source_installment_id,debtor_member_id,creditor_member_id) where source_installment_id is not null and kind='responsibility_funding' and state='projected';
create unique index member_settlement_projected_transaction_unique on public.member_settlement_events(source_transaction_id,debtor_member_id,creditor_member_id) where source_installment_id is null and source_transaction_id is not null and source_funding_event_id is null and kind='responsibility_funding' and state='projected';

create or replace function public.reconcile_member_settlements(p_transaction_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare tx public.transactions; c record; fe record; debtor uuid; creditor uuid; effect numeric; tx_total numeric;
begin
 select * into tx from public.transactions where id=p_transaction_id and deleted_at is null;
 if tx.id is null or tx.type<>'expense' then return; end if;
 update public.member_settlement_events set state='cancelled',updated_at=now()
  where source_transaction_id=tx.id and state='projected' and kind='responsibility_funding';
 if tx.economic_state in ('cancelled','reversed') then return; end if;
 tx_total:=public.financial_effective_total_amount(tx.economic_state,tx.estimated_amount,tx.confirmed_amount,tx.realized_amount,tx.amount);

 -- Each funding event realizes only its own proportional responsibility. The
 -- actual source account determines attribution; invalid ownership is not
 -- silently replaced by the card owner, buyer, creator, or legacy account owner.
 for fe in select f.* from public.funding_events f where f.financed_transaction_id=tx.id loop
  if not exists(select 1 from public.member_settlement_events e where e.source_funding_event_id=fe.id) then
   with responsibility_raw as (
    select ea.responsible_member_id,ea.responsible_party_id,ea.allocation_order,
      floor(round(fe.amount*100)*ea.percentage/100)::bigint base_cents,
      row_number() over(order by ea.allocation_order) allocation_rank
    from public.economic_allocations ea where ea.transaction_id=tx.id
   ), responsibility_cents as (
    select r.*,(round(fe.amount*100)::bigint-sum(base_cents) over())::integer remainder_cents from responsibility_raw r
   ), responsibility as (
    select responsible_member_id member_id,sum((base_cents+case when allocation_rank<=remainder_cents then 1 else 0 end)::numeric/100) amount
    from responsibility_cents where responsible_member_id is not null group by responsible_member_id
   ), member_balances as (
    select m.id member_id,
      coalesce((select sum(x.amount) from (
        select a.member_id,(floor(round(fe.amount*100)/a.owner_count)::bigint+
          case when a.owner_order<=(round(fe.amount*100)::bigint-floor(round(fe.amount*100)/a.owner_count)::bigint*a.owner_count) then 1 else 0 end)::numeric/100 amount
        from public.financial_account_member_allocations a where a.household_id=tx.household_id and a.account_id=fe.source_account_id and a.is_valid
      ) x where x.member_id=m.id),0)
      -coalesce((select r.amount from responsibility r where r.member_id=m.id),0) balance
    from public.household_members m where m.household_id=tx.household_id and m.deactivated_at is null
   ) select (array_agg(member_id order by balance,member_id) filter(where balance<0))[1],
      (array_agg(member_id order by balance desc,member_id) filter(where balance>0))[1],
      round(least(abs(min(balance) filter(where balance<0)),max(balance) filter(where balance>0)),2)
     into debtor,creditor,effect from member_balances;
   if debtor is not null and creditor is not null and effect>0 then
    insert into public.member_settlement_events(household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,occurred_at,source_transaction_id,source_installment_id,source_funding_event_id)
    values(tx.household_id,tx.created_by_member_id,debtor,creditor,effect,'realized','responsibility_funding',fe.funded_at::date,fe.funded_at,tx.id,fe.installment_id,fe.id)
    on conflict(source_funding_event_id,debtor_member_id,creditor_member_id) where source_funding_event_id is not null do nothing;
   end if;
  end if;
 end loop;

 for c in
  with member_balances as (
   select base.commitment_key,base.source_installment_id,base.financial_date,m.id member_id,
    coalesce((select sum(f.amount) from public.financial_member_funding_positions f where f.household_id=tx.household_id and f.commitment_key=base.commitment_key and f.member_id=m.id and f.funding_state='projected'),0)
    -coalesce((select sum(r.remaining_responsibility_amount) from public.financial_member_commitment_responsibility_positions r where r.household_id=tx.household_id and r.commitment_key=base.commitment_key and r.member_id=m.id),0) balance
   from (select distinct commitment_key,source_installment_id,financial_date from public.financial_member_commitment_responsibility_positions where household_id=tx.household_id and source_transaction_id=tx.id) base
   cross join public.household_members m where m.household_id=tx.household_id and m.deactivated_at is null
  ) select commitment_key,source_installment_id,financial_date,
    (array_agg(member_id order by balance,member_id) filter(where balance<0))[1] debtor,
    (array_agg(member_id order by balance desc,member_id) filter(where balance>0))[1] creditor,
    round(least(abs(min(balance) filter(where balance<0)),max(balance) filter(where balance>0)),2) effect
   from member_balances group by commitment_key,source_installment_id,financial_date
 loop
  debtor:=c.debtor;creditor:=c.creditor;effect:=c.effect;
  if debtor is not null and creditor is not null and effect>0 then
   insert into public.member_settlement_events(household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,source_transaction_id,source_installment_id)
   values(tx.household_id,tx.created_by_member_id,debtor,creditor,effect,'projected','responsibility_funding',c.financial_date,tx.id,c.source_installment_id);
  end if;
 end loop;
end $$;
revoke all on function public.reconcile_member_settlements(uuid) from public,anon,authenticated;

create or replace function public.trigger_reconcile_member_funding_perspective()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare tx_id uuid; row record;
begin
 if tg_table_name='commitment_funding_plans' then
  tx_id:=coalesce(new.transaction_id,old.transaction_id);
  if tx_id is null then select coalesce(p.purchase_transaction_id,o.transaction_id,r.template_transaction_id) into tx_id from (select coalesce(new.installment_id,old.installment_id) id) x left join public.installments i on i.id=x.id left join public.installment_plans p on p.id=i.installment_plan_id left join public.recurring_occurrences o on o.id=coalesce(new.recurring_occurrence_id,old.recurring_occurrence_id) left join public.recurring_rules r on r.id=coalesce(new.recurring_rule_id,old.recurring_rule_id); end if;
  if tx_id is not null then perform public.reconcile_member_settlements(tx_id); end if;
 elsif tg_table_name='account_ownerships' then
  for row in select distinct pi.transaction_id from public.transaction_payment_instruments pi left join public.cards c on c.id=pi.card_id where pi.account_id=coalesce(new.account_id,old.account_id) or c.default_payment_account_id=coalesce(new.account_id,old.account_id) loop perform public.reconcile_member_settlements(row.transaction_id); end loop;
 elsif tg_table_name='cards' then
  for row in select transaction_id from public.transaction_payment_instruments where card_id=coalesce(new.id,old.id) loop perform public.reconcile_member_settlements(row.transaction_id); end loop;
 elsif tg_table_name='accounts' then
  for row in select distinct pi.transaction_id from public.transaction_payment_instruments pi left join public.cards c on c.id=pi.card_id where pi.account_id=coalesce(new.id,old.id) or c.default_payment_account_id=coalesce(new.id,old.id) loop perform public.reconcile_member_settlements(row.transaction_id); end loop;
 end if; return null;
end $$;
revoke all on function public.trigger_reconcile_member_funding_perspective() from public,anon,authenticated;
create trigger reconcile_settlement_funding_plan after insert or update or delete on public.commitment_funding_plans for each row execute function public.trigger_reconcile_member_funding_perspective();
create trigger reconcile_settlement_account_ownership after insert or update or delete on public.account_ownerships for each row execute function public.trigger_reconcile_member_funding_perspective();
create trigger reconcile_settlement_card_default after update of default_payment_account_id,deactivated_at on public.cards for each row execute function public.trigger_reconcile_member_funding_perspective();
create trigger reconcile_settlement_account_state after update of deactivated_at on public.accounts for each row execute function public.trigger_reconcile_member_funding_perspective();

-- Forward-only correction of still-projected rows produced by migration 023's
-- temporary card-owner fallback. Realized history is deliberately untouched.
update public.member_settlement_events set state='cancelled',updated_at=now()
 where state='projected' and kind='responsibility_funding';
do $$ declare x record; begin for x in select distinct id from public.transactions where type='expense' and deleted_at is null loop perform public.reconcile_member_settlements(x.id); end loop; end $$;

create or replace function public.financial_member_monthly_projection(
 p_household_id uuid,p_member_id uuid,p_reference_month date default date_trunc('month',current_date)::date,p_horizon_months integer default 4
) returns table(
 household_id uuid,member_id uuid,reference_month date,financial_month date,month_index integer,
 opening_liquidity numeric(19,2),realized_true_income_in_month numeric(19,2),expected_reliable_income_remaining numeric(19,2),
 economic_responsibility_remaining numeric(19,2),realized_funding_in_month numeric(19,2),projected_funding_remaining numeric(19,2),
 unattributed_funding_remaining numeric(19,2),scheduled_settlement_inflow numeric(19,2),scheduled_settlement_outflow numeric(19,2),
 settlement_receivable_position numeric(19,2),settlement_payable_position numeric(19,2),projected_net_change numeric(19,2),projected_ending_liquidity numeric(19,2)
) language plpgsql stable security invoker set search_path=public,pg_temp as $$
#variable_conflict use_column
declare v_reference date:=date_trunc('month',p_reference_month)::date; v_current date:=date_trunc('month',current_date)::date; v_offset integer;
begin
 if p_household_id is null or p_member_id is null or p_reference_month<>v_reference then raise exception 'household, member and first day reference month required' using errcode='22023'; end if;
 if p_horizon_months is null or p_horizon_months<1 or p_horizon_months>120 then raise exception 'horizon must be between 1 and 120 months' using errcode='22023'; end if;
 if v_reference<v_current then raise exception 'reference month cannot precede current month without historical liquidity snapshots' using errcode='22023'; end if;
 if not public.is_active_household_member(p_household_id) or not exists(select 1 from public.household_members m where m.id=p_member_id and m.household_id=p_household_id and m.deactivated_at is null) then raise exception 'active household membership required' using errcode='42501'; end if;
 v_offset:=((extract(year from v_reference)-extract(year from v_current))*12+extract(month from v_reference)-extract(month from v_current))::integer;
 return query with months as (
  select n::integer chain_index,(v_current+(n||' months')::interval)::date financial_month from generate_series(0,v_offset+p_horizon_months-1)n
 ), cash as (
  select coalesce(sum(attributed_liquidity),0)::numeric(19,2) amount from public.financial_member_liquidity_positions where financial_member_liquidity_positions.household_id=p_household_id and financial_member_liquidity_positions.member_id=p_member_id
 ), income as (
  select i.financial_month,coalesce(sum(i.amount) filter(where i.state='realized'),0)::numeric(19,2) realized_amount,coalesce(sum(i.reliable_remaining_amount) filter(where i.state='projected'),0)::numeric(19,2) expected_amount
  from public.financial_member_true_income_positions i where i.household_id=p_household_id and i.member_id=p_member_id group by i.financial_month
 ), responsibility as (
  select financial_month,sum(amount)::numeric(19,2) amount from (
   select r.financial_month,r.remaining_responsibility_amount amount from public.financial_member_commitment_responsibility_positions r where r.household_id=p_household_id and r.member_id=p_member_id and r.commitment_state not in ('cancelled','reversed')
   union all select r.financial_month,r.responsibility_amount from public.financial_member_recurring_responsibility_positions r where r.household_id=p_household_id and r.member_id=p_member_id
  ) x group by financial_month
 ), funding as (
  select financial_month,coalesce(sum(amount) filter(where funding_state='realized'),0)::numeric(19,2) realized_amount,coalesce(sum(amount) filter(where funding_state='projected'),0)::numeric(19,2) projected_amount from (
   select f.financial_month,f.amount,f.funding_state from public.financial_member_funding_positions f where f.household_id=p_household_id and f.member_id=p_member_id
   union all select f.financial_month,f.amount,'projected'::text from public.financial_member_recurring_funding_positions f where f.household_id=p_household_id and f.member_id=p_member_id
  ) x group by financial_month
 ), unattributed as (
  select financial_month,sum(amount)::numeric(19,2) amount from (
   select financial_month,amount from public.financial_member_funding_positions where financial_member_funding_positions.household_id=p_household_id and is_unattributed and funding_state='projected'
   union all select financial_month,amount from public.financial_member_recurring_funding_positions where financial_member_recurring_funding_positions.household_id=p_household_id and is_unattributed
  ) x group by financial_month
 ), schedules as (
  select financial_month,sum(scheduled_inflow)::numeric(19,2) inflow,sum(scheduled_outflow)::numeric(19,2) outflow from public.financial_member_settlement_cash_flows where financial_member_settlement_cash_flows.household_id=p_household_id and financial_member_settlement_cash_flows.member_id=p_member_id group by financial_month
 ), positions as (
  select coalesce(sum(realized_outstanding) filter(where creditor_member_id=p_member_id),0)::numeric(19,2) receivable,coalesce(sum(realized_outstanding) filter(where debtor_member_id=p_member_id),0)::numeric(19,2) payable from public.financial_member_settlement_positions where financial_member_settlement_positions.household_id=p_household_id
 ), monthly as (
  select m.*,coalesce(i.realized_amount,0) income_realized,coalesce(i.expected_amount,0) income_expected,coalesce(r.amount,0) responsibility_remaining,
   coalesce(f.realized_amount,0) funding_realized,coalesce(f.projected_amount,0) funding_projected,coalesce(u.amount,0) funding_unattributed,
   coalesce(s.inflow,0) settlement_inflow,coalesce(s.outflow,0) settlement_outflow
  from months m left join income i using(financial_month) left join responsibility r using(financial_month) left join funding f using(financial_month) left join unattributed u using(financial_month) left join schedules s using(financial_month)
 ), calculated as (
  select m.*,(income_expected+settlement_inflow-funding_projected-settlement_outflow)::numeric(19,2) net_change from monthly m
 ), projected as (
  select c.*,(base.amount+coalesce(sum(net_change) over(order by chain_index rows between unbounded preceding and 1 preceding),0))::numeric(19,2) opening_amount,
   (base.amount+sum(net_change) over(order by chain_index rows between unbounded preceding and current row))::numeric(19,2) ending_amount from calculated c cross join cash base
 ) select p_household_id,p_member_id,v_reference,p.financial_month,(p.chain_index-v_offset)::integer,p.opening_amount,p.income_realized,p.income_expected,
   p.responsibility_remaining,p.funding_realized,p.funding_projected,p.funding_unattributed,p.settlement_inflow,p.settlement_outflow,
   pos.receivable,pos.payable,p.net_change,p.ending_amount from projected p cross join positions pos where p.chain_index>=v_offset order by p.chain_index;
end $$;

alter table public.commitment_funding_plans enable row level security;
revoke all on table public.commitment_funding_plans from public,anon;
revoke insert,update,delete,truncate,references,trigger on table public.commitment_funding_plans from authenticated;
grant select on table public.commitment_funding_plans to authenticated;
create policy commitment_funding_plans_household_select on public.commitment_funding_plans for select to authenticated using(public.is_active_household_member(household_id));

revoke all on public.financial_account_member_allocations,public.financial_member_liquidity_positions,public.financial_member_commitment_responsibility_positions,public.financial_projected_funding_routes,public.financial_member_funding_positions,public.financial_member_true_income_positions,public.financial_member_settlement_cash_flows,public.financial_recurring_projection_positions,public.financial_member_recurring_responsibility_positions,public.financial_member_recurring_funding_positions from public,anon;
grant select on public.financial_account_member_allocations,public.financial_member_liquidity_positions,public.financial_member_commitment_responsibility_positions,public.financial_projected_funding_routes,public.financial_member_funding_positions,public.financial_member_true_income_positions,public.financial_member_settlement_cash_flows,public.financial_recurring_projection_positions,public.financial_member_recurring_responsibility_positions,public.financial_member_recurring_funding_positions to authenticated;
revoke all on function public.set_commitment_funding_plan(uuid,uuid,numeric,text,uuid,uuid,uuid,uuid,uuid,text),public.cancel_commitment_funding_plan(uuid,uuid),public.replace_commitment_funding_plan(uuid,uuid,uuid,numeric,text,text),public.financial_member_monthly_projection(uuid,uuid,date,integer) from public,anon;
grant execute on function public.set_commitment_funding_plan(uuid,uuid,numeric,text,uuid,uuid,uuid,uuid,uuid,text),public.cancel_commitment_funding_plan(uuid,uuid),public.replace_commitment_funding_plan(uuid,uuid,uuid,numeric,text,text),public.financial_member_monthly_projection(uuid,uuid,date,integer) to authenticated;

comment on view public.financial_member_liquidity_positions is 'Available cash attributed only through canonical active account ownerships; one owner gets 100%, exactly two active household members get deterministic 50/50, and invalid ownership remains unattributed. Negative balances remain negative and overdraft is excluded.';
comment on view public.financial_member_commitment_responsibility_positions is 'Monthly economic responsibility derived exclusively from economic_allocations over canonical deduplicated commitments.';
comment on view public.financial_projected_funding_routes is 'Remaining funding route hierarchy: explicit partial overrides, selected account, valid card default, then unattributed. Card owner, buyer, creator, responsibility, and legacy account owner are never fallbacks.';
comment on view public.financial_member_funding_positions is 'Realized funding comes only from funding_events; projected funding covers only the remaining commitment. Both are attributed through canonical account ownership.';
comment on view public.financial_member_settlement_cash_flows is 'Scheduled-only intermember cash flows. Realized schedules and unscheduled positions never enter future cash projection.';
comment on function public.financial_member_monthly_projection(uuid,uuid,date,integer) is 'Cumulative individual liquidity projection: current attributed liquidity plus reliable member income and scheduled settlement inflows, minus projected member funding and scheduled settlement outflows. Economic responsibility is informational and never subtracted.';
