-- Bridge migration for environments whose 202609060044 card journey view
-- was applied before the reserved credit columns were present in the repository.
--
-- Historical migrations remain immutable. This forward-only bridge sits after
-- 202609060056 and before 202609060057 so the refund migration can safely use
-- CREATE OR REPLACE VIEW without trying to rename existing columns by ordinal.
--
-- This view is derived/read-only: dropping and recreating it does not delete
-- financial facts.

drop view if exists public.financial_card_journey_positions;

create view public.financial_card_journey_positions
with (security_invoker=true) as
with invoice_base as (
  select i.household_id,i.card_id,i.invoice_id,i.invoice_month,i.due_date,
         i.known_invoice_amount,i.paid_amount,i.remaining_amount,i.state,
         i.is_current_invoice,i.is_future_invoice
  from public.financial_card_invoice_positions i
  where i.state<>'cancelled'
), commitments as (
  select p.household_id,p.card_id,p.source_invoice_id,
         count(*) filter(where p.source_transaction_id is not null) as purchase_commitment_count,
         count(*) filter(where p.source_installment_id is not null) as installment_count,
         coalesce(sum(p.effective_amount),0)::numeric(19,2) as commitment_amount
  from public.financial_card_commitment_positions p
  where p.source_invoice_id is not null
  group by p.household_id,p.card_id,p.source_invoice_id
), payments as (
  select cip.household_id,cip.invoice_id,
         coalesce(sum(cip.amount),0)::numeric(19,2) as payment_amount,
         max(cip.paid_at) as last_paid_at,
         jsonb_agg(jsonb_build_object(
           'account_id',cip.source_account_id,
           'amount',cip.amount,
           'paid_at',cip.paid_at
         ) order by cip.paid_at) as payment_events
  from public.card_invoice_payments cip
  group by cip.household_id,cip.invoice_id
), funders as (
  select f.household_id,f.invoice_id,
         jsonb_agg(jsonb_build_object(
           'member_id',f.funder_member_id,
           'amount',f.amount,
           'funded_at',f.funded_at
         ) order by f.funded_at) as funding_events
  from public.funding_events f
  where f.invoice_id is not null
  group by f.household_id,f.invoice_id
), settlement_sources as (
  select distinct p.household_id,p.source_invoice_id as invoice_id,p.source_transaction_id
  from public.financial_card_commitment_positions p
  where p.source_invoice_id is not null
    and p.source_transaction_id is not null
), settlements as (
  select s.household_id,s.invoice_id,
         jsonb_agg(jsonb_build_object(
           'debtor_member_id',e.debtor_member_id,
           'creditor_member_id',e.creditor_member_id,
           'amount',e.amount,
           'state',e.state,
           'financial_date',e.financial_date
         ) order by e.financial_date,e.created_at) as settlement_events
  from settlement_sources s
  join public.member_settlement_events e
    on e.household_id=s.household_id
   and e.source_transaction_id=s.source_transaction_id
   and e.kind='responsibility_funding'
  where e.state<>'cancelled'
  group by s.household_id,s.invoice_id
)
select i.household_id,i.card_id,c.name as card_name,i.invoice_id,i.invoice_month,i.due_date,
       i.known_invoice_amount,i.paid_amount,i.remaining_amount,i.state,
       i.is_current_invoice,i.is_future_invoice,
       coalesce(cm.purchase_commitment_count,0)::bigint as purchase_commitment_count,
       coalesce(cm.installment_count,0)::bigint as installment_count,
       coalesce(cm.commitment_amount,0)::numeric(19,2) as commitment_amount,
       coalesce(p.payment_amount,0)::numeric(19,2) as payment_amount,
       p.last_paid_at,
       coalesce(p.payment_events,'[]'::jsonb) as payment_events,
       0::numeric(19,2) as credit_amount,
       '[]'::jsonb as credit_events,
       coalesce(f.funding_events,'[]'::jsonb) as funding_events,
       coalesce(s.settlement_events,'[]'::jsonb) as settlement_events
from invoice_base i
join public.cards c
  on c.id=i.card_id
 and c.household_id=i.household_id
 and c.deactivated_at is null
left join commitments cm
  on cm.household_id=i.household_id
 and cm.source_invoice_id=i.invoice_id
left join payments p
  on p.household_id=i.household_id
 and p.invoice_id=i.invoice_id
left join funders f
  on f.household_id=i.household_id
 and f.invoice_id=i.invoice_id
left join settlements s
  on s.household_id=i.household_id
 and s.invoice_id=i.invoice_id;

comment on view public.financial_card_journey_positions is
  'Bridge-compatible card journey. Credit columns are reserved as neutral placeholders until the explicit card refund migration populates them.';

revoke all on public.financial_card_journey_positions from public,anon;
grant select on public.financial_card_journey_positions to authenticated;
