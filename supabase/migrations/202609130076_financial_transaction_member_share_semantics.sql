-- PR B: Casa is an aggregation context, never a residual economic owner.
-- Distinguish truly legacy expenses with no economic allocations from current
-- expenses whose responsibility is entirely assigned to third parties.

create or replace view public.financial_transaction_positions with (security_invoker=true) as
with allocations as (
  select household_id,transaction_id,
         count(*) allocation_count,
         coalesce(sum(amount) filter(where responsible_member_id is not null),0) household_economic_amount,
         coalesce(sum(amount) filter(where responsible_party_id is not null),0) third_party_economic_amount
  from public.economic_allocations
  group by household_id,transaction_id
), paid as (
  select household_id,related_transaction_id transaction_id,sum(amount) gross_cash_paid
  from public.money_movements
  where state='realized' and kind='expense_payment' and related_transaction_id is not null
  group by household_id,related_transaction_id
), receivables as (
  select o.household_id,o.source_transaction_id transaction_id,sum(b.outstanding_amount) third_party_receivable_outstanding
  from public.financial_obligations o
  join public.financial_obligation_balances b on b.obligation_id=o.id and b.household_id=o.household_id
  where o.kind='receivable' and o.origin_kind='shared_expense' and o.source_transaction_id is not null
  group by o.household_id,o.source_transaction_id
)
select t.household_id,
       t.id transaction_id,
       t.economic_state,
       t.amount gross_event_amount,
       case when coalesce(a.allocation_count,0)=0 then t.amount else a.household_economic_amount end household_economic_amount,
       coalesce(a.third_party_economic_amount,0) third_party_economic_amount,
       coalesce(p.gross_cash_paid,0) gross_cash_paid,
       coalesce(r.third_party_receivable_outstanding,0) third_party_receivable_outstanding
from public.transactions t
left join allocations a on a.transaction_id=t.id and a.household_id=t.household_id
left join paid p on p.transaction_id=t.id and p.household_id=t.household_id
left join receivables r on r.transaction_id=t.id and r.household_id=t.household_id
where t.type='expense'
  and t.deleted_at is null
  and t.economic_state not in ('cancelled','reversed');

revoke all on public.financial_transaction_positions from public,anon;
grant select on public.financial_transaction_positions to authenticated;

comment on view public.financial_transaction_positions is
  'Canonical expense position. household_economic_amount is the sum attributed to active Casa-member allocations when allocations exist; all-third-party responsibility is therefore zero. Gross amount is used only as legacy fallback when the transaction has no economic allocations.';
