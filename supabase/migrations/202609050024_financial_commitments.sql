-- Etapa 10H.6: canonical monthly outgoing commitment positions.
-- Commitments are conclusions derived from facts; no mutable snapshot is stored.

create or replace view public.financial_commitment_positions
with (security_invoker=true) as
with
invoice_payment_evidence as (
  select cip.household_id, cip.invoice_id, cip.payment_transaction_id,
    cip.source_account_id
  from public.card_invoice_payments cip
  join public.transactions payment
    on payment.id=cip.payment_transaction_id
   and payment.household_id=cip.household_id
   and payment.type='invoice_payment'
   and payment.status='paid'
   and payment.settled_at is not null
   and payment.deleted_at is null
   and payment.amount=cip.amount
  join public.funding_events allocated
    on allocated.household_id=cip.household_id
   and allocated.invoice_id=cip.invoice_id
   and allocated.funding_transaction_id=cip.payment_transaction_id
   and allocated.source_account_id=cip.source_account_id
  group by cip.household_id,cip.invoice_id,cip.payment_transaction_id,
    cip.source_account_id,cip.amount
  having sum(allocated.amount)=cip.amount
),
installment_funding as (
  select f.household_id, f.installment_id,
    sum(f.amount)::numeric(19,2) as realized_amount
  from public.funding_events f
  join public.installments i
    on i.id=f.installment_id
   and i.household_id=f.household_id
   and i.invoice_id=f.invoice_id
  join public.installment_plans ip
    on ip.id=i.installment_plan_id
   and ip.household_id=f.household_id
   and ip.purchase_transaction_id=f.financed_transaction_id
  join invoice_payment_evidence paid
    on paid.household_id=f.household_id
   and paid.invoice_id=f.invoice_id
   and paid.payment_transaction_id=f.funding_transaction_id
   and paid.source_account_id=f.source_account_id
  where f.installment_id is not null and f.invoice_id is not null
  group by f.household_id, f.installment_id
),
direct_funding as (
  select household_id, financed_transaction_id, sum(amount)::numeric(19,2) as realized_amount
  from public.funding_events
  where installment_id is null and invoice_id is null
  group by household_id, financed_transaction_id
),
obligation_realization as (
  select household_id, obligation_id,
    sum(amount) filter (where kind='payment')::numeric(19,2) as realized_amount
  from public.obligation_events
  group by household_id, obligation_id
),
raw_positions as (
  -- A card installment, not its purchase or invoice, is the commitment unit.
  select i.household_id,
    'installment:' || i.id::text as commitment_key,
    'card_installment'::text as source_type, i.id as source_id,
    p.purchase_transaction_id as source_transaction_id, i.id as source_installment_id,
    i.invoice_id as source_invoice_id, null::uuid as source_obligation_id,
    null::uuid as source_recurring_occurrence_id,
    'card_installment'::text as commitment_type, 'outflow'::text as direction,
    t.type::text as economic_type,
    coalesce(i.due_date,i.competence_date) as financial_date,
    i.due_date, t.transaction_date as economic_date,
    case when i.status='cancelled' then 'cancelled'::public.economic_state
         when i.status='refunded' then 'reversed'::public.economic_state
         else t.economic_state end as source_state,
    i.amount::numeric(19,2) as estimated_amount,
    i.amount::numeric(19,2) as confirmed_amount,
    least(coalesce(f.realized_amount,0),i.amount)::numeric(19,2) as realized_amount,
    t.description, t.category_id, t.created_by_member_id
  from public.installments i
  join public.installment_plans p on p.id=i.installment_plan_id and p.household_id=i.household_id
  join public.transactions t on t.id=p.purchase_transaction_id and t.household_id=i.household_id
  left join installment_funding f on f.installment_id=i.id and f.household_id=i.household_id
  where t.deleted_at is null

  union all

  -- A materialized occurrence is represented once; its rule is never emitted.
  select o.household_id,
    'recurring_occurrence:' || o.id::text, 'recurring_occurrence', o.id,
    t.id, null::uuid, t.invoice_id, null::uuid, o.id,
    'recurring_expense', 'outflow', t.type::text,
    coalesce(o.due_date,o.competence_date,t.due_date,t.competence_date),
    coalesce(o.due_date,t.due_date), t.transaction_date,
    case when o.status='cancelled' then 'cancelled'::public.economic_state else t.economic_state end,
    coalesce(o.estimated_amount,t.estimated_amount,t.amount)::numeric(19,2),
    coalesce(o.confirmed_amount,t.confirmed_amount)::numeric(19,2),
    greatest(t.realized_amount,coalesce(f.realized_amount,0))::numeric(19,2),
    t.description,t.category_id,t.created_by_member_id
  from public.recurring_occurrences o
  join public.transactions t on t.id=o.transaction_id and t.household_id=o.household_id
  left join direct_funding f on f.financed_transaction_id=t.id and f.household_id=t.household_id
  where t.type='expense' and t.deleted_at is null
    and not exists (select 1 from public.installment_plans p where p.purchase_transaction_id=t.id)
    and not exists (select 1 from public.financial_obligations x where x.kind='payable' and x.source_transaction_id=t.id)

  union all

  -- Direct expenses are fallback commitments only when no more specific
  -- installment, materialized occurrence, or payable exists.
  select t.household_id,
    'transaction:' || t.id::text, 'direct_expense', t.id,
    t.id, null::uuid, t.invoice_id, null::uuid, null::uuid,
    'direct_expense', 'outflow', t.type::text,
    coalesce(t.due_date,t.competence_date,t.transaction_date),
    t.due_date,t.transaction_date,t.economic_state,
    coalesce(t.estimated_amount,t.amount)::numeric(19,2),
    t.confirmed_amount::numeric(19,2),
    greatest(t.realized_amount,coalesce(f.realized_amount,0))::numeric(19,2),
    t.description,t.category_id,t.created_by_member_id
  from public.transactions t
  left join direct_funding f on f.financed_transaction_id=t.id and f.household_id=t.household_id
  where t.type='expense' and t.deleted_at is null
    and not exists (select 1 from public.installment_plans p where p.purchase_transaction_id=t.id)
    and not exists (select 1 from public.recurring_occurrences o where o.transaction_id=t.id)
    and not exists (select 1 from public.financial_obligations x where x.kind='payable' and x.source_transaction_id=t.id)

  union all

  -- Receivables are deliberately absent: they are neither outgoing
  -- commitments nor reliable inflows in this layer.
  select o.household_id,
    'payable:' || o.id::text, 'payable', o.id,
    o.source_transaction_id,null::uuid,o.invoice_id,o.id,null::uuid,
    'payable','outflow','obligation',
    coalesce(o.due_date,o.obligation_date),o.due_date,o.obligation_date,
    case when o.state='cancelled' then 'cancelled'::public.economic_state
         when o.state='written_off' then 'reversed'::public.economic_state
         when o.state='settled' then 'realized'::public.economic_state
         else 'confirmed'::public.economic_state end,
    null::numeric(19,2),o.original_amount,
    least(coalesce(r.realized_amount,0),o.original_amount)::numeric(19,2),
    o.description,null::uuid,o.created_by_member_id
  from public.financial_obligations o
  left join obligation_realization r on r.obligation_id=o.id and r.household_id=o.household_id
  where o.kind='payable'
),
amounts as (
  select r.*,
    public.financial_effective_total_amount(
      source_state,estimated_amount,confirmed_amount,realized_amount,confirmed_amount
    )::numeric(19,2) as effective_amount,
    public.financial_remaining_amount(
      source_state,estimated_amount,confirmed_amount,realized_amount,confirmed_amount
    )::numeric(19,2) as remaining_amount
  from raw_positions r
),
dated as (
  select a.*,date_trunc('month',financial_date)::date as financial_month
  from amounts a
)
select household_id,commitment_key,source_type,source_id,
  source_transaction_id,source_installment_id,source_invoice_id,
  source_obligation_id,source_recurring_occurrence_id,
  commitment_type,direction,economic_type,financial_date,financial_month,
  due_date,economic_date,effective_amount,realized_amount,remaining_amount,
  source_state as economic_state,
  case when source_state in ('cancelled','reversed') then source_state
       when remaining_amount=0 then 'realized'::public.economic_state
       else source_state end as commitment_state,
  coalesce(due_date < current_date, false) and remaining_amount > 0
    and source_state not in ('cancelled','reversed') as is_overdue,
  financial_month < date_trunc('month',current_date)::date
    and remaining_amount > 0
    and source_state not in ('cancelled','reversed') as is_prior_pending,
  description,category_id,created_by_member_id
from dated;

comment on view public.financial_commitment_positions is
  'Canonical outgoing commitments by financial month. Installments, materialized recurring occurrences, direct fallback expenses, and payables are mutually deduplicated; invoices and payments are context/realization only.';

-- Deliberate current-schema boundaries:
-- * direct/recurring realization uses the economic realized_amount and explicit
--   non-invoice funding, because a generic movement cannot safely be attributed
--   to a commitment without one of those links;
-- * installment realization requires the complete settlement evidence chain:
--   an installment-scoped funding_event whose invoice, purchase, account, and
--   funding transaction match a paid card_invoice_payment transaction. The
--   current pay_card_invoice RPC creates this chain atomically and can allocate
--   a partial invoice payment to an installment; the payment remains evidence
--   only and never becomes a row in raw_positions;
-- * rules without a materialized recurring_occurrence are projections, not
--   commitments, and therefore remain for the later cumulative projection layer.
-- Existing household/date indexes on installments, obligations, occurrences,
-- transactions, and funding events cover these joins; no speculative index is
-- added by this read-only migration.

revoke all on public.financial_commitment_positions from public, anon;
grant select on public.financial_commitment_positions to authenticated;
