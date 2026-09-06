-- Etapa 10AH: priorização acionável da atenção financeira.
-- Read-only: não cria, liquida, corrige ou movimenta nenhum fato financeiro.

create or replace function public.financial_priority_attention_items(p_household_id uuid)
returns table (
  household_id uuid,
  attention_key text,
  attention_type text,
  severity text,
  amount numeric(19,2),
  due_date date,
  entity_type text,
  entity_id uuid,
  title text,
  priority_score integer,
  priority_reason text,
  recommended_action text,
  action_label text
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select a.household_id,a.attention_key,a.attention_type,a.severity,a.amount,a.due_date,a.entity_type,a.entity_id,a.title,
         (case when a.severity='red' then 100 else 50 end
          + case when a.due_date is not null and a.due_date<current_date then 30
                 when a.due_date=current_date then 25
                 when a.due_date<=current_date+3 then 15 else 0 end
          + case a.attention_type
              when 'negative_projection' then 25
              when 'overdraft_in_use' then 20
              when 'overdue_invoice' then 20
              when 'card_coverage_risk' then 15
              when 'overdue_commitment' then 15
              when 'recurring_expense_due' then 10
              else 5 end)::integer as priority_score,
         case
           when a.attention_type='negative_projection' then 'A projeção da Casa não cobre os compromissos conhecidos.'
           when a.attention_type='overdraft_in_use' then 'A Casa já está usando crédito para sustentar o caixa atual.'
           when a.due_date is not null and a.due_date<current_date then 'Esse compromisso já venceu e continua em aberto.'
           when a.due_date=current_date then 'Esse compromisso vence hoje e ainda precisa ser resolvido.'
           when a.due_date<=current_date+3 then 'Esse compromisso vence nos próximos dias.'
           else 'Essa situação exige uma decisão financeira explícita.' end,
         case
           when a.attention_type in ('overdue_commitment','recurring_expense_due') then 'expenses'
           when a.attention_type in ('overdue_invoice','card_coverage_risk','card_over_limit') then 'invoices'
           when a.attention_type='delayed_expected_income' then 'income'
           else null end,
         case
           when a.attention_type in ('overdue_commitment','recurring_expense_due') then 'Resolver em Gastos'
           when a.attention_type in ('overdue_invoice','card_coverage_risk','card_over_limit') then 'Ver faturas'
           when a.attention_type='delayed_expected_income' then 'Revisar entrada'
           else null end
    from public.financial_attention_items(p_household_id) a
   order by priority_score desc, a.due_date nulls last, a.amount desc;
$$;

comment on function public.financial_priority_attention_items(uuid) is
  'Canonical read-only priority layer over actionable attention. Ranking explains urgency and suggests navigation only when the destination is unambiguous; no suggested action creates a financial fact.';

revoke all on function public.financial_priority_attention_items(uuid) from public,anon;
grant execute on function public.financial_priority_attention_items(uuid) to authenticated;
