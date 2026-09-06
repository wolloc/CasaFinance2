-- Etapa 10AI: revisão acionável da confiança da projeção.
-- Um item só desaparece quando o fato financeiro subjacente deixa de precisar de confirmação.
-- Esta camada é 100% derivada/read-only: abrir ou revisar um item nunca altera dinheiro.

create or replace function public.financial_projection_review_items(p_household_id uuid)
returns table (
  household_id uuid,
  review_key text,
  review_type text,
  amount numeric(19,2),
  reference_date date,
  entity_type text,
  entity_id uuid,
  title text,
  review_reason text,
  recommended_action text,
  action_label text,
  urgency_score integer
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  with commitment_reviews as (
    select
      c.household_id,
      'commitment-review:'||c.commitment_key as review_key,
      case when c.is_overdue or c.financial_month<date_trunc('month',current_date)::date then 'stale_forecast_commitment' else 'forecast_commitment' end as review_type,
      c.remaining_amount::numeric(19,2) as amount,
      c.due_date as reference_date,
      case when c.source_invoice_id is not null then 'invoice'
           when c.source_recurring_occurrence_id is not null then 'recurring_occurrence'
           else 'commitment' end as entity_type,
      coalesce(c.source_invoice_id,c.source_recurring_occurrence_id,c.source_id) as entity_id,
      c.description as title,
      case when c.is_overdue then 'A data prevista passou e o Casa ainda não recebeu confirmação do que aconteceu.'
           when c.financial_month<date_trunc('month',current_date)::date then 'Essa previsão pertence a um mês anterior e continua sem resolução.'
           else 'Esse valor ainda está previsto. Confirmar ou corrigir melhora a confiança da projeção.' end as review_reason,
      case when c.source_invoice_id is not null then 'invoices' else 'expenses' end as recommended_action,
      case when c.source_invoice_id is not null then 'Revisar fatura' else 'Revisar gasto' end as action_label,
      (case when c.is_overdue then 100 when c.due_date<=current_date+3 then 70 when c.due_date<=current_date+7 then 55 else 30 end
       + case when c.remaining_amount>=1000 then 10 when c.remaining_amount>=500 then 5 else 0 end)::integer as urgency_score
    from public.financial_commitment_positions c
    where c.household_id=p_household_id
      and c.commitment_state::text='forecast'
      and c.remaining_amount>0
      and c.commitment_state::text not in ('cancelled','reversed')
  ), income_reviews as (
    select
      i.household_id,
      'income-review:'||i.money_movement_id::text as review_key,
      case when i.movement_date<current_date then 'delayed_expected_income' else 'projected_income' end as review_type,
      i.reliable_remaining_amount::numeric(19,2) as amount,
      i.movement_date as reference_date,
      'money_movement'::text as entity_type,
      i.money_movement_id as entity_id,
      'Entrada esperada'::text as title,
      case when i.movement_date<current_date then 'A entrada era esperada e ainda não foi recebida nem revisada.'
           else 'Essa entrada ainda não aconteceu. Ela continua na projeção porque foi classificada como confiável.' end as review_reason,
      'income'::text as recommended_action,
      'Revisar entrada'::text as action_label,
      (case when i.movement_date<current_date then 95 when i.movement_date=current_date then 65 else 25 end
       + case when i.reliable_remaining_amount>=1000 then 10 when i.reliable_remaining_amount>=500 then 5 else 0 end)::integer as urgency_score
    from public.financial_true_income_positions i
    where i.household_id=p_household_id
      and i.state='projected'
      and i.reliable_remaining_amount>0
  )
  select * from (
    select * from commitment_reviews
    union all
    select * from income_reviews
  ) reviews
  order by urgency_score desc, reference_date nulls last, amount desc;
$$;

comment on function public.financial_projection_review_items(uuid) is
  'Read-only review queue for unresolved forecast commitments and reliable projected income. Items remain until the underlying fact is confirmed, corrected, settled, received, cancelled, or otherwise resolved canonically; opening the queue never clears them.';

revoke all on function public.financial_projection_review_items(uuid) from public,anon;
grant execute on function public.financial_projection_review_items(uuid) to authenticated;
