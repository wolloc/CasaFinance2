-- Etapa 10AE: integra contas recorrentes próximas do vencimento ao centro canônico Precisa de atenção.
-- O item é acionável, mas continua sendo previsão/compromisso até existir liquidação explícita.

create or replace function public.financial_attention_items(p_household_id uuid)
returns table (
  household_id uuid,attention_key text,attention_type text,severity text,amount numeric(19,2),due_date date,entity_type text,entity_id uuid,title text
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  with base as (
    select c.household_id,'commitment:'||c.commitment_key,'overdue_commitment',
           case when c.remaining_amount>greatest(coalesce(h.current_cash,0)+coalesce(h.expected_reliable_income_remaining,0),0) then 'red' else 'yellow' end,
           c.remaining_amount::numeric(19,2),c.due_date,'commitment',c.source_id,c.description
      from public.financial_commitment_positions c
      left join lateral public.financial_household_health_position(p_household_id) h on true
     where c.household_id=p_household_id and c.remaining_amount>0 and c.is_overdue
       and c.commitment_state::text not in ('cancelled','reversed') and c.source_invoice_id is null and c.source_obligation_id is null
    union all
    select i.household_id,'invoice:'||i.invoice_id::text,'overdue_invoice','red',i.remaining_amount::numeric(19,2),i.due_date,'invoice',i.invoice_id,'Fatura vencida'
      from public.financial_card_invoice_positions i where i.household_id=p_household_id and i.is_overdue and i.remaining_amount>0
    union all
    select b.household_id,'obligation:'||b.obligation_id::text,case when b.kind='payable' then 'overdue_payable' else 'overdue_receivable' end,'yellow',b.outstanding_amount::numeric(19,2),b.due_date,'obligation',b.obligation_id,case when b.kind='payable' then 'Valor a pagar vencido' else 'Valor a receber vencido' end
      from public.financial_obligation_balances b where b.household_id=p_household_id and b.is_overdue and b.outstanding_amount>0
    union all
    select i.household_id,'income:'||i.money_movement_id::text,'delayed_expected_income','yellow',i.reliable_remaining_amount::numeric(19,2),i.movement_date,'money_movement',i.money_movement_id,'Entrada esperada atrasada'
      from public.financial_true_income_positions i where i.household_id=p_household_id and i.state='projected' and i.reliable_remaining_amount>0 and i.movement_date<current_date
    union all
    select s.household_id,'settlement:'||s.id::text,'overdue_member_settlement','yellow',s.amount::numeric(19,2),s.due_date,'member_settlement_schedule',s.id,'Acerto programado vencido'
      from public.member_settlement_schedules s where s.household_id=p_household_id and s.state='scheduled' and s.due_date<current_date
    union all
    select o.household_id,'overdraft:'||o.account_id::text,'overdraft_in_use',case when o.overdraft_over_limit>0 then 'red' else 'yellow' end,o.overdraft_used::numeric(19,2),null::date,'account',o.account_id,'LIS em uso'
      from public.financial_overdraft_positions o where o.household_id=p_household_id and o.overdraft_used>0
    union all
    select c.household_id,'card-limit:'||c.card_id::text,'card_over_limit','red',c.over_limit_amount::numeric(19,2),c.next_due_date,'card',c.card_id,'Cartão acima do limite'
      from public.financial_card_health_positions c where c.household_id=p_household_id and c.over_limit_amount>0
    union all
    select i.household_id,'invoice-coverage:'||i.invoice_id::text,'card_coverage_risk','yellow',i.remaining_amount::numeric(19,2),i.due_date,'invoice',i.invoice_id,'Fatura próxima do vencimento sem cobertura projetada'
      from public.financial_card_invoice_positions i
      cross join lateral public.financial_household_health_position(p_household_id) h
     where i.household_id=p_household_id and i.state<>'cancelled' and not i.is_overdue and i.remaining_amount>0
       and i.due_date between current_date and current_date+7 and i.remaining_amount>greatest(coalesce(h.projected_ending_cash,0)+i.remaining_amount,0)
    union all
    select p_household_id,'projection:'||date_trunc('month',current_date)::date::text,'negative_projection','red',abs(h.projected_ending_cash)::numeric(19,2),(date_trunc('month',current_date)+interval '1 month-1 day')::date,'household',p_household_id,'Projeção do mês ficou negativa'
      from public.financial_household_health_position(p_household_id) h where coalesce(h.projected_ending_cash,0)<0
  ), recurring_due as (
    select r.household_id,'recurring-due:'||r.occurrence_id::text,'recurring_expense_due',
           case when r.attention_state='overdue' then 'yellow' else 'yellow' end,
           r.remaining_amount::numeric(19,2),r.due_date,'recurring_occurrence',r.occurrence_id,
           case when r.attention_state='overdue' then r.description||' · vencida'
                when r.attention_state='due_today' then r.description||' · vence hoje'
                else r.description||' · vence em breve' end
      from public.financial_recurring_expense_attention_positions r
     where r.household_id=p_household_id and r.attention_state in ('overdue','due_today','due_soon')
       and not (r.attention_state='overdue')
  )
  select * from base
  union all
  select * from recurring_due;
$$;

comment on function public.financial_attention_items(uuid) is
  'Actionable attention center including recurring expenses due within three days. Recurring forecast remains a commitment/projection and never becomes realized cash by time alone.';

revoke all on function public.financial_attention_items(uuid) from public,anon;
grant execute on function public.financial_attention_items(uuid) to authenticated;
