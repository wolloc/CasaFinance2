-- PR A: a Casa é contexto de agregação, não sujeito econômico.
-- Reembolsos a terceiros ligados a uma despesa devem preservar a responsabilidade
-- dos membros da transação de origem. A parcela econômica de terceiros não pode
-- reaparecer como responsabilidade em um pagável que já foi limitado aos membros.

create or replace view public.financial_member_commitment_responsibility_positions
with (security_invoker=true) as
with member_totals as (
  select
    a.household_id,
    a.transaction_id,
    sum(a.amount)::numeric(19,2) as member_total
  from public.economic_allocations a
  where a.responsible_member_id is not null
  group by a.household_id,a.transaction_id
), allocation_source as (
  select
    c.*,
    case
      when o.origin_kind='reimbursement' and c.source_obligation_id is not null
        then member_allocation.responsible_member_id
      else allocation.responsible_member_id
    end as responsible_member_id,
    case
      when o.origin_kind='reimbursement' and c.source_obligation_id is not null
        then null::uuid
      else allocation.responsible_party_id
    end as responsible_party_id,
    case
      when o.origin_kind='reimbursement' and c.source_obligation_id is not null
        then member_allocation.allocation_order
      else allocation.allocation_order
    end as allocation_order,
    case
      when o.origin_kind='reimbursement' and c.source_obligation_id is not null
        then case
          when member_total.member_total>0
            then (member_allocation.amount/member_total.member_total*100)::numeric
          else null::numeric
        end
      else allocation.percentage
    end as percentage
  from public.financial_commitment_positions c
  left join public.financial_obligations o
    on o.id=c.source_obligation_id
   and o.household_id=c.household_id
  left join public.economic_allocations allocation
    on allocation.transaction_id=c.source_transaction_id
   and allocation.household_id=c.household_id
   and not (o.origin_kind='reimbursement' and c.source_obligation_id is not null)
  left join public.economic_allocations member_allocation
    on member_allocation.transaction_id=c.source_transaction_id
   and member_allocation.household_id=c.household_id
   and member_allocation.responsible_member_id is not null
   and o.origin_kind='reimbursement'
   and c.source_obligation_id is not null
  left join member_totals member_total
    on member_total.transaction_id=c.source_transaction_id
   and member_total.household_id=c.household_id
), ranked as (
  select
    s.*,
    row_number() over(
      partition by s.commitment_key
      order by s.allocation_order nulls last,s.responsible_member_id nulls last,s.responsible_party_id nulls last
    ) as allocation_rank,
    count(*) over(partition by s.commitment_key) as allocation_count
  from allocation_source s
), cents as (
  select
    s.*,
    floor(round(effective_amount*100)*coalesce(percentage,100)/100)::bigint as effective_base,
    floor(round(realized_amount*100)*coalesce(percentage,100)/100)::bigint as realized_base,
    round(effective_amount*100)::bigint
      - sum(floor(round(effective_amount*100)*coalesce(percentage,100)/100)::bigint)
        over(partition by commitment_key) as effective_remainder,
    round(realized_amount*100)::bigint
      - sum(floor(round(realized_amount*100)*coalesce(percentage,100)/100)::bigint)
        over(partition by commitment_key) as realized_remainder
  from ranked s
), allocated as (
  select
    c.*,
    (effective_base+case when allocation_rank<=effective_remainder then 1 else 0 end)::numeric/100 as responsibility_amount,
    (realized_base+case when allocation_rank<=realized_remainder then 1 else 0 end)::numeric/100 as realized_responsibility_amount
  from cents c
)
select
  household_id,
  commitment_key,
  source_type,
  source_id,
  source_transaction_id,
  source_installment_id,
  source_obligation_id,
  source_recurring_occurrence_id,
  financial_date,
  financial_month,
  commitment_state,
  responsible_member_id as member_id,
  responsible_party_id,
  allocation_order,
  responsibility_amount::numeric(19,2),
  realized_responsibility_amount::numeric(19,2),
  (responsibility_amount-realized_responsibility_amount)::numeric(19,2) as remaining_responsibility_amount,
  (responsible_member_id is null) as is_unattributed_to_member
from allocated;

comment on view public.financial_member_commitment_responsibility_positions is
  'Member responsibility by commitment. Reimbursement payables are attributed only across the responsible household members from the source expense, normalized to the reimbursable member total; third-party economic responsibility never becomes member debt. Household is scope/aggregation, not an economic owner.';