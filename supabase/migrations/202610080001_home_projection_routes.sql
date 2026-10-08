-- Casa Home: projected balance by resource and current third-party receivables.
-- Read models only: no new financial fact is created.
create or replace view public.financial_account_monthly_projection
with (security_invoker=true) as
with month_context as (
  select date_trunc('month',current_date)::date as financial_month
),
incomes as (
  select i.destination_account_id as account_id,
    coalesce(sum(i.amount) filter(where i.state='realized'),0)::numeric(19,2) as realized_income,
    coalesce(sum(i.reliable_remaining_amount) filter(where i.state='projected'),0)::numeric(19,2) as expected_income
  from public.financial_true_income_positions i
  cross join month_context m
  where i.financial_month=m.financial_month
  group by i.destination_account_id
),
realized_funding as (
  select f.source_account_id as account_id,
    coalesce(sum(f.amount),0)::numeric(19,2) as realized_outflow
  from public.funding_events f
  cross join month_context m
  where f.household_id is not null
    and date_trunc('month',f.funded_at)::date=m.financial_month
  group by f.source_account_id
),
projected_funding as (
  select r.source_account_id as account_id,
    coalesce(sum(r.route_amount),0)::numeric(19,2) as projected_outflow
  from public.financial_projected_funding_routes r
  cross join month_context m
  where r.financial_month=m.financial_month
    and r.route_amount>0
    and r.source_account_id is not null
  group by r.source_account_id
)
select a.household_id,a.account_id,a.name,a.type,a.current_balance::numeric(19,2),
  coalesce(i.realized_income,0)::numeric(19,2) realized_income,
  coalesce(i.expected_income,0)::numeric(19,2) expected_income,
  coalesce(f.realized_outflow,0)::numeric(19,2) realized_outflow,
  coalesce(p.projected_outflow,0)::numeric(19,2) projected_outflow,
  (a.current_balance+coalesce(i.expected_income,0)-coalesce(p.projected_outflow,0))::numeric(19,2) projected_ending_balance
from public.financial_available_cash_positions a
left join incomes i on i.account_id=a.account_id
left join realized_funding f on f.account_id=a.account_id
left join projected_funding p on p.account_id=a.account_id;

comment on view public.financial_account_monthly_projection is
  'Current resource position plus reliable remaining inflows and canonical projected funding routes for the current financial month. Projected balance is a planning signal, never realized cash and never evidence of future payment.';

create or replace view public.financial_home_third_party_receivables
with (security_invoker=true) as
select o.household_id,o.id as obligation_id,o.counterparty_id,
  fp.name as counterparty_name,o.due_date,
  greatest(b.outstanding_amount,0)::numeric(19,2) as outstanding_amount,
  date_trunc('month',coalesce(o.due_date,o.obligation_date))::date as financial_month
from public.financial_obligations o
join public.financial_obligation_balances b
  on b.obligation_id=o.id and b.household_id=o.household_id
left join public.financial_parties fp
  on fp.id=o.counterparty_id
where o.kind='receivable'
  and o.state not in ('cancelled','settled','written_off')
  and b.outstanding_amount>0;

comment on view public.financial_home_third_party_receivables is
  'Open third-party receivables available to the Home projection. They are projected inflows only; realization remains a separate event.';

revoke all on public.financial_account_monthly_projection,
  public.financial_home_third_party_receivables from public,anon;
grant select on public.financial_account_monthly_projection,
  public.financial_home_third_party_receivables to authenticated;
