-- Etapa 10H.12: operational commands for borrowed money and external expense payers.
-- Forward-only. These commands preserve the core rule that cash movement, income,
-- expense recognition, liability creation and funding are distinct facts.

do $$
begin
  create type public.external_payment_intent as enum ('gift','reimbursement');
exception when duplicate_object then null;
end
$$;

alter table public.financial_obligations
  add column if not exists command_key text;

create unique index if not exists financial_obligations_household_command_key
  on public.financial_obligations(household_id,command_key)
  where command_key is not null;

comment on column public.financial_obligations.command_key is
  'Optional caller-supplied idempotency key for atomic operational commands. Replays return the original result; mismatched payloads are rejected.';

create table if not exists public.external_payment_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_transaction_id uuid not null references public.transactions(id) on delete restrict,
  payer_party_id uuid not null references public.financial_parties(id) on delete restrict,
  intent public.external_payment_intent not null,
  amount numeric(19,2) not null check (amount>0),
  occurred_at timestamptz not null,
  payable_obligation_id uuid references public.financial_obligations(id) on delete restrict,
  request_key text not null check (length(trim(request_key))>0),
  notes text,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (household_id,request_key),
  check (
    (intent='gift' and payable_obligation_id is null)
    or (intent='reimbursement' and payable_obligation_id is not null)
  )
);

comment on table public.external_payment_events is
  'An external party paid an expense directly. Gift means no household payable; reimbursement creates a payable. This event never creates household cash or income and never impersonates a member funder.';

alter table public.external_payment_events enable row level security;

drop policy if exists external_payment_events_select_active_member on public.external_payment_events;
create policy external_payment_events_select_active_member
  on public.external_payment_events for select
  to authenticated
  using (public.is_active_household_member(household_id));

revoke all on public.external_payment_events from public,anon;
grant select on public.external_payment_events to authenticated;

create or replace function public.create_borrowed_loan(
  p_household_id uuid,
  p_lender_party_id uuid,
  p_destination_account_id uuid,
  p_principal_amount numeric,
  p_borrowed_at timestamptz,
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
  existing public.financial_obligations;
  result uuid;
begin
  caller:=public.require_active_member(p_household_id);

  if p_principal_amount<=0
     or p_borrowed_at is null
     or length(trim(coalesce(p_description,'')))=0
     or length(trim(coalesce(p_request_key,'')))=0
     or (p_due_date is not null and p_due_date<p_borrowed_at::date)
  then
    raise exception 'invalid borrowed-loan command' using errcode='22023';
  end if;

  if not exists(
    select 1 from public.financial_parties
    where id=p_lender_party_id and household_id=p_household_id and deactivated_at is null
  ) then
    raise exception 'active household lender party required' using errcode='23514';
  end if;

  if not exists(
    select 1 from public.accounts
    where id=p_destination_account_id and household_id=p_household_id and deactivated_at is null
  ) then
    raise exception 'active household destination account required' using errcode='23514';
  end if;

  select * into existing
  from public.financial_obligations
  where household_id=p_household_id and command_key=trim(p_request_key);

  if existing.id is not null then
    if existing.kind<>'payable'
       or existing.origin_kind<>'loan'
       or existing.counterparty_id<>p_lender_party_id
       or existing.original_amount<>p_principal_amount
       or existing.obligation_date<>p_borrowed_at::date
    then
      raise exception 'idempotency key already used with different payload' using errcode='23505';
    end if;
    return existing.id;
  end if;

  insert into public.financial_obligations(
    household_id,created_by_member_id,kind,origin_kind,counterparty_id,
    original_amount,obligation_date,due_date,description,notes,command_key
  ) values (
    p_household_id,caller.id,'payable','loan',p_lender_party_id,
    p_principal_amount,p_borrowed_at::date,p_due_date,trim(p_description),p_notes,trim(p_request_key)
  ) returning id into result;

  -- Borrowed principal increases cash and liability. It is never income.
  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,
    destination_account_id,counterparty_id,obligation_id,
    movement_date,competence_date,notes,realized_at
  ) values (
    p_household_id,caller.id,'loan_principal','realized',p_principal_amount,trim(p_description),
    p_destination_account_id,p_lender_party_id,result,
    p_borrowed_at::date,date_trunc('month',p_borrowed_at)::date,p_notes,p_borrowed_at
  );

  return result;
end
$$;

comment on function public.create_borrowed_loan(uuid,uuid,uuid,numeric,timestamptz,date,text,text,text) is
  'Creates borrowed principal atomically as realized cash plus a payable liability, never as income. Interest and fees are separate later economic events. Caller request_key makes retries idempotent.';

create or replace function public.record_external_expense_payment(
  p_household_id uuid,
  p_transaction_id uuid,
  p_payer_party_id uuid,
  p_intent public.external_payment_intent,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_request_key text,
  p_due_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx public.transactions;
  existing public.external_payment_events;
  applicable_amount numeric;
  member_funded numeric;
  external_already numeric;
  payable_id uuid;
  result uuid;
  total_realized numeric;
begin
  caller:=public.require_active_member(p_household_id);

  if p_amount<=0 or p_occurred_at is null or length(trim(coalesce(p_request_key,'')))=0 then
    raise exception 'invalid external-payment command' using errcode='22023';
  end if;
  if p_intent='gift' and p_due_date is not null then
    raise exception 'gift cannot create a reimbursement due date' using errcode='22023';
  end if;
  if p_intent='reimbursement' and p_due_date is not null and p_due_date<p_occurred_at::date then
    raise exception 'reimbursement due date cannot precede payment' using errcode='22023';
  end if;

  select * into existing
  from public.external_payment_events
  where household_id=p_household_id and request_key=trim(p_request_key);

  if existing.id is not null then
    if existing.source_transaction_id<>p_transaction_id
       or existing.payer_party_id<>p_payer_party_id
       or existing.intent<>p_intent
       or existing.amount<>p_amount
       or existing.occurred_at<>p_occurred_at
    then
      raise exception 'idempotency key already used with different payload' using errcode='23505';
    end if;
    return existing.id;
  end if;

  select * into tx
  from public.transactions
  where id=p_transaction_id and household_id=p_household_id
    and type='expense' and deleted_at is null
  for update;

  if tx.id is null or tx.economic_state in ('cancelled','reversed') then
    raise exception 'active household expense required' using errcode='23514';
  end if;

  if not exists(
    select 1 from public.financial_parties
    where id=p_payer_party_id and household_id=p_household_id and deactivated_at is null
  ) then
    raise exception 'active household external payer required' using errcode='23514';
  end if;

  -- Card-financed expenses have invoice/funding semantics and need their dedicated route.
  if exists(
    select 1 from public.financing_allocations
    where household_id=p_household_id and transaction_id=tx.id
      and mechanism in ('card_purchase','card_pix')
  ) then
    raise exception 'external payer for card-financed expense requires dedicated card route' using errcode='0A000';
  end if;

  applicable_amount:=public.financial_effective_total_amount(
    tx.economic_state,tx.estimated_amount,tx.confirmed_amount,tx.realized_amount,tx.amount
  );

  select coalesce(sum(amount),0) into member_funded
  from public.funding_events
  where financed_transaction_id=tx.id and invoice_id is null;

  select coalesce(sum(amount),0) into external_already
  from public.external_payment_events
  where source_transaction_id=tx.id;

  if member_funded+external_already+p_amount>applicable_amount then
    raise exception 'external payment exceeds unpaid economic amount' using errcode='23514';
  end if;

  if p_intent='reimbursement' then
    insert into public.financial_obligations(
      household_id,created_by_member_id,kind,origin_kind,counterparty_id,
      source_transaction_id,original_amount,obligation_date,due_date,description,notes
    ) values (
      p_household_id,caller.id,'payable','reimbursement',p_payer_party_id,
      tx.id,p_amount,p_occurred_at::date,p_due_date,
      'Reembolso a terceiro: '||tx.description,p_notes
    ) returning id into payable_id;
  end if;

  insert into public.external_payment_events(
    household_id,source_transaction_id,payer_party_id,intent,amount,occurred_at,
    payable_obligation_id,request_key,notes,created_by_member_id
  ) values (
    p_household_id,tx.id,p_payer_party_id,p_intent,p_amount,p_occurred_at,
    payable_id,trim(p_request_key),p_notes,caller.id
  ) returning id into result;

  -- No money_movement and no income are created: the Casa did not move cash.
  -- realized_amount remains an economic-realization amount and includes external
  -- settlement together with direct member funding for this non-card expense.
  total_realized:=member_funded+external_already+p_amount;
  update public.transactions
  set realized_amount=total_realized,
      economic_state=case when total_realized=applicable_amount then 'realized'::public.economic_state else 'confirmed'::public.economic_state end,
      status=case when total_realized=applicable_amount then 'paid'::public.transaction_state else 'pending'::public.transaction_state end,
      settled_at=case when total_realized=applicable_amount then p_occurred_at else null end,
      updated_at=now()
  where id=tx.id;

  return result;
end
$$;

comment on function public.record_external_expense_payment(uuid,uuid,uuid,public.external_payment_intent,numeric,timestamptz,text,date,text) is
  'Records that an external party paid a non-card expense. Gift creates no payable; reimbursement creates a payable. The Casa gets no cash/income from the event, and the external party is never inferred as a household member funder.';

-- Forward-only replacement of the direct-expense settlement command so partial
-- direct funding composes correctly with external-payment events.
create or replace function public.settle_direct_expense(
  p_household_id uuid,p_transaction_id uuid,p_source_account_id uuid,
  p_funder_member_id uuid,p_amount numeric,p_paid_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx public.transactions;
  payment_tx uuid;
  movement_id uuid;
  member_already numeric;
  external_already numeric;
  applicable_amount numeric;
  new_realized_amount numeric;
begin
  caller:=public.require_active_member(p_household_id);
  select * into tx from public.transactions
   where id=p_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null
   for update;
  if tx.id is null or tx.economic_state in ('cancelled','reversed') or p_amount<=0 then
    raise exception 'active expense and positive amount required' using errcode='23514';
  end if;
  if not exists(select 1 from public.accounts where id=p_source_account_id and household_id=p_household_id and deactivated_at is null)
     or not exists(select 1 from public.household_members where id=p_funder_member_id and household_id=p_household_id and deactivated_at is null)
  then
    raise exception 'source account and funder must belong to household' using errcode='23514';
  end if;

  select coalesce(sum(amount),0) into member_already
  from public.funding_events where financed_transaction_id=tx.id and invoice_id is null;
  select coalesce(sum(amount),0) into external_already
  from public.external_payment_events where source_transaction_id=tx.id;

  applicable_amount:=public.financial_effective_total_amount(
    tx.economic_state,tx.estimated_amount,tx.confirmed_amount,tx.realized_amount,tx.amount
  );
  new_realized_amount:=member_already+external_already+p_amount;
  if new_realized_amount>applicable_amount then
    raise exception 'expense funding exceeds economic amount' using errcode='23514';
  end if;

  insert into public.transactions(
    household_id,created_by_member_id,type,status,economic_state,description,amount,
    estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at
  ) values (
    p_household_id,caller.id,'adjustment','paid','realized','Liquidação: '||tx.description,p_amount,
    p_amount,p_amount,p_amount,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at
  ) returning id into payment_tx;

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,source_account_id,
    related_transaction_id,movement_date,competence_date,realized_at
  ) values (
    p_household_id,caller.id,'expense_payment','realized',p_amount,tx.description,p_source_account_id,
    tx.id,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at
  ) returning id into movement_id;

  insert into public.funding_events(
    household_id,financed_transaction_id,funding_transaction_id,funder_member_id,
    source_account_id,amount,funded_at
  ) values (
    p_household_id,tx.id,payment_tx,p_funder_member_id,p_source_account_id,p_amount,p_paid_at
  );

  update public.transactions
  set realized_amount=new_realized_amount,
      economic_state=case when new_realized_amount=applicable_amount then 'realized'::public.economic_state else 'confirmed'::public.economic_state end,
      status=case when new_realized_amount=applicable_amount then 'paid'::public.transaction_state else 'pending'::public.transaction_state end,
      settled_at=case when new_realized_amount=applicable_amount then p_paid_at else null end,
      updated_at=now()
  where id=tx.id;

  return movement_id;
end
$$;

revoke all on function public.create_borrowed_loan(uuid,uuid,uuid,numeric,timestamptz,date,text,text,text) from public,anon;
grant execute on function public.create_borrowed_loan(uuid,uuid,uuid,numeric,timestamptz,date,text,text,text) to authenticated;

revoke all on function public.record_external_expense_payment(uuid,uuid,uuid,public.external_payment_intent,numeric,timestamptz,text,date,text) from public,anon;
grant execute on function public.record_external_expense_payment(uuid,uuid,uuid,public.external_payment_intent,numeric,timestamptz,text,date,text) to authenticated;

revoke all on function public.settle_direct_expense(uuid,uuid,uuid,uuid,numeric,timestamptz) from public,anon;
grant execute on function public.settle_direct_expense(uuid,uuid,uuid,uuid,numeric,timestamptz) to authenticated;

-- Invariants preserved:
-- * borrowed principal = cash + liability, income zero;
-- * external gift = expense remains, Casa cash zero, payable zero;
-- * external reimbursement = expense remains, Casa cash zero, payable created;
-- * repayment of that payable remains a later neutral principal cash event;
-- * external payer is never coerced into buyer/owner/responsible/funder-member roles;
-- * retry keys are idempotent and mismatched replays fail;
-- * no card-financed external route is guessed.