-- Etapa 10AK: rendimento e perda de investimento/reserva.
-- Principal continua neutro; performance altera patrimônio sem inventar caixa disponível.

do $$ begin
  create type public.investment_performance_kind as enum ('yield','loss');
exception when duplicate_object then null; end $$;

create table if not exists public.investment_performance_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  transaction_id uuid not null unique references public.transactions(id) on delete restrict,
  account_balance_event_id uuid not null unique references public.account_balance_events(id) on delete restrict,
  kind public.investment_performance_kind not null,
  amount numeric(19,2) not null check (amount>0),
  effective_date date not null,
  description text not null check (length(trim(description))>0),
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index if not exists investment_performance_household_date on public.investment_performance_events(household_id,effective_date desc);
alter table public.investment_performance_events enable row level security;

drop policy if exists investment_performance_select on public.investment_performance_events;
create policy investment_performance_select on public.investment_performance_events for select to authenticated
using (public.is_active_household_member(household_id));

create or replace function public.record_investment_performance(
  p_household_id uuid,
  p_account_id uuid,
  p_kind public.investment_performance_kind,
  p_amount numeric,
  p_effective_date date,
  p_description text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  account_row public.accounts;
  tx_id uuid;
  balance_event_id uuid;
  performance_id uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if p_amount<=0 or p_effective_date is null or length(trim(coalesce(p_description,'')))=0 then
    raise exception 'positive amount, date and description are required' using errcode='22023';
  end if;
  select * into account_row from public.accounts
   where id=p_account_id and household_id=p_household_id and deactivated_at is null;
  if account_row.id is null or not (account_row.type='investment' or account_row.resource_restriction='reserve') then
    raise exception 'active investment or reserve account required' using errcode='23514';
  end if;

  insert into public.transactions(
    household_id,created_by_member_id,type,status,economic_state,description,amount,
    estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,income_nature
  ) values(
    p_household_id,caller.id,
    case when p_kind='yield' then 'income'::public.transaction_kind else 'adjustment'::public.transaction_kind end,
    case when p_kind='yield' then 'received'::public.transaction_state else 'paid'::public.transaction_state end,
    'realized',trim(p_description),p_amount,p_amount,p_amount,p_amount,
    p_effective_date,date_trunc('month',p_effective_date)::date,
    case when p_kind='yield' then 'interest_yield'::public.income_nature else null end
  ) returning id into tx_id;

  insert into public.transaction_components(household_id,transaction_id,kind,amount)
  values(p_household_id,tx_id,
    case when p_kind='yield' then 'yield'::public.financial_component_kind else 'loss'::public.financial_component_kind end,
    p_amount);

  insert into public.account_balance_events(
    household_id,account_id,created_by_member_id,kind,amount,effective_date,description
  ) values(
    p_household_id,p_account_id,caller.id,'adjustment',
    case when p_kind='yield' then p_amount else -p_amount end,
    p_effective_date,trim(p_description)
  ) returning id into balance_event_id;

  insert into public.investment_performance_events(
    household_id,account_id,transaction_id,account_balance_event_id,kind,amount,effective_date,description,created_by_member_id
  ) values(
    p_household_id,p_account_id,tx_id,balance_event_id,p_kind,p_amount,p_effective_date,trim(p_description),caller.id
  ) returning id into performance_id;

  return performance_id;
end $$;

revoke all on function public.record_investment_performance(uuid,uuid,public.investment_performance_kind,numeric,date,text) from public,anon;
grant execute on function public.record_investment_performance(uuid,uuid,public.investment_performance_kind,numeric,date,text) to authenticated;

create or replace view public.financial_investment_performance_positions with (security_invoker=true) as
select e.household_id,e.id event_id,e.account_id,a.name account_name,e.transaction_id,e.kind,e.amount,e.effective_date,e.description,e.created_at
from public.investment_performance_events e
join public.accounts a on a.id=e.account_id and a.household_id=e.household_id;
revoke all on public.financial_investment_performance_positions from public,anon;
grant select on public.financial_investment_performance_positions to authenticated;

comment on function public.record_investment_performance(uuid,uuid,public.investment_performance_kind,numeric,date,text) is
  'Records investment/reserve performance as an economic fact plus signed patrimonial balance event. No available-cash movement is created; principal transfers remain separate.';
