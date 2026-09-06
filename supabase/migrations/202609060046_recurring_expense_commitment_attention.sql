-- Etapa 10AE: compromissos recorrentes previstos, confirmação e atenção acionável.
-- Previsto compromete a projeção, mas somente pagamento confirmado movimenta Caixa.

create or replace function public.confirm_recurring_expense_occurrence(
  p_household_id uuid,
  p_occurrence_id uuid,
  p_confirmed_amount numeric
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  occurrence public.recurring_occurrences;
  tx public.transactions;
begin
  caller:=public.require_active_member(p_household_id);
  select * into occurrence from public.recurring_occurrences
   where id=p_occurrence_id and household_id=p_household_id for update;
  if occurrence.id is null or occurrence.status='cancelled' then
    raise exception 'active recurring expense occurrence required' using errcode='23514';
  end if;
  select * into tx from public.transactions
   where id=occurrence.transaction_id and household_id=p_household_id and type='expense' and deleted_at is null
   for update;
  if tx.id is null or tx.economic_state not in ('forecast','confirmed') or tx.realized_amount<>0 then
    raise exception 'only an unrealized recurring expense can be confirmed' using errcode='0A000';
  end if;
  if tx.invoice_id is not null
     or exists(select 1 from public.funding_events f where f.household_id=p_household_id and f.financed_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations o where o.household_id=p_household_id and o.source_transaction_id=tx.id)
     or exists(select 1 from public.external_payment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id)
     or exists(select 1 from public.installment_plans i where i.household_id=p_household_id and i.purchase_transaction_id=tx.id)
  then raise exception 'dependent financial facts require a dedicated correction flow' using errcode='0A000'; end if;
  perform public.confirm_financial_transaction(p_household_id,tx.id,p_confirmed_amount);
  update public.recurring_occurrences
     set status='pending',confirmed_amount=p_confirmed_amount,confirmed_at=now()
   where id=occurrence.id;
  return tx.id;
end
$$;

create or replace function public.settle_recurring_expense_occurrence(
  p_household_id uuid,
  p_occurrence_id uuid,
  p_source_account_id uuid,
  p_funder_member_id uuid,
  p_amount numeric,
  p_paid_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  occurrence public.recurring_occurrences;
  tx public.transactions;
  movement uuid;
begin
  perform public.require_active_member(p_household_id);
  select * into occurrence from public.recurring_occurrences
   where id=p_occurrence_id and household_id=p_household_id for update;
  if occurrence.id is null or occurrence.status='cancelled' then raise exception 'active recurring expense occurrence required' using errcode='23514'; end if;
  select * into tx from public.transactions where id=occurrence.transaction_id and household_id=p_household_id and type='expense' and deleted_at is null for update;
  if tx.id is null or tx.invoice_id is not null then raise exception 'direct recurring expense required' using errcode='23514'; end if;
  movement:=public.settle_direct_expense(p_household_id,tx.id,p_source_account_id,p_funder_member_id,p_amount,p_paid_at);
  update public.recurring_occurrences o
     set status=case when t.status='paid' then 'paid'::public.occurrence_state else 'pending'::public.occurrence_state end,
         settled_at=case when t.status='paid' then p_paid_at else null end
    from public.transactions t where o.id=occurrence.id and t.id=tx.id;
  return movement;
end
$$;

create or replace view public.financial_recurring_expense_attention_positions
with (security_invoker=true) as
select c.household_id,
       c.source_recurring_occurrence_id as occurrence_id,
       c.source_transaction_id as transaction_id,
       o.recurring_rule_id,
       c.description,
       c.effective_amount::numeric(19,2) as expected_amount,
       c.remaining_amount::numeric(19,2) as remaining_amount,
       c.due_date,
       c.economic_state,
       c.commitment_state,
       pi.account_id as planned_account_id,
       a.name as planned_account_name,
       case when c.is_overdue then 'overdue'
            when c.due_date=current_date then 'due_today'
            when c.due_date between current_date+1 and current_date+3 then 'due_soon'
            else 'upcoming' end as attention_state
from public.financial_commitment_positions c
join public.recurring_occurrences o on o.id=c.source_recurring_occurrence_id and o.household_id=c.household_id
left join public.transaction_payment_instruments pi on pi.transaction_id=c.source_transaction_id and pi.household_id=c.household_id and pi.kind='account'
left join public.accounts a on a.id=pi.account_id and a.household_id=c.household_id
where c.source_type='recurring_occurrence'
  and c.remaining_amount>0
  and c.commitment_state not in ('cancelled','reversed')
  and c.due_date<=current_date+7;

comment on view public.financial_recurring_expense_attention_positions is
  'Actionable recurring expense occurrences due within seven days or overdue. Expected amount reduces projection immediately; planned account is context only until explicit settlement realizes Funding + Caixa.';

revoke all on public.financial_recurring_expense_attention_positions from public,anon;
grant select on public.financial_recurring_expense_attention_positions to authenticated;
revoke all on function public.confirm_recurring_expense_occurrence(uuid,uuid,numeric), public.settle_recurring_expense_occurrence(uuid,uuid,uuid,uuid,numeric,timestamptz) from public,anon;
grant execute on function public.confirm_recurring_expense_occurrence(uuid,uuid,numeric), public.settle_recurring_expense_occurrence(uuid,uuid,uuid,uuid,numeric,timestamptz) to authenticated;

-- Previsto != realizado: nenhuma confirmação acima cria money_movement/funding_event.
-- O pagamento pode usar conta diferente da prevista; a rota planejada nunca é reescrita como fato de caixa.
