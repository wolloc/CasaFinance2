-- Etapa 10AL: juros, tarifas e multas de empréstimos tomados.
-- Principal continua neutro. Encargo nasce como despesa econômica + obrigação; caixa só muda na liquidação explícita.

create table if not exists public.loan_charge_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  principal_obligation_id uuid not null references public.financial_obligations(id) on delete restrict,
  charge_obligation_id uuid not null unique references public.financial_obligations(id) on delete restrict,
  transaction_id uuid not null unique references public.transactions(id) on delete restrict,
  kind public.financial_component_kind not null check (kind in ('interest','fee','penalty')),
  amount numeric(19,2) not null check (amount>0),
  request_key text not null,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(household_id,request_key)
);

alter table public.loan_charge_events enable row level security;
drop policy if exists loan_charge_events_member_select on public.loan_charge_events;
create policy loan_charge_events_member_select on public.loan_charge_events for select to authenticated using (public.is_active_household_member(household_id));

create or replace function public.record_loan_charge(
  p_household_id uuid,
  p_principal_obligation_id uuid,
  p_kind text,
  p_amount numeric,
  p_charge_date date,
  p_due_date date,
  p_responsible_member_id uuid,
  p_description text,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  principal public.financial_obligations;
  tx_id uuid;
  charge_obligation_id uuid;
  component_kind public.financial_component_kind;
  existing uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if p_kind not in ('interest','fee','penalty') then raise exception 'loan charge kind must be interest, fee or penalty' using errcode='22023'; end if;
  if p_amount<=0 or p_charge_date is null or p_due_date is null or p_due_date<p_charge_date or length(trim(coalesce(p_description,'')))=0 or length(trim(coalesce(p_request_key,'')))=0 then raise exception 'invalid loan charge command' using errcode='22023'; end if;
  if not exists(select 1 from public.household_members where id=p_responsible_member_id and household_id=p_household_id and deactivated_at is null) then raise exception 'active responsible member required' using errcode='23514'; end if;

  select id into existing from public.loan_charge_events where household_id=p_household_id and request_key=trim(p_request_key);
  if existing is not null then return existing; end if;

  select * into principal from public.financial_obligations where id=p_principal_obligation_id and household_id=p_household_id and kind='payable' and origin_kind='loan' and state in ('open','partially_settled') for update;
  if principal.id is null then raise exception 'active payable loan principal required' using errcode='23514'; end if;

  component_kind:=p_kind::public.financial_component_kind;
  insert into public.transactions(household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,due_date)
  values(p_household_id,caller.id,'expense','pending','confirmed',trim(p_description),p_amount,p_amount,p_amount,0,p_charge_date,date_trunc('month',p_charge_date)::date,p_due_date)
  returning id into tx_id;

  insert into public.transaction_components(household_id,transaction_id,kind,amount) values(p_household_id,tx_id,component_kind,p_amount);
  insert into public.economic_allocations(household_id,transaction_id,responsible_member_id,allocation_order,amount,percentage) values(p_household_id,tx_id,p_responsible_member_id,1,p_amount,100);

  insert into public.financial_obligations(household_id,created_by_member_id,kind,origin_kind,counterparty_id,source_transaction_id,original_amount,obligation_date,due_date,state,description)
  values(p_household_id,caller.id,'payable','loan',principal.counterparty_id,tx_id,p_amount,p_charge_date,p_due_date,'open',trim(p_description))
  returning id into charge_obligation_id;

  insert into public.loan_charge_events(household_id,principal_obligation_id,charge_obligation_id,transaction_id,kind,amount,request_key,created_by_member_id)
  values(p_household_id,principal.id,charge_obligation_id,tx_id,component_kind,p_amount,trim(p_request_key),caller.id)
  returning id into existing;
  return existing;
end $$;

create or replace view public.financial_loan_cost_positions with (security_invoker=true) as
select p.household_id,p.id principal_obligation_id,party.name counterparty_name,p.description,
       b.outstanding_amount principal_outstanding,p.due_date principal_due_date,
       coalesce(sum(cb.outstanding_amount),0)::numeric(19,2) charges_outstanding,
       coalesce(sum(e.amount),0)::numeric(19,2) charges_accrued
from public.financial_obligations p
join public.financial_obligation_balances b on b.household_id=p.household_id and b.obligation_id=p.id
join public.financial_parties party on party.id=p.counterparty_id and party.household_id=p.household_id
left join public.loan_charge_events e on e.household_id=p.household_id and e.principal_obligation_id=p.id
left join public.financial_obligation_balances cb on cb.household_id=e.household_id and cb.obligation_id=e.charge_obligation_id
where p.kind='payable' and p.origin_kind='loan' and p.state in ('open','partially_settled')
group by p.household_id,p.id,party.name,p.description,b.outstanding_amount,p.due_date;

revoke all on table public.loan_charge_events from public,anon;
grant select on table public.loan_charge_events to authenticated;
revoke all on function public.record_loan_charge(uuid,uuid,text,numeric,date,date,uuid,text,text) from public,anon;
grant execute on function public.record_loan_charge(uuid,uuid,text,numeric,date,date,uuid,text,text) to authenticated;
revoke all on public.financial_loan_cost_positions from public,anon;
grant select on public.financial_loan_cost_positions to authenticated;

comment on function public.record_loan_charge(uuid,uuid,text,numeric,date,date,uuid,text,text) is 'Accrues an explicit economic loan cost as expense plus separate payable. It never changes principal and never moves cash; settlement remains explicit through the obligation flow.';