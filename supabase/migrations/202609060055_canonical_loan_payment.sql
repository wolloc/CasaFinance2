-- Etapa 10AM: pagamento de empréstimo com uma única saída de caixa e composição explícita.
-- Principal continua neutro; encargos já foram reconhecidos economicamente na 10AL.

create table if not exists public.loan_payment_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  principal_obligation_id uuid not null references public.financial_obligations(id) on delete restrict,
  movement_id uuid not null unique references public.money_movements(id) on delete restrict,
  payment_transaction_id uuid not null unique references public.transactions(id) on delete restrict,
  source_account_id uuid not null references public.accounts(id) on delete restrict,
  funder_member_id uuid not null references public.household_members(id) on delete restrict,
  principal_amount numeric(19,2) not null check (principal_amount>=0),
  charge_amount numeric(19,2) not null check (charge_amount>=0),
  total_amount numeric(19,2) not null check (total_amount>0 and total_amount=principal_amount+charge_amount),
  request_key text not null,
  paid_at timestamptz not null,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(household_id,request_key)
);
alter table public.loan_payment_events enable row level security;
drop policy if exists loan_payment_events_member_select on public.loan_payment_events;
create policy loan_payment_events_member_select on public.loan_payment_events for select to authenticated using (public.is_active_household_member(household_id));

create or replace view public.financial_loan_payment_components with (security_invoker=true) as
select p.household_id,p.id principal_obligation_id,p.id component_obligation_id,'principal'::text component_kind,
       p.description,party.name counterparty_name,b.outstanding_amount,p.due_date
from public.financial_obligations p
join public.financial_obligation_balances b on b.household_id=p.household_id and b.obligation_id=p.id
join public.financial_parties party on party.id=p.counterparty_id and party.household_id=p.household_id
where p.kind='payable' and p.origin_kind='loan' and p.state in ('open','partially_settled') and b.outstanding_amount>0
union all
select e.household_id,e.principal_obligation_id,e.charge_obligation_id,e.kind::text,
       o.description,party.name,b.outstanding_amount,o.due_date
from public.loan_charge_events e
join public.financial_obligations o on o.id=e.charge_obligation_id and o.household_id=e.household_id
join public.financial_obligation_balances b on b.obligation_id=o.id and b.household_id=o.household_id
join public.financial_parties party on party.id=o.counterparty_id and party.household_id=o.household_id
where o.state in ('open','partially_settled') and b.outstanding_amount>0;

create or replace function public.record_loan_payment(
  p_household_id uuid,
  p_principal_obligation_id uuid,
  p_source_account_id uuid,
  p_funder_member_id uuid,
  p_principal_amount numeric,
  p_charge_allocations jsonb,
  p_paid_at timestamptz,
  p_notes text,
  p_request_key text
) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  caller public.household_members;
  principal public.financial_obligations;
  principal_outstanding numeric;
  charge jsonb;
  charge_obligation public.financial_obligations;
  charge_outstanding numeric;
  principal_paid numeric:=coalesce(p_principal_amount,0);
  charges_paid numeric:=0;
  total_paid numeric;
  movement_id uuid;
  payment_tx uuid;
  event_id uuid;
  existing uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if p_paid_at is null or length(trim(coalesce(p_request_key,'')))=0 or principal_paid<0 then raise exception 'invalid loan payment command' using errcode='22023'; end if;
  if not exists(select 1 from public.household_members where id=p_funder_member_id and household_id=p_household_id and deactivated_at is null) then raise exception 'active funder required' using errcode='23514'; end if;
  if not exists(select 1 from public.accounts where id=p_source_account_id and household_id=p_household_id and deactivated_at is null and type in ('cash','checking','savings','digital_wallet') and resource_restriction is null) then raise exception 'active unrestricted transactional source required' using errcode='23514'; end if;
  select id into existing from public.loan_payment_events where household_id=p_household_id and request_key=trim(p_request_key); if existing is not null then return existing; end if;

  select * into principal from public.financial_obligations where id=p_principal_obligation_id and household_id=p_household_id and kind='payable' and origin_kind='loan' and state in ('open','partially_settled') for update;
  if principal.id is null then raise exception 'active payable loan principal required' using errcode='23514'; end if;
  select outstanding_amount into principal_outstanding from public.financial_obligation_balances where household_id=p_household_id and obligation_id=principal.id;
  if principal_paid>coalesce(principal_outstanding,0) then raise exception 'principal payment exceeds outstanding amount' using errcode='23514'; end if;

  for charge in select * from jsonb_array_elements(coalesce(p_charge_allocations,'[]'::jsonb)) loop
    if coalesce((charge->>'amount')::numeric,0)<=0 then raise exception 'charge allocation must be positive' using errcode='22023'; end if;
    select o.* into charge_obligation from public.loan_charge_events e join public.financial_obligations o on o.id=e.charge_obligation_id and o.household_id=e.household_id where e.household_id=p_household_id and e.principal_obligation_id=principal.id and e.charge_obligation_id=(charge->>'obligation_id')::uuid and o.state in ('open','partially_settled') for update;
    if charge_obligation.id is null then raise exception 'charge does not belong to active loan' using errcode='23514'; end if;
    select outstanding_amount into charge_outstanding from public.financial_obligation_balances where household_id=p_household_id and obligation_id=charge_obligation.id;
    if (charge->>'amount')::numeric>coalesce(charge_outstanding,0) then raise exception 'charge payment exceeds outstanding amount' using errcode='23514'; end if;
    charges_paid:=charges_paid+(charge->>'amount')::numeric;
  end loop;
  total_paid:=principal_paid+charges_paid;
  if total_paid<=0 then raise exception 'payment must include principal or charge' using errcode='22023'; end if;

  insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,source_account_id,counterparty_id,obligation_id,movement_date,competence_date,notes,realized_at)
  values(p_household_id,caller.id,'payable_payment','realized',total_paid,'Pagamento de empréstimo',p_source_account_id,principal.counterparty_id,principal.id,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_notes,p_paid_at) returning id into movement_id;
  insert into public.transactions(household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at,notes)
  values(p_household_id,caller.id,'adjustment','paid','realized','Liquidação composta de empréstimo',total_paid,total_paid,total_paid,total_paid,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at,p_notes) returning id into payment_tx;

  if principal_paid>0 then
    insert into public.obligation_events(household_id,obligation_id,created_by_member_id,kind,amount,movement_id,occurred_at,notes) values(p_household_id,principal.id,caller.id,'payment',principal_paid,movement_id,p_paid_at,p_notes) returning id into event_id;
    update public.financial_obligations set state=case when principal_paid=principal_outstanding then 'settled' else 'partially_settled' end,closed_at=case when principal_paid=principal_outstanding then p_paid_at else null end,updated_at=now() where id=principal.id;
  end if;

  for charge in select * from jsonb_array_elements(coalesce(p_charge_allocations,'[]'::jsonb)) loop
    select o.* into charge_obligation from public.loan_charge_events e join public.financial_obligations o on o.id=e.charge_obligation_id and o.household_id=e.household_id where e.household_id=p_household_id and e.principal_obligation_id=principal.id and e.charge_obligation_id=(charge->>'obligation_id')::uuid;
    select outstanding_amount into charge_outstanding from public.financial_obligation_balances where household_id=p_household_id and obligation_id=charge_obligation.id;
    insert into public.obligation_events(household_id,obligation_id,created_by_member_id,kind,amount,movement_id,occurred_at,notes) values(p_household_id,charge_obligation.id,caller.id,'payment',(charge->>'amount')::numeric,movement_id,p_paid_at,p_notes);
    update public.financial_obligations set state=case when (charge->>'amount')::numeric=charge_outstanding then 'settled' else 'partially_settled' end,closed_at=case when (charge->>'amount')::numeric=charge_outstanding then p_paid_at else null end,updated_at=now() where id=charge_obligation.id;
    insert into public.funding_events(household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,amount,funded_at) values(p_household_id,charge_obligation.source_transaction_id,payment_tx,p_funder_member_id,p_source_account_id,(charge->>'amount')::numeric,p_paid_at);
  end loop;

  insert into public.loan_payment_events(household_id,principal_obligation_id,movement_id,payment_transaction_id,source_account_id,funder_member_id,principal_amount,charge_amount,total_amount,request_key,paid_at,created_by_member_id)
  values(p_household_id,principal.id,movement_id,payment_tx,p_source_account_id,p_funder_member_id,principal_paid,charges_paid,total_paid,trim(p_request_key),p_paid_at,caller.id) returning id into existing;
  return existing;
end $$;

revoke all on table public.loan_payment_events from public,anon; grant select on table public.loan_payment_events to authenticated;
revoke all on public.financial_loan_payment_components from public,anon; grant select on public.financial_loan_payment_components to authenticated;
revoke all on function public.record_loan_payment(uuid,uuid,uuid,uuid,numeric,jsonb,timestamptz,text,text) from public,anon;
grant execute on function public.record_loan_payment(uuid,uuid,uuid,uuid,numeric,jsonb,timestamptz,text,text) to authenticated;

comment on function public.record_loan_payment(uuid,uuid,uuid,uuid,numeric,jsonb,timestamptz,text,text) is 'Records one real cash outflow and allocates it across loan principal and previously accrued charge obligations. Principal stays economically neutral; charges are not recognized twice.';
