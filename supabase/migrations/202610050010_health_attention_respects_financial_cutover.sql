-- Align health and attention with the household financial cutover.
-- Pre-cutover commitments are historical context, not current overdue obligations.

create or replace function public.financial_household_health_position(p_household_id uuid)
returns table(
  household_id uuid,
  reference_month date,
  current_cash numeric(19,2),
  expected_reliable_income_remaining numeric(19,2),
  remaining_commitments numeric(19,2),
  prior_pending_outflow numeric(19,2),
  projected_ending_cash numeric(19,2),
  capacity_base numeric(19,2),
  projected_margin_ratio numeric,
  overdraft_used numeric(19,2),
  overdue_commitment_amount numeric(19,2),
  base_health text,
  health text,
  health_reason text
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  p record;
  v_tracking_start date;
  v_tracking_month date;
  v_overdraft_used numeric(19,2);
  v_overdue numeric(19,2);
  v_capacity numeric(19,2);
  v_ratio numeric;
  v_base text;
  v_health text;
  v_reason text;
begin
  if p_household_id is null then
    raise exception 'household is required' using errcode='22004';
  end if;
  if not public.is_active_household_member(p_household_id) then
    raise exception 'active household membership required' using errcode='42501';
  end if;

  select h.financial_tracking_started_on
    into v_tracking_start
    from public.households h
   where h.id=p_household_id
     and h.deleted_at is null;

  v_tracking_month:=case
    when v_tracking_start is null then null
    else date_trunc('month',v_tracking_start)::date
  end;

  select * into p
  from public.financial_monthly_projection(
    p_household_id,
    public.financial_household_current_month(p_household_id),
    1
  )
  limit 1;

  select coalesce(sum(o.overdraft_used),0)::numeric(19,2)
    into v_overdraft_used
  from public.financial_overdraft_positions o
  where o.household_id=p_household_id;

  select coalesce(sum(c.remaining_amount),0)::numeric(19,2)
    into v_overdue
  from public.financial_commitment_positions c
  where c.household_id=p_household_id
    and c.remaining_amount>0
    and c.is_overdue
    and c.commitment_state::text not in ('cancelled','reversed')
    and (v_tracking_month is null or c.financial_month>=v_tracking_month);

  v_capacity:=greatest(
    coalesce(p.opening_cash,0)+coalesce(p.expected_reliable_income_remaining,0),
    0
  )::numeric(19,2);

  v_ratio:=case
    when v_capacity>0 then round(coalesce(p.projected_ending_cash,0)/v_capacity,6)
    else null
  end;

  v_base:=case
    when coalesce(p.projected_ending_cash,0)<0 then 'red'
    when v_capacity=0 then 'green'
    when v_ratio>=.20 then 'green'
    when v_ratio>=.05 then 'yellow'
    else 'red'
  end;

  v_health:=v_base;
  v_reason:='projected_margin';

  if coalesce(p.projected_ending_cash,0)<0 then
    v_health:='red';
    v_reason:='negative_projection';
  elsif v_overdue>greatest(coalesce(p.projected_ending_cash,0),0) and v_overdue>0 then
    v_health:='red';
    v_reason:='overdue_without_projected_capacity';
  elsif v_base='green' and v_overdraft_used>0 then
    v_health:='yellow';
    v_reason:='overdraft_in_use';
  elsif v_base='green' and v_overdue>0 then
    v_health:='yellow';
    v_reason:='overdue_open_commitment';
  end if;

  return query
  select p_household_id,
         public.financial_household_current_month(p_household_id),
         coalesce(p.opening_cash,0)::numeric(19,2),
         coalesce(p.expected_reliable_income_remaining,0)::numeric(19,2),
         (coalesce(p.remaining_commitments_in_month,0)+coalesce(p.projected_recurring_commitments,0))::numeric(19,2),
         coalesce(p.prior_pending_outflow,0)::numeric(19,2),
         coalesce(p.projected_ending_cash,0)::numeric(19,2),
         v_capacity,
         v_ratio,
         v_overdraft_used,
         v_overdue,
         v_base,
         v_health,
         v_reason;
end
$$;

create or replace function public.financial_attention_items(p_household_id uuid)
returns table(
  household_id uuid,
  attention_key text,
  attention_type text,
  severity text,
  amount numeric(19,2),
  due_date date,
  entity_type text,
  entity_id uuid,
  title text
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  v_projected_ending numeric(19,2);
  v_tracking_start date;
  v_tracking_month date;
begin
  if p_household_id is null then
    raise exception 'household is required' using errcode='22004';
  end if;
  if not public.is_active_household_member(p_household_id) then
    raise exception 'active household membership required' using errcode='42501';
  end if;

  select h.financial_tracking_started_on
    into v_tracking_start
    from public.households h
   where h.id=p_household_id
     and h.deleted_at is null;

  v_tracking_month:=case
    when v_tracking_start is null then null
    else date_trunc('month',v_tracking_start)::date
  end;

  select h.projected_ending_cash
    into v_projected_ending
    from public.financial_household_health_position(p_household_id) h;

  return query
  select c.household_id,
         'commitment:'||c.commitment_key,
         'overdue_commitment',
         case when c.remaining_amount>greatest(coalesce(v_projected_ending,0),0) then 'red' else 'yellow' end,
         c.remaining_amount::numeric(19,2),
         c.due_date,
         'commitment',
         c.source_id,
         c.description
    from public.financial_commitment_positions c
   where c.household_id=p_household_id
     and c.remaining_amount>0
     and c.is_overdue
     and c.commitment_state::text not in ('cancelled','reversed')
     and (v_tracking_month is null or c.financial_month>=v_tracking_month)
     and c.source_invoice_id is null
     and c.source_obligation_id is null
  union all
  select i.household_id,'invoice:'||i.invoice_id::text,'overdue_invoice','red',
         i.remaining_amount::numeric(19,2),i.due_date,'invoice',i.invoice_id,'Fatura vencida'
    from public.financial_card_invoice_positions i
   where i.household_id=p_household_id
     and i.is_overdue
     and i.remaining_amount>0
  union all
  select b.household_id,
         'obligation:'||b.obligation_id::text,
         case when b.kind='payable' then 'overdue_payable' else 'overdue_receivable' end,
         case when b.kind='payable' and b.outstanding_amount>greatest(coalesce(v_projected_ending,0),0) then 'red' else 'yellow' end,
         b.outstanding_amount::numeric(19,2),
         b.due_date,
         'obligation',
         b.obligation_id,
         case when b.kind='payable' then 'Valor a pagar vencido' else 'Valor a receber vencido' end
    from public.financial_obligation_balances b
   where b.household_id=p_household_id
     and b.is_overdue
     and b.outstanding_amount>0
  union all
  select i.household_id,'income:'||i.money_movement_id::text,'delayed_expected_income','yellow',
         i.reliable_remaining_amount::numeric(19,2),i.movement_date,'money_movement',i.money_movement_id,'Entrada esperada atrasada'
    from public.financial_true_income_positions i
   where i.household_id=p_household_id
     and i.state='projected'
     and i.reliable_remaining_amount>0
     and i.movement_date<public.financial_household_today(p_household_id)
  union all
  select s.household_id,'settlement:'||s.id::text,'overdue_member_settlement','yellow',
         s.amount::numeric(19,2),s.due_date,'member_settlement_schedule',s.id,'Acerto programado vencido'
    from public.member_settlement_schedules s
   where s.household_id=p_household_id
     and s.state='scheduled'
     and s.due_date<public.financial_household_today(p_household_id)
  union all
  select o.household_id,'overdraft:'||o.account_id::text,'overdraft_in_use',
         case when o.overdraft_over_limit>0 then 'red' else 'yellow' end,
         o.overdraft_used::numeric(19,2),null::date,'account',o.account_id,'LIS em uso'
    from public.financial_overdraft_positions o
   where o.household_id=p_household_id
     and o.overdraft_used>0
  union all
  select c.household_id,'card-limit:'||c.card_id::text,'card_over_limit','red',
         c.over_limit_amount::numeric(19,2),c.next_due_date,'card',c.card_id,'Cartão acima do limite'
    from public.financial_card_health_positions c
   where c.household_id=p_household_id
     and c.over_limit_amount>0
  union all
  select i.household_id,'invoice-coverage:'||i.invoice_id::text,'card_coverage_risk','yellow',
         i.remaining_amount::numeric(19,2),i.due_date,'invoice',i.invoice_id,'Fatura próxima do vencimento sem cobertura projetada'
    from public.financial_card_invoice_positions i
   where i.household_id=p_household_id
     and not i.is_overdue
     and i.remaining_amount>0
     and i.due_date between public.financial_household_today(p_household_id) and public.financial_household_today(p_household_id)+7
     and i.remaining_amount>greatest(coalesce(v_projected_ending,0),0)
  union all
  select p_household_id,
         'projection:'||date_trunc('month',public.financial_household_today(p_household_id))::date::text,
         'negative_projection',
         'red',
         abs(v_projected_ending)::numeric(19,2),
         (date_trunc('month',public.financial_household_today(p_household_id))+interval '1 month'-interval '1 day')::date,
         'household',
         p_household_id,
         'Projeção do mês ficou negativa'
   where coalesce(v_projected_ending,0)<0;
end
$$;

comment on function public.financial_household_health_position(uuid) is
  'Current-month health over the cutover-aware projection. Pre-cutover commitments do not become current overdue debt.';
comment on function public.financial_attention_items(uuid) is
  'Actionable attention center respecting the household financial cutover. Pre-cutover commitments are excluded from current overdue attention.';
