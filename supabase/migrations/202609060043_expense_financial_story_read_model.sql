-- Etapa 10AB: leitura canônica da história financeira de cada gasto.
-- A UI apresenta responsabilidade, funding, caixa e acertos sem reconstruir regras financeiras no frontend.

create or replace view public.financial_expense_story_positions
with (security_invoker=true) as
with responsibility as (
  select
    a.household_id,
    a.transaction_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'member_id', a.responsible_member_id,
          'party_id', a.responsible_party_id,
          'amount', a.amount,
          'percentage', a.percentage
        ) order by a.allocation_order
      ),
      '[]'::jsonb
    ) responsibility_breakdown
  from public.economic_allocations a
  group by a.household_id,a.transaction_id
), member_funding as (
  select
    f.household_id,
    f.financed_transaction_id transaction_id,
    coalesce(sum(f.amount),0)::numeric(19,2) member_funded_amount,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'funder_member_id', f.funder_member_id,
          'source_account_id', f.source_account_id,
          'amount', f.amount,
          'funded_at', f.funded_at,
          'invoice_id', f.invoice_id,
          'installment_id', f.installment_id
        ) order by f.funded_at,f.id
      ),
      '[]'::jsonb
    ) funding_breakdown
  from public.funding_events f
  group by f.household_id,f.financed_transaction_id
), external_funding as (
  select
    e.household_id,
    e.source_transaction_id transaction_id,
    coalesce(sum(e.amount),0)::numeric(19,2) external_paid_amount,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'payer_party_id', e.payer_party_id,
          'intent', e.intent,
          'amount', e.amount,
          'occurred_at', e.occurred_at,
          'payable_obligation_id', e.payable_obligation_id
        ) order by e.occurred_at,e.id
      ),
      '[]'::jsonb
    ) external_payment_breakdown
  from public.external_payment_events e
  group by e.household_id,e.source_transaction_id
), settlements as (
  select
    s.household_id,
    s.source_transaction_id transaction_id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'debtor_member_id', s.debtor_member_id,
          'creditor_member_id', s.creditor_member_id,
          'amount', s.amount,
          'state', s.state,
          'kind', s.kind,
          'financial_date', s.financial_date,
          'occurred_at', s.occurred_at
        ) order by s.financial_date,s.created_at,s.id
      ) filter (where s.state in ('projected','realized')),
      '[]'::jsonb
    ) settlement_breakdown
  from public.member_settlement_events s
  where s.source_transaction_id is not null
  group by s.household_id,s.source_transaction_id
)
select
  t.household_id,
  t.id transaction_id,
  t.amount::numeric(19,2) economic_amount,
  public.financial_effective_total_amount(
    t.economic_state,t.estimated_amount,t.confirmed_amount,t.realized_amount,t.amount
  )::numeric(19,2) effective_amount,
  coalesce(r.responsibility_breakdown,'[]'::jsonb) responsibility_breakdown,
  coalesce(m.member_funded_amount,0)::numeric(19,2) member_funded_amount,
  coalesce(x.external_paid_amount,0)::numeric(19,2) external_paid_amount,
  greatest(
    public.financial_effective_total_amount(
      t.economic_state,t.estimated_amount,t.confirmed_amount,t.realized_amount,t.amount
    ) - coalesce(m.member_funded_amount,0) - coalesce(x.external_paid_amount,0),
    0
  )::numeric(19,2) remaining_to_fund,
  coalesce(m.funding_breakdown,'[]'::jsonb) funding_breakdown,
  coalesce(x.external_payment_breakdown,'[]'::jsonb) external_payment_breakdown,
  coalesce(s.settlement_breakdown,'[]'::jsonb) settlement_breakdown
from public.transactions t
left join responsibility r on r.household_id=t.household_id and r.transaction_id=t.id
left join member_funding m on m.household_id=t.household_id and m.transaction_id=t.id
left join external_funding x on x.household_id=t.household_id and x.transaction_id=t.id
left join settlements s on s.household_id=t.household_id and s.transaction_id=t.id
where t.type='expense' and t.deleted_at is null;

grant select on public.financial_expense_story_positions to authenticated;

comment on view public.financial_expense_story_positions is
  'Canonical per-expense read model for financial story UI. Responsibility comes from economic allocations, member funding from funding events, external payment from external payment events, and settlements from the canonical member settlement ledger. It never infers funder from buyer, instrument holder or account owner.';
