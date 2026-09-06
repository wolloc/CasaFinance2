-- Etapa 10Z: gestao auditavel de series recorrentes de gastos.
-- Mudancas futuras preservam ocorrencias passadas e bloqueiam efeitos financeiros ja concretizados.

create table if not exists public.recurring_expense_series_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_rule_id uuid not null references public.recurring_rules(id) on delete restrict,
  successor_rule_id uuid references public.recurring_rules(id) on delete restrict,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  kind text not null check (kind in ('revision','closure')),
  effective_from date not null,
  reason text not null check (length(trim(reason)) > 0),
  before_snapshot jsonb not null,
  after_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recurring_expense_series_events_rule_created
  on public.recurring_expense_series_events(source_rule_id,created_at desc);

alter table public.recurring_expense_series_events enable row level security;
drop policy if exists recurring_expense_series_events_select on public.recurring_expense_series_events;
create policy recurring_expense_series_events_select on public.recurring_expense_series_events
for select using (public.is_active_household_member(household_id));
revoke insert,update,delete on public.recurring_expense_series_events from public,anon,authenticated;
grant select on public.recurring_expense_series_events to authenticated;

create or replace function public.assert_recurring_expense_change_safe(
  p_household_id uuid,
  p_rule_id uuid,
  p_effective_from date
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  perform public.require_active_member(p_household_id);
  if p_effective_from is null then raise exception 'effective date is required' using errcode='22023'; end if;

  if exists(
    select 1
    from public.recurring_occurrences o
    join public.transactions t on t.id=o.transaction_id and t.household_id=o.household_id
    where o.household_id=p_household_id and o.recurring_rule_id=p_rule_id and o.competence_date>=p_effective_from
      and (
        t.realized_amount>0 or t.economic_state='realized' or t.status='paid' or t.invoice_id is not null
        or exists(select 1 from public.funding_events f where f.household_id=p_household_id and f.financed_transaction_id=t.id)
        or exists(select 1 from public.financial_obligations fo where fo.household_id=p_household_id and fo.source_transaction_id=t.id)
        or exists(select 1 from public.external_payment_events ep where ep.household_id=p_household_id and ep.source_transaction_id=t.id)
        or exists(select 1 from public.installment_plans ip where ip.household_id=p_household_id and ip.purchase_transaction_id=t.id)
        or exists(select 1 from public.member_settlement_events mse where mse.household_id=p_household_id and mse.source_transaction_id=t.id and mse.state='realized')
      )
  ) then
    raise exception 'future recurring expense change crosses an occurrence with realized or dependent financial effects' using errcode='0A000';
  end if;
end
$$;
revoke all on function public.assert_recurring_expense_change_safe(uuid,uuid,date) from public,anon,authenticated;

create or replace function public.cancel_future_recurring_expense_occurrences(
  p_household_id uuid,
  p_rule_id uuid,
  p_effective_from date
) returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare affected integer;
begin
  perform public.require_active_member(p_household_id);
  perform public.assert_recurring_expense_change_safe(p_household_id,p_rule_id,p_effective_from);

  update public.transactions t
  set economic_state='cancelled',status='cancelled',settled_at=null,updated_at=now()
  from public.recurring_occurrences o
  where o.transaction_id=t.id and o.household_id=p_household_id and o.recurring_rule_id=p_rule_id
    and o.competence_date>=p_effective_from and o.status<>'cancelled'
    and t.realized_amount=0 and t.economic_state not in ('cancelled','reversed');

  update public.recurring_occurrences
  set status='cancelled'
  where household_id=p_household_id and recurring_rule_id=p_rule_id
    and competence_date>=p_effective_from and status<>'cancelled';
  get diagnostics affected=row_count;
  return affected;
end
$$;
revoke all on function public.cancel_future_recurring_expense_occurrences(uuid,uuid,date) from public,anon,authenticated;

create or replace function public.close_recurring_expense_rule(
  p_household_id uuid,
  p_rule_id uuid,
  p_effective_from date,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  r public.recurring_rules;
  event_id uuid;
  before_data jsonb;
begin
  caller:=public.require_active_member(p_household_id);
  select rr.* into r from public.recurring_rules rr
  join public.transactions t on t.id=rr.template_transaction_id and t.household_id=rr.household_id
  where rr.id=p_rule_id and rr.household_id=p_household_id and rr.deactivated_at is null and rr.income_nature is null and t.type='expense'
  for update of rr;
  if r.id is null then raise exception 'active recurring expense rule required' using errcode='23514'; end if;
  if p_effective_from is null or p_effective_from<current_date then raise exception 'closure must be effective today or in the future' using errcode='22023'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'reason is required' using errcode='22023'; end if;

  before_data:=jsonb_build_object('template_transaction_id',r.template_transaction_id,'amount',r.estimated_amount,'frequency',r.frequency,'interval_count',r.interval_count,'start_date',r.start_date,'end_date',r.end_date);
  perform public.cancel_future_recurring_expense_occurrences(p_household_id,r.id,p_effective_from);

  update public.recurring_rules
  set end_date=least(coalesce(end_date,p_effective_from-1),p_effective_from-1),next_occurrence_date=null,deactivated_at=now(),updated_at=now()
  where id=r.id;

  insert into public.recurring_expense_series_events(household_id,source_rule_id,created_by_member_id,kind,effective_from,reason,before_snapshot)
  values(p_household_id,r.id,caller.id,'closure',p_effective_from,trim(p_reason),before_data)
  returning id into event_id;
  return event_id;
end
$$;

create or replace function public.revise_recurring_expense_rule(
  p_household_id uuid,
  p_rule_id uuid,
  p_effective_from date,
  p_amount numeric,
  p_frequency text,
  p_interval_count integer,
  p_end_date date,
  p_reason text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  r public.recurring_rules;
  successor uuid;
  before_data jsonb;
  after_data jsonb;
  horizon date;
begin
  caller:=public.require_active_member(p_household_id);
  select rr.* into r from public.recurring_rules rr
  join public.transactions t on t.id=rr.template_transaction_id and t.household_id=rr.household_id
  where rr.id=p_rule_id and rr.household_id=p_household_id and rr.deactivated_at is null and rr.income_nature is null and t.type='expense'
  for update of rr;
  if r.id is null then raise exception 'active recurring expense rule required' using errcode='23514'; end if;
  if p_effective_from is null or p_effective_from<current_date then raise exception 'revision must be effective today or in the future' using errcode='22023'; end if;
  if p_amount<=0 then raise exception 'positive amount is required' using errcode='22023'; end if;
  if p_frequency not in ('weekly','monthly','yearly') or p_interval_count<1 then raise exception 'invalid recurring expense frequency' using errcode='22023'; end if;
  if p_end_date is not null and p_end_date<p_effective_from then raise exception 'end date must not precede effective date' using errcode='22023'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'reason is required' using errcode='22023'; end if;

  before_data:=jsonb_build_object('template_transaction_id',r.template_transaction_id,'amount',r.estimated_amount,'frequency',r.frequency,'interval_count',r.interval_count,'start_date',r.start_date,'end_date',r.end_date);
  perform public.cancel_future_recurring_expense_occurrences(p_household_id,r.id,p_effective_from);

  update public.recurring_rules
  set end_date=least(coalesce(end_date,p_effective_from-1),p_effective_from-1),next_occurrence_date=null,deactivated_at=now(),updated_at=now()
  where id=r.id;

  insert into public.recurring_rules(
    household_id,created_by_member_id,template_transaction_id,frequency,interval_count,start_date,end_date,next_occurrence_date,amount_mode,estimated_amount
  ) values(
    p_household_id,caller.id,r.template_transaction_id,p_frequency,p_interval_count,p_effective_from,p_end_date,p_effective_from,r.amount_mode,p_amount
  ) returning id into successor;

  after_data:=jsonb_build_object('template_transaction_id',r.template_transaction_id,'amount',p_amount,'frequency',p_frequency,'interval_count',p_interval_count,'start_date',p_effective_from,'end_date',p_end_date);
  insert into public.recurring_expense_series_events(household_id,source_rule_id,successor_rule_id,created_by_member_id,kind,effective_from,reason,before_snapshot,after_snapshot)
  values(p_household_id,r.id,successor,caller.id,'revision',p_effective_from,trim(p_reason),before_data,after_data);

  horizon:=least(coalesce(p_end_date,(current_date+interval '12 months')::date),(current_date+interval '12 months')::date);
  perform public.ensure_household_recurring_expense_horizon(p_household_id,horizon);
  return successor;
end
$$;

revoke all on function public.close_recurring_expense_rule(uuid,uuid,date,text) from public,anon;
revoke all on function public.revise_recurring_expense_rule(uuid,uuid,date,numeric,text,integer,date,text) from public,anon;
grant execute on function public.close_recurring_expense_rule(uuid,uuid,date,text) to authenticated;
grant execute on function public.revise_recurring_expense_rule(uuid,uuid,date,numeric,text,integer,date,text) to authenticated;

comment on function public.revise_recurring_expense_rule(uuid,uuid,date,numeric,text,integer,date,text) is
  'Revises only the future of a recurring expense series. Past facts remain untouched; buyer, instrument and economic responsibility continue from the canonical template, and existing realized/dependent financial effects block the change.';
comment on function public.close_recurring_expense_rule(uuid,uuid,date,text) is
  'Closes a recurring expense series prospectively without deleting historical occurrences or dependent financial facts.';
