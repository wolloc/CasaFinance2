-- Etapa 10X: gestao auditavel de series recorrentes de renda.
-- Mudancas futuras nunca reescrevem ocorrencias passadas/materializadas.

create table if not exists public.recurring_income_series_events (
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

create index if not exists recurring_income_series_events_rule_created
  on public.recurring_income_series_events(source_rule_id,created_at desc);

alter table public.recurring_income_series_events enable row level security;

drop policy if exists recurring_income_series_events_select on public.recurring_income_series_events;
create policy recurring_income_series_events_select on public.recurring_income_series_events
for select using (public.is_active_household_member(household_id));

revoke insert,update,delete on public.recurring_income_series_events from public,anon,authenticated;
grant select on public.recurring_income_series_events to authenticated;

create or replace function public.cancel_future_recurring_income_occurrences(
  p_household_id uuid,
  p_rule_id uuid,
  p_effective_from date
) returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  affected integer;
begin
  caller:=public.require_active_member(p_household_id);
  if p_effective_from is null then raise exception 'effective date is required' using errcode='22023'; end if;

  if exists(
    select 1
    from public.recurring_occurrences o
    join public.transactions t on t.id=o.transaction_id and t.household_id=o.household_id
    where o.household_id=p_household_id
      and o.recurring_rule_id=p_rule_id
      and o.competence_date>=p_effective_from
      and (t.realized_amount>0 or t.economic_state='realized' or t.status='received')
  ) then
    raise exception 'future series change cannot cross an already realized occurrence' using errcode='0A000';
  end if;

  update public.transactions t
  set economic_state='cancelled',status='cancelled',settled_at=null,updated_at=now()
  from public.recurring_occurrences o
  where o.transaction_id=t.id
    and o.household_id=p_household_id
    and o.recurring_rule_id=p_rule_id
    and o.competence_date>=p_effective_from
    and o.status<>'cancelled'
    and t.realized_amount=0
    and t.economic_state not in ('cancelled','reversed');

  update public.recurring_occurrences
  set status='cancelled'
  where household_id=p_household_id
    and recurring_rule_id=p_rule_id
    and competence_date>=p_effective_from
    and status<>'cancelled';
  get diagnostics affected=row_count;
  return affected;
end
$$;

revoke all on function public.cancel_future_recurring_income_occurrences(uuid,uuid,date) from public,anon,authenticated;

create or replace function public.close_recurring_income_rule(
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
  select * into r from public.recurring_rules
  where id=p_rule_id and household_id=p_household_id and deactivated_at is null and income_nature is not null
  for update;
  if r.id is null then raise exception 'active recurring income rule required' using errcode='23514'; end if;
  if p_effective_from is null or p_effective_from<current_date then raise exception 'closure must be effective today or in the future' using errcode='22023'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'reason is required' using errcode='22023'; end if;

  before_data:=jsonb_build_object(
    'description',r.income_description,'amount',r.estimated_amount,'frequency',r.frequency,
    'start_date',r.start_date,'end_date',r.end_date,'beneficiary_member_id',r.income_beneficiary_member_id,
    'destination_account_id',r.income_destination_account_id,'income_nature',r.income_nature,
    'economic_state',r.income_economic_state
  );

  perform public.cancel_future_recurring_income_occurrences(p_household_id,r.id,p_effective_from);

  update public.recurring_rules
  set end_date=least(coalesce(end_date,p_effective_from-1),p_effective_from-1),
      next_occurrence_date=null,deactivated_at=now(),updated_at=now()
  where id=r.id;

  insert into public.recurring_income_series_events(
    household_id,source_rule_id,created_by_member_id,kind,effective_from,reason,before_snapshot,after_snapshot
  ) values(
    p_household_id,r.id,caller.id,'closure',p_effective_from,trim(p_reason),before_data,null
  ) returning id into event_id;
  return event_id;
end
$$;

create or replace function public.revise_recurring_income_rule(
  p_household_id uuid,
  p_rule_id uuid,
  p_effective_from date,
  p_description text,
  p_amount numeric,
  p_frequency text,
  p_category_id uuid,
  p_beneficiary_member_id uuid,
  p_planned_destination_account_id uuid,
  p_income_nature public.income_nature,
  p_economic_state public.economic_state,
  p_end_date date,
  p_notes text,
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
  event_id uuid;
  before_data jsonb;
  after_data jsonb;
begin
  caller:=public.require_active_member(p_household_id);
  select * into r from public.recurring_rules
  where id=p_rule_id and household_id=p_household_id and deactivated_at is null and income_nature is not null
  for update;
  if r.id is null then raise exception 'active recurring income rule required' using errcode='23514'; end if;
  if p_effective_from is null or p_effective_from<current_date then raise exception 'revision must be effective today or in the future' using errcode='22023'; end if;
  if length(trim(coalesce(p_reason,'')))=0 then raise exception 'reason is required' using errcode='22023'; end if;

  before_data:=jsonb_build_object(
    'description',r.income_description,'amount',r.estimated_amount,'frequency',r.frequency,
    'start_date',r.start_date,'end_date',r.end_date,'beneficiary_member_id',r.income_beneficiary_member_id,
    'destination_account_id',r.income_destination_account_id,'income_nature',r.income_nature,
    'economic_state',r.income_economic_state
  );

  perform public.cancel_future_recurring_income_occurrences(p_household_id,r.id,p_effective_from);

  update public.recurring_rules
  set end_date=least(coalesce(end_date,p_effective_from-1),p_effective_from-1),
      next_occurrence_date=null,deactivated_at=now(),updated_at=now()
  where id=r.id;

  successor:=public.create_recurring_income_rule(
    p_household_id,p_description,p_amount,p_effective_from,p_end_date,p_frequency,p_category_id,
    p_beneficiary_member_id,p_planned_destination_account_id,p_income_nature,p_economic_state,p_notes
  );

  after_data:=jsonb_build_object(
    'description',trim(p_description),'amount',p_amount,'frequency',p_frequency,
    'start_date',p_effective_from,'end_date',p_end_date,'beneficiary_member_id',p_beneficiary_member_id,
    'destination_account_id',p_planned_destination_account_id,'income_nature',p_income_nature,
    'economic_state',p_economic_state
  );

  insert into public.recurring_income_series_events(
    household_id,source_rule_id,successor_rule_id,created_by_member_id,kind,effective_from,reason,before_snapshot,after_snapshot
  ) values(
    p_household_id,r.id,successor,caller.id,'revision',p_effective_from,trim(p_reason),before_data,after_data
  ) returning id into event_id;
  return successor;
end
$$;

revoke all on function public.close_recurring_income_rule(uuid,uuid,date,text) from public,anon;
revoke all on function public.revise_recurring_income_rule(uuid,uuid,date,text,numeric,text,uuid,uuid,uuid,public.income_nature,public.economic_state,date,text,text) from public,anon;
grant execute on function public.close_recurring_income_rule(uuid,uuid,date,text) to authenticated;
grant execute on function public.revise_recurring_income_rule(uuid,uuid,date,text,numeric,text,uuid,uuid,uuid,public.income_nature,public.economic_state,date,text,text) to authenticated;

comment on function public.revise_recurring_income_rule(uuid,uuid,date,text,numeric,text,uuid,uuid,uuid,public.income_nature,public.economic_state,date,text,text) is
  'Revises a recurring income series prospectively by closing the old rule, cancelling only unrealized future occurrences, and creating a successor rule. Past occurrences remain untouched.';
comment on function public.close_recurring_income_rule(uuid,uuid,date,text) is
  'Closes a recurring income series prospectively and preserves prior occurrences. Realized occurrences are never rewritten.';
