-- Planned payer responsibility for future household commitments without inventing a payment account.
-- This closes individual projections while preserving the actual account choice for settlement time.

create table public.obligation_member_payer_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  obligation_id uuid not null references public.financial_obligations(id) on delete restrict,
  member_id uuid not null references public.household_members(id) on delete restrict,
  percentage numeric(7,4) not null check(percentage>0 and percentage<=100),
  state text not null default 'active' check(state in ('active','replaced')),
  batch_key text not null check(length(trim(batch_key))>0),
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  replaced_at timestamptz,
  check((state='active')=(replaced_at is null))
);

create unique index obligation_member_payer_plans_active_member
  on public.obligation_member_payer_plans(household_id,obligation_id,member_id)
  where state='active';
create index obligation_member_payer_plans_active_obligation
  on public.obligation_member_payer_plans(household_id,obligation_id)
  where state='active';

alter table public.obligation_member_payer_plans enable row level security;
create policy obligation_member_payer_plans_select
  on public.obligation_member_payer_plans for select to authenticated
  using(public.is_active_household_member(household_id));

revoke all on public.obligation_member_payer_plans from public,anon;
grant select on public.obligation_member_payer_plans to authenticated;

create or replace function public.set_obligation_member_payer_plan(
  p_household_id uuid,
  p_obligation_id uuid,
  p_allocations jsonb,
  p_batch_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  total numeric;
  item jsonb;
  member uuid;
  pct numeric;
begin
  caller:=public.require_active_member(p_household_id);
  if p_obligation_id is null or nullif(trim(p_batch_key),'') is null or jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)=0 then
    raise exception 'obligation, allocations and batch key are required' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.financial_obligations o
    where o.id=p_obligation_id and o.household_id=p_household_id and o.origin_kind='loan' and o.kind='payable' and o.state='open'
  ) then raise exception 'active payable loan obligation required' using errcode='23514'; end if;

  select coalesce(sum((value->>'percentage')::numeric),0) into total
  from jsonb_array_elements(p_allocations);
  if round(total,4)<>100 then raise exception 'payer allocations must total 100 percent' using errcode='23514'; end if;

  for item in select value from jsonb_array_elements(p_allocations) loop
    member:=(item->>'member_id')::uuid;
    pct:=(item->>'percentage')::numeric;
    if pct<=0 or pct>100 or not exists(
      select 1 from public.household_members m where m.id=member and m.household_id=p_household_id and m.deactivated_at is null
    ) then raise exception 'payer allocation member must be active in household' using errcode='23514'; end if;
  end loop;

  if exists(
    select 1 from public.obligation_member_payer_plans p
    where p.household_id=p_household_id and p.obligation_id=p_obligation_id and p.batch_key=trim(p_batch_key)
  ) then return p_obligation_id; end if;

  update public.obligation_member_payer_plans
     set state='replaced',replaced_at=now()
   where household_id=p_household_id and obligation_id=p_obligation_id and state='active';

  for item in select value from jsonb_array_elements(p_allocations) loop
    insert into public.obligation_member_payer_plans(
      household_id,obligation_id,member_id,percentage,batch_key,created_by_member_id
    ) values(
      p_household_id,p_obligation_id,(item->>'member_id')::uuid,(item->>'percentage')::numeric,trim(p_batch_key),caller.id
    );
  end loop;
  return p_obligation_id;
end $$;

revoke all on function public.set_obligation_member_payer_plan(uuid,uuid,jsonb,text) from public,anon;
grant execute on function public.set_obligation_member_payer_plan(uuid,uuid,jsonb,text) to authenticated;

create or replace view public.financial_member_payer_plan_funding_positions with (security_invoker=true) as
with raw as (
  select r.household_id,r.commitment_key,r.source_obligation_id,r.financial_date,r.financial_month,
    p.member_id,p.percentage,
    row_number() over(partition by r.household_id,r.commitment_key order by p.member_id) allocation_rank,
    floor(round(r.route_amount*100)*p.percentage/100)::bigint base_cents,
    round(r.route_amount*100)::bigint
      -sum(floor(round(r.route_amount*100)*p.percentage/100)::bigint)
       over(partition by r.household_id,r.commitment_key) remainder_cents
  from public.financial_projected_funding_routes r
  join public.obligation_member_payer_plans p
    on p.household_id=r.household_id and p.obligation_id=r.source_obligation_id and p.state='active'
  where r.route_source='unattributed' and r.route_amount>0 and r.source_obligation_id is not null
)
select household_id,commitment_key,source_obligation_id,financial_date,financial_month,member_id,
  (base_cents+case when allocation_rank<=remainder_cents then 1 else 0 end)::numeric/100 amount,
  percentage
from raw;

revoke all on public.financial_member_payer_plan_funding_positions from public,anon;
grant select on public.financial_member_payer_plan_funding_positions to authenticated;

create or replace view public.financial_unattributed_funding_details with (security_invoker=true) as
with planned as (
  select household_id,commitment_key,sum(amount)::numeric(19,2) planned_amount
  from public.financial_member_payer_plan_funding_positions
  group by household_id,commitment_key
)
select u.household_id,u.commitment_key,u.financial_month,
  greatest(u.amount-coalesce(p.planned_amount,0),0)::numeric(19,2) amount,
  c.source_type,c.description,c.due_date,c.source_obligation_id
from public.financial_member_funding_positions u
join public.financial_commitment_positions c
  on c.household_id=u.household_id and c.commitment_key=u.commitment_key
left join planned p
  on p.household_id=u.household_id and p.commitment_key=u.commitment_key
where u.is_unattributed and u.funding_state='projected'
  and greatest(u.amount-coalesce(p.planned_amount,0),0)>0;

revoke all on public.financial_unattributed_funding_details from public,anon;
grant select on public.financial_unattributed_funding_details to authenticated;

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
declare v_reference date:=date_trunc('month',p_reference_month)::date; v_current date:=public.financial_household_current_month(p_household_id); v_offset integer;
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
  select financial_month,
    coalesce(sum(amount) filter(where funding_state='realized'),0)::numeric(19,2) realized_amount,
    coalesce(sum(amount) filter(where funding_state='projected'),0)::numeric(19,2) projected_amount
  from (
   select f.financial_month,f.amount,f.funding_state
   from public.financial_member_funding_positions f
   where f.household_id=p_household_id and f.member_id=p_member_id
   union all
   select p.financial_month,p.amount,'projected'::text
   from public.financial_member_payer_plan_funding_positions p
   where p.household_id=p_household_id and p.member_id=p_member_id
   union all
   select f.financial_month,f.amount,'projected'::text
   from public.financial_member_recurring_funding_positions f
   where f.household_id=p_household_id and f.member_id=p_member_id
  ) x group by financial_month
 ), unattributed as (
  select financial_month,sum(amount)::numeric(19,2) amount from (
   select u.financial_month,
     greatest(u.amount-coalesce(p.planned_amount,0),0)::numeric(19,2) amount
   from public.financial_member_funding_positions u
   left join (
     select household_id,commitment_key,sum(amount)::numeric(19,2) planned_amount
     from public.financial_member_payer_plan_funding_positions
     group by household_id,commitment_key
   ) p on p.household_id=u.household_id and p.commitment_key=u.commitment_key
   where u.household_id=p_household_id and u.is_unattributed and u.funding_state='projected'
   union all
   select financial_month,amount
   from public.financial_member_recurring_funding_positions
   where household_id=p_household_id and is_unattributed
  ) x where amount>0 group by financial_month
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

grant execute on function public.financial_member_monthly_projection(uuid,uuid,date,integer) to authenticated;

comment on table public.obligation_member_payer_plans is
  'Planned member payer responsibility for an obligation. It never claims which account will actually settle the commitment.';
comment on view public.financial_member_payer_plan_funding_positions is
  'Splits otherwise unattributed projected obligation funding by explicitly planned payer member without inventing a source account.';
comment on view public.financial_unattributed_funding_details is
  'Human-readable residual projected household commitments that still lack a member payer plan or valid account route.';
