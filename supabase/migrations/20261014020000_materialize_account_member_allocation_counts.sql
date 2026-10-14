-- Keep account ownership counts from being re-evaluated for every funding route.
-- This view is consumed by financial_member_funding_positions, which can scan
-- hundreds of projected routes during invoice payment reconciliation.
-- Materializing these small household/account sets preserves the canonical
-- allocation rules while preventing repeated correlated scans of household_members.
create or replace view public.financial_account_member_allocations
with (security_invoker=true) as
with owners as materialized (
  select a.household_id,a.id account_id,m.id member_id,
    count(m.id) over(partition by a.id) owner_count,
    row_number() over(partition by a.id order by m.id) owner_order
  from public.accounts a
  join public.account_ownerships ao on ao.account_id=a.id and ao.household_id=a.household_id
  join public.household_members m on m.id=ao.member_id and m.household_id=a.household_id and m.deactivated_at is null
  where a.deactivated_at is null
), household_counts as materialized (
  select household_id,count(*) active_member_count
  from public.household_members
  where deactivated_at is null
  group by household_id
)
select o.household_id,o.account_id,o.member_id,o.owner_count,o.owner_order,
  case when o.owner_count=1 then 1::numeric
       when o.owner_count=2 and h.active_member_count=2 then .5::numeric
  end allocation_ratio,
  (o.owner_count=1 or (o.owner_count=2 and h.active_member_count=2)) is_valid
from owners o join household_counts h using(household_id);
