-- Casa Finance: third-party responsibility projected per canonical commitment.
-- Read model only: does not create obligations, cash movements, or financial facts.
-- A card purchase with installments is represented by each installment commitment,
-- using the canonical invoice due date from financial_commitment_positions.

create or replace view public.financial_third_party_commitment_positions
with (security_invoker=true) as
select
  r.household_id,
  r.commitment_key,
  r.source_type,
  r.source_id,
  r.source_transaction_id,
  r.source_installment_id,
  c.source_invoice_id as invoice_id,
  r.responsible_party_id as counterparty_id,
  p.name as counterparty_name,
  r.financial_date,
  r.financial_month,
  r.commitment_state,
  r.responsibility_amount::numeric(19,2) as responsibility_amount,
  r.realized_responsibility_amount::numeric(19,2) as funded_responsibility_amount,
  greatest(r.remaining_responsibility_amount,0)::numeric(19,2) as expected_contribution_amount,
  c.description,
  c.due_date,
  c.economic_date
from public.financial_member_commitment_responsibility_positions r
join public.financial_commitment_positions c
  on c.household_id=r.household_id
 and c.commitment_key=r.commitment_key
join public.financial_parties p
  on p.id=r.responsible_party_id
 and p.household_id=r.household_id
 and p.deactivated_at is null
where r.responsible_party_id is not null
  and r.responsibility_amount>0
  and r.commitment_state not in ('cancelled','reversed')
  and r.remaining_responsibility_amount>0;

comment on view public.financial_third_party_commitment_positions is
  'Expected third-party contributions derived from economic allocations per canonical financial commitment (including each card installment and invoice due date). Read-only projection; never a realized inflow or evidence of funding. Fully funded/realized responsibility is excluded here and must be represented by a linked receivable lifecycle when the household covered it.';

revoke all on public.financial_third_party_commitment_positions from public,anon;
grant select on public.financial_third_party_commitment_positions to authenticated;
