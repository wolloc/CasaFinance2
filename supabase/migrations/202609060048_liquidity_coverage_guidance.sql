-- Etapa 10AF: saldo livre após compromissos e orientação de cobertura.
-- Não cria fatos financeiros: interpreta a posição canônica para orientar a Casa.

create or replace function public.financial_liquidity_guidance(p_household_id uuid)
returns table (
  household_id uuid,
  current_cash numeric(19,2),
  committed_before_new_income numeric(19,2),
  free_cash_after_commitments numeric(19,2),
  reliable_income_remaining numeric(19,2),
  projected_ending_cash numeric(19,2),
  coverage_gap numeric(19,2),
  reserve_balance numeric(19,2),
  investment_balance numeric(19,2),
  overdraft_used numeric(19,2),
  guidance_state text,
  guidance_title text
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  with health as (
    select * from public.financial_household_health_position(p_household_id)
  ), resources as (
    select
      coalesce(sum(case when b.resource_restriction='reserve' and not b.is_investment then greatest(b.current_balance,0) else 0 end),0)::numeric(19,2) reserve_balance,
      coalesce(sum(case when b.is_investment then greatest(b.current_balance,0) else 0 end),0)::numeric(19,2) investment_balance
    from public.financial_account_balances b
    where b.household_id=p_household_id
  )
  select p_household_id,
         h.current_cash,
         (coalesce(h.remaining_commitments,0)+coalesce(h.prior_pending_outflow,0))::numeric(19,2),
         (h.current_cash-coalesce(h.remaining_commitments,0)-coalesce(h.prior_pending_outflow,0))::numeric(19,2),
         h.expected_reliable_income_remaining,
         h.projected_ending_cash,
         greatest(-h.projected_ending_cash,0)::numeric(19,2),
         r.reserve_balance,r.investment_balance,h.overdraft_used,
         case when h.projected_ending_cash>=0 and h.current_cash-coalesce(h.remaining_commitments,0)-coalesce(h.prior_pending_outflow,0)>=0 then 'covered'
              when h.projected_ending_cash>=0 then 'covered_by_expected_income'
              when r.reserve_balance+r.investment_balance>=greatest(-h.projected_ending_cash,0) then 'needs_resource_reallocation'
              else 'needs_funding_plan' end,
         case when h.projected_ending_cash>=0 and h.current_cash-coalesce(h.remaining_commitments,0)-coalesce(h.prior_pending_outflow,0)>=0 then 'Compromissos cobertos pelo caixa atual'
              when h.projected_ending_cash>=0 then 'Parte do mês depende de entradas ainda esperadas'
              when r.reserve_balance+r.investment_balance>=greatest(-h.projected_ending_cash,0) then 'O caixa projetado não cobre os compromissos'
              else 'Falta recurso projetado para fechar os compromissos' end
  from health h cross join resources r;
$$;

comment on function public.financial_liquidity_guidance(uuid) is
  'Read-only guidance. Free cash discounts existing commitments before future income. Reserves/investments never improve cash automatically; they only indicate an explicit reallocation option. Credit/LIS never becomes positive cash.';

revoke all on function public.financial_liquidity_guidance(uuid) from public,anon;
grant execute on function public.financial_liquidity_guidance(uuid) to authenticated;
