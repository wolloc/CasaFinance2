-- Etapa 10AR: criação explícita de obrigações patrimoniais com terceiros.
-- Uma obrigação manual NÃO é renda, despesa nem caixa. Ela apenas registra que a Casa
-- tem um valor a receber ou a pagar que não nasceu de um fato econômico já modelado.

create table if not exists public.manual_obligation_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  obligation_id uuid not null references public.financial_obligations(id) on delete restrict,
  kind text not null check (kind in ('receivable','payable')),
  counterparty_id uuid not null references public.financial_parties(id) on delete restrict,
  amount numeric(19,2) not null check (amount > 0),
  obligation_date date not null,
  due_date date,
  description text not null check (length(trim(description)) > 0),
  request_key text not null check (length(trim(request_key)) > 0),
  notes text,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (household_id, request_key)
);

comment on table public.manual_obligation_events is
  'Immutable history for manually declared third-party receivables/payables. Creation is patrimonial/commitment-only: it never creates income, expense, funding or cash.';

alter table public.manual_obligation_events enable row level security;
drop policy if exists manual_obligation_events_select_active_member on public.manual_obligation_events;
create policy manual_obligation_events_select_active_member
  on public.manual_obligation_events for select to authenticated
  using (public.is_active_household_member(household_id));
revoke all on public.manual_obligation_events from public,anon;
grant select on public.manual_obligation_events to authenticated;

create or replace function public.create_manual_third_party_obligation(
  p_household_id uuid,
  p_kind text,
  p_counterparty_id uuid,
  p_amount numeric,
  p_obligation_date date,
  p_due_date date,
  p_description text,
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
  existing public.manual_obligation_events;
  result uuid;
begin
  caller:=public.require_active_member(p_household_id);

  if p_kind not in ('receivable','payable')
     or p_amount is null or p_amount<=0
     or p_obligation_date is null
     or (p_due_date is not null and p_due_date<p_obligation_date)
     or length(trim(coalesce(p_description,'')))=0
     or length(trim(coalesce(p_request_key,'')))=0
  then
    raise exception 'invalid manual obligation command' using errcode='22023';
  end if;

  if not exists(
    select 1 from public.financial_parties
    where id=p_counterparty_id and household_id=p_household_id and deactivated_at is null
  ) then
    raise exception 'active household counterparty required' using errcode='23514';
  end if;

  select * into existing
  from public.manual_obligation_events
  where household_id=p_household_id and request_key=trim(p_request_key);

  if existing.id is not null then
    if existing.kind<>p_kind
       or existing.counterparty_id<>p_counterparty_id
       or existing.amount<>p_amount
       or existing.obligation_date<>p_obligation_date
       or existing.due_date is distinct from p_due_date
       or existing.description<>trim(p_description)
    then
      raise exception 'idempotency key already used with different payload' using errcode='23505';
    end if;
    return existing.obligation_id;
  end if;

  insert into public.financial_obligations(
    household_id,created_by_member_id,kind,origin_kind,counterparty_id,
    original_amount,obligation_date,due_date,description,notes,command_key
  ) values (
    p_household_id,caller.id,p_kind::public.financial_obligation_kind,'manual',p_counterparty_id,
    p_amount,p_obligation_date,p_due_date,trim(p_description),p_notes,trim(p_request_key)
  ) returning id into result;

  insert into public.manual_obligation_events(
    household_id,obligation_id,kind,counterparty_id,amount,obligation_date,due_date,
    description,request_key,notes,created_by_member_id
  ) values (
    p_household_id,result,p_kind,p_counterparty_id,p_amount,p_obligation_date,p_due_date,
    trim(p_description),trim(p_request_key),p_notes,caller.id
  );

  -- Deliberadamente sem transactions, money_movements ou funding_events.
  return result;
end
$$;

comment on function public.create_manual_third_party_obligation(uuid,text,uuid,numeric,date,date,text,text,text) is
  'Declares a standalone receivable/payable with an external party. This is a commitment/patrimonial fact only; no income, expense, funding or cash is created. Later settlement uses settle_financial_obligation.';

revoke all on function public.create_manual_third_party_obligation(uuid,text,uuid,numeric,date,date,text,text,text) from public,anon;
grant execute on function public.create_manual_third_party_obligation(uuid,text,uuid,numeric,date,date,text,text,text) to authenticated;
