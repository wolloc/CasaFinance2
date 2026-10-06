-- Fix card health semantics for the compact card summary.
-- current_invoice_remaining = the materialized current invoice only.
-- total_exposure still includes overdue open invoices + current + future + uninvoiced
-- commitments, because overdue card debt still consumes credit exposure.

create or replace view public.financial_card_exposure_positions
with (security_invoker=true) as
with invoice_amounts as (
  select
    i.household_id,
    i.card_id,
    coalesce(sum(i.remaining_amount) filter (
      where i.is_current_invoice
    ),0)::numeric(19,2) as current_invoice_remaining,
    coalesce(sum(i.remaining_amount) filter (
      where i.is_future_invoice
    ),0)::numeric(19,2) as future_invoice_remaining,
    coalesce(sum(i.remaining_amount) filter (
      where not i.is_future_invoice
    ),0)::numeric(19,2) as nonfuture_invoice_remaining,
    coalesce(bool_or(i.is_overdue),false) as has_overdue
  from public.financial_card_invoice_positions i
  where i.state <> 'cancelled'::invoice_state
    and i.remaining_amount > 0
  group by i.household_id,i.card_id
),
uninvoiced as (
  select
    p.household_id,
    p.card_id,
    coalesce(sum(p.remaining_amount),0)::numeric(19,2) as amount
  from public.financial_card_commitment_positions p
  where p.exposure_bucket='future_uninvoiced'
    and p.remaining_amount>0
    and p.commitment_state<>'forecast'::economic_state
  group by p.household_id,p.card_id
),
amounts as (
  select
    c.household_id,
    c.id as card_id,
    c.owner_member_id,
    c.name as card_name,
    c.credit_limit,
    c.default_payment_account_id,
    coalesce(i.current_invoice_remaining,0)::numeric(19,2) as current_invoice_remaining,
    (
      coalesce(i.future_invoice_remaining,0)+coalesce(u.amount,0)
    )::numeric(19,2) as future_known_commitments,
    (
      coalesce(i.nonfuture_invoice_remaining,0)
      +coalesce(i.future_invoice_remaining,0)
      +coalesce(u.amount,0)
    )::numeric(19,2) as total_exposure,
    coalesce(i.has_overdue,false) as has_overdue
  from public.cards c
  left join invoice_amounts i
    on i.card_id=c.id and i.household_id=c.household_id
  left join uninvoiced u
    on u.card_id=c.id and u.household_id=c.household_id
  where c.deactivated_at is null
)
select
  household_id,
  card_id,
  owner_member_id,
  card_name,
  credit_limit,
  default_payment_account_id,
  current_invoice_remaining,
  future_known_commitments,
  total_exposure,
  (credit_limit-total_exposure)::numeric(19,2) as available_limit,
  case
    when credit_limit=0 then
      case when total_exposure=0 then 0 else null end
    else round(total_exposure/credit_limit,6)
  end as utilization_ratio,
  greatest(total_exposure-credit_limit,0)::numeric(19,2) as over_limit_amount,
  has_overdue
from amounts;

comment on view public.financial_card_exposure_positions is
  'Card exposure separates the current invoice from overdue historical invoices. Current invoice is shown in the compact card summary; overdue balances remain part of total credit exposure.';

revoke all on public.financial_card_exposure_positions from public,anon;
grant select on public.financial_card_exposure_positions to authenticated;

create or replace view public.financial_card_health_positions
with (security_invoker=true) as
with invoice_risk as (
  select
    i.household_id,
    i.card_id,
    coalesce(sum(i.remaining_amount) filter (
      where i.is_overdue
    ),0)::numeric(19,2) as overdue_invoice_amount,
    coalesce(sum(i.remaining_amount) filter (
      where i.state <> 'cancelled'::invoice_state
        and not i.is_overdue
        and i.due_date >= current_date
        and i.due_date <= current_date+7
    ),0)::numeric(19,2) as due_soon_amount,
    min(i.due_date) filter (
      where i.remaining_amount>0
        and i.state <> 'cancelled'::invoice_state
        and i.due_date >= current_date
    ) as next_due_date
  from public.financial_card_invoice_positions i
  group by i.household_id,i.card_id
)
select
  e.household_id,
  e.card_id,
  e.owner_member_id,
  e.card_name,
  e.credit_limit,
  e.current_invoice_remaining,
  e.future_known_commitments,
  e.total_exposure,
  e.available_limit,
  e.utilization_ratio,
  e.over_limit_amount,
  coalesce(r.overdue_invoice_amount,0)::numeric(19,2) as overdue_invoice_amount,
  coalesce(r.due_soon_amount,0)::numeric(19,2) as due_soon_amount,
  r.next_due_date,
  case
    when e.over_limit_amount>0 or coalesce(r.overdue_invoice_amount,0)>0 then 'red'
    when coalesce(e.utilization_ratio,0)>.80 then 'red'
    when coalesce(e.utilization_ratio,0)>.50 or coalesce(r.due_soon_amount,0)>0 then 'yellow'
    else 'green'
  end as card_health,
  case
    when e.over_limit_amount>0 then 'over_limit'
    when coalesce(r.overdue_invoice_amount,0)>0 then 'overdue_invoice'
    when coalesce(e.utilization_ratio,0)>.80 then 'high_utilization'
    when coalesce(e.utilization_ratio,0)>.50 then 'moderate_utilization'
    when coalesce(r.due_soon_amount,0)>0 then 'due_soon'
    else 'comfortable'
  end as health_reason
from public.financial_card_exposure_positions e
left join invoice_risk r
  on r.household_id=e.household_id
 and r.card_id=e.card_id;

comment on view public.financial_card_health_positions is
  'Objective card health signals. Current invoice and overdue invoice are separated; next_due_date never points to an already overdue invoice.';

revoke all on public.financial_card_health_positions from public,anon;
grant select on public.financial_card_health_positions to authenticated;
