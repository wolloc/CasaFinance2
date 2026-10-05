-- Projection must respect the household financial cutover.
-- Commitments before the tracking-start month are historical context and must
-- not be charged against today's projected cash. Commitments created before
-- cutover but due in/after the tracking period (e.g. opening card purchases)
-- remain valid because their financial_month is on/after the cutover month.

create or replace function public.financial_monthly_projection(
  p_household_id uuid,
  p_reference_month date default date_trunc('month',current_date)::date,
  p_horizon_months integer default 4
)
returns table (
  household_id uuid,
  reference_month date,
  financial_month date,
  month_index integer,
  opening_cash numeric(19,2),
  realized_true_income_in_month numeric(19,2),
  expected_reliable_income_remaining numeric(19,2),
  realized_commitments_in_month numeric(19,2),
  remaining_commitments_in_month numeric(19,2),
  projected_recurring_commitments numeric(19,2),
  prior_pending_outflow numeric(19,2),
  projected_net_change numeric(19,2),
  projected_ending_cash numeric(19,2)
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
#variable_conflict use_column
declare
  v_reference_month date:=date_trunc('month',p_reference_month)::date;
  v_current_month date:=public.financial_household_current_month(p_household_id);
  v_tracking_start date;
  v_tracking_month date;
  v_reference_offset integer;
begin
  if p_household_id is null or p_reference_month is null then
    raise exception 'household and reference month are required' using errcode='22004';
  end if;
  if p_reference_month<>v_reference_month then
    raise exception 'reference month must be the first day of a month' using errcode='22023';
  end if;
  if p_horizon_months is null or p_horizon_months<1 or p_horizon_months>120 then
    raise exception 'horizon must be between 1 and 120 months' using errcode='22023';
  end if;
  if v_reference_month<v_current_month then
    raise exception 'reference month cannot precede the current month without a historical cash snapshot' using errcode='22023';
  end if;
  if not public.is_active_household_member(p_household_id) then
    raise exception 'active household membership required' using errcode='42501';
  end if;

  select h.financial_tracking_started_on
    into v_tracking_start
    from public.households h
   where h.id=p_household_id
     and h.deleted_at is null;

  v_tracking_month:=case
    when v_tracking_start is null then null
    else date_trunc('month',v_tracking_start)::date
  end;

  v_reference_offset:=((extract(year from v_reference_month)-extract(year from v_current_month))*12
    +extract(month from v_reference_month)-extract(month from v_current_month))::integer;

  return query
  with
  months as (
    select n::integer as chain_month_index,
           (v_current_month+(n||' months')::interval)::date as financial_month
      from generate_series(0,v_reference_offset+p_horizon_months-1) n
  ),
  cash as (
    select coalesce(sum(c.current_balance),0)::numeric(19,2) as amount
      from public.financial_available_cash_positions c
     where c.household_id=p_household_id
  ),
  incomes as (
    select i.financial_month,
           coalesce(sum(i.amount) filter(where i.state='realized'),0)::numeric(19,2) as realized_amount,
           coalesce(sum(i.reliable_remaining_amount) filter(where i.state='projected'),0)::numeric(19,2) as expected_amount
      from public.financial_true_income_positions i
     where i.household_id=p_household_id
       and i.financial_month between v_current_month
           and (v_reference_month+((p_horizon_months-1)||' months')::interval)::date
     group by i.financial_month
  ),
  commitment_base as materialized (
    select c.*
      from public.financial_commitment_positions c
     where c.household_id=p_household_id
       and c.commitment_state not in ('cancelled','reversed')
       and (v_tracking_month is null or c.financial_month>=v_tracking_month)
  ),
  commitments as (
    select c.financial_month,
           coalesce(sum(c.realized_amount),0)::numeric(19,2) as realized_amount,
           coalesce(sum(c.remaining_amount),0)::numeric(19,2) as remaining_amount
      from commitment_base c
     where c.financial_month between v_current_month
           and (v_reference_month+((p_horizon_months-1)||' months')::interval)::date
     group by c.financial_month
  ),
  prior_pending as (
    select coalesce(sum(c.remaining_amount),0)::numeric(19,2) as amount
      from commitment_base c
     where c.financial_month<v_current_month
       and c.remaining_amount>0
  ),
  recurring_dates as (
    select r.id as recurring_rule_id,r.template_transaction_id,
           occurrence_at::date as occurrence_date,
           date_trunc('month',occurrence_at)::date as financial_month,
           case when r.amount_mode='estimated' then r.estimated_amount
                else coalesce(r.estimated_amount,t.confirmed_amount,t.estimated_amount,t.amount)
            end::numeric(19,2) as amount
      from public.recurring_rules r
      join public.transactions t
        on t.id=r.template_transaction_id and t.household_id=r.household_id
       and t.type='expense' and t.deleted_at is null
       and t.economic_state not in ('cancelled','reversed')
      cross join lateral generate_series(
        r.start_date::timestamp,
        least(coalesce(r.end_date,'infinity'::date),
              (v_reference_month+(p_horizon_months||' months')::interval-interval '1 day')::date)::timestamp,
        case r.frequency
          when 'weekly' then make_interval(days=>7*r.interval_count)
          when 'monthly' then make_interval(months=>r.interval_count)
          when 'yearly' then make_interval(years=>r.interval_count)
        end
      ) occurrence_at
     where r.household_id=p_household_id and r.deactivated_at is null
       and r.start_date<(v_reference_month+(p_horizon_months||' months')::interval)::date
       and (r.end_date is null or r.end_date>=v_current_month)
       and (r.amount_mode<>'estimated' or r.estimated_amount is not null)
  ),
  projected_recurring as (
    select d.financial_month,sum(d.amount)::numeric(19,2) as amount
      from recurring_dates d
     where d.financial_month>=v_current_month
       and (v_tracking_month is null or d.financial_month>=v_tracking_month)
       and not exists (
         select 1 from public.recurring_occurrences o
          where o.household_id=p_household_id
            and o.recurring_rule_id=d.recurring_rule_id
            and o.competence_date=d.occurrence_date
       )
       and not exists (
         select 1 from commitment_base c
          where c.source_transaction_id=d.template_transaction_id
            and c.financial_month=d.financial_month
       )
     group by d.financial_month
  ),
  monthly as (
    select m.chain_month_index,m.financial_month,
           coalesce(i.realized_amount,0)::numeric(19,2) as realized_income,
           coalesce(i.expected_amount,0)::numeric(19,2) as expected_income,
           coalesce(c.realized_amount,0)::numeric(19,2) as realized_commitments,
           coalesce(c.remaining_amount,0)::numeric(19,2) as remaining_commitments,
           coalesce(r.amount,0)::numeric(19,2) as recurring_commitments,
           case when m.chain_month_index=0 then p.amount else 0::numeric end::numeric(19,2) as prior_pending
      from months m
      cross join prior_pending p
      left join incomes i using(financial_month)
      left join commitments c using(financial_month)
      left join projected_recurring r using(financial_month)
  ),
  calculated as (
    select m.*,
           (m.expected_income-m.remaining_commitments-m.recurring_commitments-m.prior_pending)::numeric(19,2) as net_change
      from monthly m
  ),
  projected as (
    select c.*,
           (base.amount+coalesce(sum(c.net_change) over (
             order by c.chain_month_index rows between unbounded preceding and 1 preceding
           ),0))::numeric(19,2) as projected_opening_cash,
           (base.amount+sum(c.net_change) over (
             order by c.chain_month_index rows between unbounded preceding and current row
           ))::numeric(19,2) as projected_ending_cash
      from calculated c cross join cash base
  )
  select p_household_id,v_reference_month,p.financial_month,
         (p.chain_month_index-v_reference_offset)::integer,
         p.projected_opening_cash,p.realized_income,p.expected_income,
         p.realized_commitments,p.remaining_commitments,p.recurring_commitments,
         p.prior_pending,p.net_change,p.projected_ending_cash
    from projected p
   where p.chain_month_index>=v_reference_offset
   order by p.chain_month_index;
end
$$;

comment on function public.financial_monthly_projection(uuid,date,integer) is
  'Cumulative household cash projection respecting the household financial cutover. Pre-cutover commitments are excluded; commitments in the cutover month or later remain projected, including historical card purchases whose open installments fall after cutover.';
