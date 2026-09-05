-- Etapa 10H.9: canonical card invoices, known future commitments and exposure.
-- These views classify existing financial representations; they never create an
-- economic event, funding event, commitment, or cash movement.

create or replace view public.financial_card_invoice_positions
with (security_invoker=true) as
select i.household_id,
       i.card_id,
       i.id as invoice_id,
       i.competence_date as invoice_month,
       i.competence_date as competence,
       i.closing_date,
       i.due_date,
       i.total_amount::numeric(19,2) as known_invoice_amount,
       i.settled_amount::numeric(19,2) as paid_amount,
       greatest(i.total_amount-i.settled_amount-i.financed_balance,0)::numeric(19,2) as remaining_amount,
       i.status as state,
       (i.due_date<current_date and i.status not in ('paid','cancelled')
         and i.total_amount>i.settled_amount+i.financed_balance) as is_overdue,
       (i.competence_date=date_trunc('month',current_date)::date) as is_current_invoice,
       (i.competence_date>date_trunc('month',current_date)::date) as is_future_invoice,
       (i.due_date-current_date) as days_until_due
from public.card_invoices i
join public.cards c on c.id=i.card_id and c.household_id=i.household_id
where i.deleted_at is null and c.deactivated_at is null;

comment on view public.financial_card_invoice_positions is
  'Canonical invoice metadata. paid/remaining come only from the invoice settlement contract; account movements alone are not payment evidence. financed_balance is already moved out of this invoice and is therefore excluded.';

-- Resolve each already-deduplicated commitment to exactly one card. An invoice
-- is stronger evidence than the purchase instrument. The latter is used only
-- while an installment/commitment has no materialized invoice.
create or replace view public.financial_card_commitment_positions
with (security_invoker=true) as
select cp.household_id,
       coalesce(inv.card_id,pi.card_id) as card_id,
       cp.commitment_key,
       cp.source_type,
       cp.source_id,
       cp.source_transaction_id,
       cp.source_installment_id,
       cp.source_invoice_id,
       cp.financial_date,
       cp.financial_month,
       cp.due_date,
       cp.effective_amount,
       cp.realized_amount,
       cp.remaining_amount,
       cp.commitment_state,
       cp.is_overdue,
       cp.description,
       (inv.id is not null) as is_materialized_invoice,
       case
         when inv.id is not null and inv.competence_date<=date_trunc('month',current_date)::date then 'current_invoice'
         when inv.id is not null then 'future_invoice'
         else 'future_uninvoiced'
       end as exposure_bucket
from public.financial_commitment_positions cp
left join public.card_invoices inv
  on inv.id=cp.source_invoice_id and inv.household_id=cp.household_id
 and inv.deleted_at is null and inv.status<>'cancelled'
left join public.transaction_payment_instruments pi
  on pi.transaction_id=cp.source_transaction_id and pi.household_id=cp.household_id
 and pi.kind='card'
join public.cards c
  on c.id=coalesce(inv.card_id,pi.card_id) and c.household_id=cp.household_id
 and c.deactivated_at is null
where cp.commitment_state not in ('cancelled','reversed');

comment on view public.financial_card_commitment_positions is
  'One card mapping per canonical commitment. Materialized invoice wins; otherwise the explicit card instrument supplies the card. owner/buyer/creator/default account are never attribution fallbacks.';

create or replace view public.financial_card_future_commitments
with (security_invoker=true) as
select household_id,card_id,commitment_key,source_type,source_id,
       source_transaction_id,source_installment_id,source_invoice_id,
       financial_date,financial_month,due_date,effective_amount,realized_amount,
       remaining_amount,commitment_state,is_overdue,description,
       exposure_bucket,(exposure_bucket='future_invoice') as is_materialized_invoice
from public.financial_card_commitment_positions
where exposure_bucket in ('future_invoice','future_uninvoiced')
  and remaining_amount>0;

comment on view public.financial_card_future_commitments is
  'Known future card obligations only. A materialized installment is represented through its invoice bucket and is never emitted again as an uninvoiced installment; financial_month is inherited unchanged from financial_commitment_positions.';

create or replace view public.financial_card_exposure_positions
with (security_invoker=true) as
with invoice_amounts as (
 select household_id,card_id,
   coalesce(sum(remaining_amount) filter(where not is_future_invoice),0)::numeric(19,2) current_invoice_remaining,
   coalesce(sum(remaining_amount) filter(where is_future_invoice),0)::numeric(19,2) future_invoice_remaining,
   coalesce(bool_or(is_overdue),false) has_overdue
 from public.financial_card_invoice_positions
 where state<>'cancelled' and remaining_amount>0
 group by household_id,card_id
), uninvoiced as (
 select household_id,card_id,coalesce(sum(remaining_amount),0)::numeric(19,2) amount
 from public.financial_card_commitment_positions
 where exposure_bucket='future_uninvoiced' and remaining_amount>0
 group by household_id,card_id
), amounts as (
 select c.household_id,c.id as card_id,c.owner_member_id,c.name as card_name,
        c.credit_limit,c.default_payment_account_id,
        coalesce(i.current_invoice_remaining,0)::numeric(19,2) as current_invoice_remaining,
        (coalesce(i.future_invoice_remaining,0)+coalesce(u.amount,0))::numeric(19,2) as future_known_commitments,
        (coalesce(i.current_invoice_remaining,0)+coalesce(i.future_invoice_remaining,0)+coalesce(u.amount,0))::numeric(19,2) as total_exposure,
        coalesce(i.has_overdue,false) as has_overdue
 from public.cards c
 left join invoice_amounts i on i.card_id=c.id and i.household_id=c.household_id
 left join uninvoiced u on u.card_id=c.id and u.household_id=c.household_id
 where c.deactivated_at is null
)
select household_id,card_id,owner_member_id,card_name,
       credit_limit::numeric(19,2),default_payment_account_id,
       current_invoice_remaining,future_known_commitments,total_exposure,
       (credit_limit-total_exposure)::numeric(19,2) as available_limit,
       case when credit_limit=0 then case when total_exposure=0 then 0::numeric else null::numeric end
            else round(total_exposure/credit_limit,6) end as utilization_ratio,
       greatest(total_exposure-credit_limit,0)::numeric(19,2) as over_limit_amount,
       has_overdue
from amounts;

comment on view public.financial_card_exposure_positions is
  'Instrument-level limit exposure from mutually exclusive commitment buckets. Available limit may be negative; the limit is neither cash nor member property. The default account remains projection metadata only.';

create or replace view public.financial_member_card_positions
with (security_invoker=true) as
with card_members as (
 select c.household_id,c.id as card_id,m.id as member_id
 from public.cards c
 join public.household_members m on m.household_id=c.household_id and m.deactivated_at is null
 where c.deactivated_at is null
), responsibility as (
 select p.household_id,p.card_id,r.member_id,
   coalesce(sum(r.remaining_responsibility_amount),0)::numeric(19,2) as member_responsibility_exposure,
   coalesce(sum(r.remaining_responsibility_amount) filter(where p.exposure_bucket='current_invoice'),0)::numeric(19,2) as member_current_invoice_responsibility,
   coalesce(sum(r.remaining_responsibility_amount) filter(where p.exposure_bucket in ('future_invoice','future_uninvoiced')),0)::numeric(19,2) as member_future_responsibility
 from public.financial_card_commitment_positions p
 join public.financial_member_commitment_responsibility_positions r
   on r.household_id=p.household_id and r.commitment_key=p.commitment_key
 where r.member_id is not null and p.remaining_amount>0
 group by p.household_id,p.card_id,r.member_id
)
select cm.household_id,cm.card_id,cm.member_id,e.owner_member_id,
       e.credit_limit,e.total_exposure,e.available_limit,e.utilization_ratio,e.over_limit_amount,
       coalesce(r.member_current_invoice_responsibility,0)::numeric(19,2) as member_current_invoice_responsibility,
       coalesce(r.member_future_responsibility,0)::numeric(19,2) as member_future_responsibility,
       coalesce(r.member_responsibility_exposure,0)::numeric(19,2) as member_responsibility_exposure
from card_members cm
join public.financial_card_exposure_positions e
  on e.household_id=cm.household_id and e.card_id=cm.card_id
left join responsibility r
  on r.household_id=cm.household_id and r.card_id=cm.card_id and r.member_id=cm.member_id;

comment on view public.financial_member_card_positions is
  'Member economic responsibility inside a card exposure, derived exclusively from canonical economic allocations. Card owner and limit stay instrument metadata and are never allocated to a member.';

revoke all on public.financial_card_invoice_positions from public,anon;
revoke all on public.financial_card_commitment_positions from public,anon;
revoke all on public.financial_card_future_commitments from public,anon;
revoke all on public.financial_card_exposure_positions from public,anon;
revoke all on public.financial_member_card_positions from public,anon;
grant select on public.financial_card_invoice_positions to authenticated;
grant select on public.financial_card_commitment_positions to authenticated;
grant select on public.financial_card_future_commitments to authenticated;
grant select on public.financial_card_exposure_positions to authenticated;
grant select on public.financial_member_card_positions to authenticated;

-- Conservative refund boundary: cancelled/refunded installments and canonical
-- reversed commitments reduce exposure to zero. Partial invoice credits require
-- an explicit update of card_invoices totals/settlement plus an auditable link;
-- transaction description, merchant and amount sign are intentionally ignored.
