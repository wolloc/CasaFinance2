-- Etapa 10AU: correção/cancelamento auditável de obrigações manuais.
-- Só permite reescrever a verdade atual enquanto nenhum efeito financeiro posterior ocorreu.
-- Se já houve pagamento, recebimento, perda ou perdão, a obrigação deixa de ser uma simples correção administrativa.

create table if not exists public.manual_obligation_adjustment_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  obligation_id uuid not null references public.financial_obligations(id) on delete restrict,
  action text not null check (action in ('correction','cancellation')),
  before_payload jsonb not null,
  after_payload jsonb not null,
  reason text not null check (length(trim(reason)) > 0),
  request_key text not null check (length(trim(request_key)) > 0),
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (household_id, request_key)
);

comment on table public.manual_obligation_adjustment_events is
  'Immutable before/after history for administrative corrections and cancellations of untouched manual obligations.';

alter table public.manual_obligation_adjustment_events enable row level security;
drop policy if exists manual_obligation_adjustment_events_select_active_member on public.manual_obligation_adjustment_events;
create policy manual_obligation_adjustment_events_select_active_member
  on public.manual_obligation_adjustment_events for select to authenticated
  using (public.is_active_household_member(household_id));
revoke all on public.manual_obligation_adjustment_events from public,anon;
grant select on public.manual_obligation_adjustment_events to authenticated;

create or replace function public.correct_manual_third_party_obligation(
  p_household_id uuid,
  p_obligation_id uuid,
  p_counterparty_id uuid,
  p_amount numeric,
  p_obligation_date date,
  p_due_date date,
  p_description text,
  p_reason text,
  p_request_key text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  obligation public.financial_obligations;
  existing public.manual_obligation_adjustment_events;
  before_payload jsonb;
  after_payload jsonb;
begin
  caller:=public.require_active_member(p_household_id);

  if p_amount is null or p_amount<=0
     or p_obligation_date is null
     or (p_due_date is not null and p_due_date<p_obligation_date)
     or length(trim(coalesce(p_description,'')))=0
     or length(trim(coalesce(p_reason,'')))=0
     or length(trim(coalesce(p_request_key,'')))=0
  then
    raise exception 'invalid manual obligation correction' using errcode='22023';
  end if;

  select * into existing
  from public.manual_obligation_adjustment_events
  where household_id=p_household_id and request_key=trim(p_request_key);
  if existing.id is not null then return existing.id; end if;

  select * into obligation
  from public.financial_obligations
  where id=p_obligation_id and household_id=p_household_id
  for update;

  if obligation.id is null
     or obligation.origin_kind::text<>'manual'
     or obligation.state::text<>'open'
     or exists(select 1 from public.obligation_events where obligation_id=p_obligation_id)
  then
    raise exception 'only untouched open manual obligations can be corrected' using errcode='23514';
  end if;

  if not exists(
    select 1 from public.financial_parties
    where id=p_counterparty_id and household_id=p_household_id and deactivated_at is null
  ) then
    raise exception 'active household counterparty required' using errcode='23514';
  end if;

  before_payload:=jsonb_build_object(
    'kind',obligation.kind,'counterparty_id',obligation.counterparty_id,'amount',obligation.original_amount,
    'obligation_date',obligation.obligation_date,'due_date',obligation.due_date,
    'description',obligation.description,'notes',obligation.notes,'state',obligation.state
  );

  update public.financial_obligations
  set counterparty_id=p_counterparty_id,
      original_amount=p_amount,
      obligation_date=p_obligation_date,
      due_date=p_due_date,
      description=trim(p_description),
      notes=p_notes,
      updated_at=now()
  where id=obligation.id;

  after_payload:=jsonb_build_object(
    'kind',obligation.kind,'counterparty_id',p_counterparty_id,'amount',p_amount,
    'obligation_date',p_obligation_date,'due_date',p_due_date,
    'description',trim(p_description),'notes',p_notes,'state','open'
  );

  insert into public.manual_obligation_adjustment_events(
    household_id,obligation_id,action,before_payload,after_payload,reason,request_key,created_by_member_id
  ) values (
    p_household_id,obligation.id,'correction',before_payload,after_payload,trim(p_reason),trim(p_request_key),caller.id
  ) returning id into p_obligation_id;

  -- Correção administrativa: deliberadamente sem transactions, money_movements, funding_events ou obligation_events.
  return p_obligation_id;
end
$$;

create or replace function public.cancel_manual_third_party_obligation(
  p_household_id uuid,
  p_obligation_id uuid,
  p_reason text,
  p_request_key text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  obligation public.financial_obligations;
  existing public.manual_obligation_adjustment_events;
  event_id uuid;
  before_payload jsonb;
  after_payload jsonb;
begin
  caller:=public.require_active_member(p_household_id);
  if length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0 then
    raise exception 'reason and request key are required' using errcode='22023';
  end if;

  select * into existing
  from public.manual_obligation_adjustment_events
  where household_id=p_household_id and request_key=trim(p_request_key);
  if existing.id is not null then return existing.id; end if;

  select * into obligation
  from public.financial_obligations
  where id=p_obligation_id and household_id=p_household_id
  for update;

  if obligation.id is null
     or obligation.origin_kind::text<>'manual'
     or obligation.state::text<>'open'
     or exists(select 1 from public.obligation_events where obligation_id=p_obligation_id)
  then
    raise exception 'only untouched open manual obligations can be cancelled administratively' using errcode='23514';
  end if;

  before_payload:=jsonb_build_object(
    'kind',obligation.kind,'counterparty_id',obligation.counterparty_id,'amount',obligation.original_amount,
    'obligation_date',obligation.obligation_date,'due_date',obligation.due_date,
    'description',obligation.description,'notes',obligation.notes,'state',obligation.state
  );
  after_payload:=before_payload||jsonb_build_object('state','cancelled');

  insert into public.obligation_events(
    household_id,obligation_id,created_by_member_id,kind,amount,occurred_at,notes
  ) values (
    p_household_id,obligation.id,caller.id,'cancellation',obligation.original_amount,now(),trim(p_reason)
  );

  update public.financial_obligations
  set state='cancelled',closed_at=now(),updated_at=now()
  where id=obligation.id;

  insert into public.manual_obligation_adjustment_events(
    household_id,obligation_id,action,before_payload,after_payload,reason,request_key,created_by_member_id
  ) values (
    p_household_id,obligation.id,'cancellation',before_payload,after_payload,trim(p_reason),trim(p_request_key),caller.id
  ) returning id into event_id;

  -- Cancelamento de cadastro equivocado é neutro: nenhum caixa, funding, renda ou despesa.
  return event_id;
end
$$;

comment on function public.correct_manual_third_party_obligation(uuid,uuid,uuid,numeric,date,date,text,text,text,text) is
  'Corrects an untouched manual third-party obligation with immutable before/after audit. No economic or cash fact is created.';
comment on function public.cancel_manual_third_party_obligation(uuid,uuid,text,text) is
  'Cancels an untouched manual obligation entered by mistake. Creates only cancellation/history, never income, expense, funding or cash.';

revoke all on function public.correct_manual_third_party_obligation(uuid,uuid,uuid,numeric,date,date,text,text,text,text) from public,anon;
grant execute on function public.correct_manual_third_party_obligation(uuid,uuid,uuid,numeric,date,date,text,text,text,text) to authenticated;
revoke all on function public.cancel_manual_third_party_obligation(uuid,uuid,text,text) from public,anon;
grant execute on function public.cancel_manual_third_party_obligation(uuid,uuid,text,text) to authenticated;
