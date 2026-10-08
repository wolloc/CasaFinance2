-- Etapa 10H.7: canonical cumulative household cash projection.
-- Facts remain in the ledgers; this migration persists no projection snapshots.

create or replace view public.financial_available_cash_positions
with (security_invoker=true) as
select b.household_id,
       b.account_id,
       b.name,
       b.type,
       b.current_balance::numeric(19,2) as current_balance
  from public.financial_account_balances b
 where b.type in ('cash','checking','savings','digital_wallet','meal_benefit')
   and (b.resource_restriction is null or b.resource_restriction='meal_benefit');

comment on view public.financial_available_cash_positions is
  'Real household usable resources from canonical balance events plus realized movement legs. Meal benefits are usable resources; reserves, investments and every credit limit remain excluded. Negative balances remain negative.';

create or replace view public.financial_true_income_positions
with (security_invoker=true) as
select m.household_id,
       m.id as money_movement_id,
       m.state,
       m.amount::numeric(19,2) as amount,
       case when m.state='realized' then 0::numeric
            else least(m.amount,greatest(t.confirmed_amount-t.realized_amount,0))
        end::numeric(19,2) as reliable_remaining_amount,
       m.movement_date,
       m.competence_date as financial_month,
       m.destination_account_id
  from public.money_movements m
  join public.accounts destination
    on destination.id=m.destination_account_id
   and destination.household_id=m.household_id
   and destination.deactivated_at is null
  left join public.transactions t
    on t.id=m.related_transaction_id
   and t.household_id=m.household_id
   and t.type='income'
   and t.deleted_at is null
 where m.kind='income'
   and destination.type in ('cash','checking','savings','digital_wallet')
   and destination.resource_restriction is null
   and (
     m.state='realized'
     or (
       m.state='projected'
       and t.economic_state='confirmed'
       and t.confirmed_amount is not null
       and t.realized_amount<t.confirmed_amount
       and 1=(
         select count(*) from public.money_movements candidate
          where candidate.household_id=m.household_id
            and candidate.kind='income' and candidate.state='projected'
            and candidate.related_transaction_id=m.related_transaction_id
       )
     )
   );

comment on view public.financial_true_income_positions is
  'True income movements into available cash. A future movement is reliable only when uniquely linked to an explicitly confirmed income transaction; unlinked/projected forecasts and all neutral movement kinds are excluded.';

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
  v_current_month date:=date_trunc('month',current_date)::date;
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
  v_reference_offset:=((extract(year from v_reference_month)-extract(year from v_current_month))*12
    +extract(month from v_reference_month)-extract(month from v_current_month))::integer;
  if not public.is_active_household_member(p_household_id) then
    raise exception 'active household membership required' using errcode='42501';
  end if;

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
  commitments as (
    select c.financial_month,
           coalesce(sum(c.realized_amount),0)::numeric(19,2) as realized_amount,
           coalesce(sum(c.remaining_amount),0)::numeric(19,2) as remaining_amount
      from public.financial_commitment_positions c
     where c.household_id=p_household_id
       and c.financial_month between v_current_month
           and (v_reference_month+((p_horizon_months-1)||' months')::interval)::date
       and c.commitment_state not in ('cancelled','reversed')
     group by c.financial_month
  ),
  prior_pending as (
    select coalesce(sum(c.remaining_amount),0)::numeric(19,2) as amount
      from public.financial_commitment_positions c
     where c.household_id=p_household_id
       and c.financial_month<v_current_month
       and c.remaining_amount>0
       and c.commitment_state not in ('cancelled','reversed')
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
       and not exists (
         select 1 from public.recurring_occurrences o
          where o.household_id=p_household_id
            and o.recurring_rule_id=d.recurring_rule_id
            and o.competence_date=d.occurrence_date
       )
       and not exists (
         select 1 from public.financial_commitment_positions c
          where c.household_id=p_household_id
            and c.source_transaction_id=d.template_transaction_id
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
  )
  , projected as (
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
  'Cumulative household cash projection. Current canonical cash is adjusted only by unrealized reliable income and remaining commitments; realized flows are explanatory metrics and are never applied twice. Prior open commitments are charged once in month zero.';

revoke all on public.financial_available_cash_positions,
  public.financial_true_income_positions from public,anon;
grant select on public.financial_available_cash_positions,
  public.financial_true_income_positions to authenticated;
revoke all on function public.financial_monthly_projection(uuid,date,integer)
  from public,anon;
grant execute on function public.financial_monthly_projection(uuid,date,integer)
  to authenticated;

-- Deliberate schema boundaries:
-- * opening_balance is legacy and intentionally absent: financial_account_balances
--   already derives the one canonical position from non-reversed balance events
--   plus realized money-movement legs;
-- * projected is not synonymous with reliable. A projected income movement is
--   admitted only when it is the single projection linked to an explicitly
--   confirmed income transaction. Its confirmed-versus-realized remainder
--   prevents a receipt from being counted twice. Unlinked forecasts stay out;
-- * active recurring expense rules can conservatively extend commitments when
--   their amount is usable. A materialized occurrence wins on its exact date.
--   Income rules are not projected because the current schema has no durable
--   reliability classification for an unmaterialized income rule;
-- * the economic chain always starts in the current month. A future reference
--   month only filters the returned rows, so intermediate months and the single
--   prior-pending charge remain in its opening cash. Historical references are
--   rejected because the schema has no canonical historical cash snapshots.
