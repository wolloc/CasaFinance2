-- Etapa 10C: modelo aditivo do Motor Financeiro v1.
-- Nenhum dado legado e reinterpretado ou associado automaticamente.

do $$ begin create type public.financial_party_kind as enum ('person','organization'); exception when duplicate_object then null; end $$;
do $$ begin create type public.economic_state as enum ('forecast','confirmed','realized','cancelled','reversed'); exception when duplicate_object then null; end $$;
do $$ begin create type public.financial_component_kind as enum ('principal','interest','fee','penalty','loss','yield','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.transaction_link_kind as enum ('refund','return','reimbursement','interest','fee','penalty','loss','financing','correction'); exception when duplicate_object then null; end $$;
do $$ begin create type public.obligation_kind as enum ('receivable','payable'); exception when duplicate_object then null; end $$;
do $$ begin create type public.obligation_origin_kind as enum ('loan','advance','shared_expense','reimbursement','informal_debt','invoice_financing','other'); exception when duplicate_object then null; end $$;
do $$ begin create type public.obligation_state as enum ('open','partially_settled','settled','cancelled','written_off'); exception when duplicate_object then null; end $$;
do $$ begin create type public.obligation_event_kind as enum ('receipt','payment','cancellation','write_off','adjustment'); exception when duplicate_object then null; end $$;
do $$ begin create type public.account_balance_event_kind as enum ('opening','adjustment'); exception when duplicate_object then null; end $$;
do $$ begin create type public.financing_mechanism as enum ('account','card_purchase','card_pix','external','benefit','other'); exception when duplicate_object then null; end $$;

alter type public.money_movement_kind add value if not exists 'expense_payment';
alter type public.money_movement_kind add value if not exists 'receivable_disbursement';
alter type public.money_movement_kind add value if not exists 'receivable_collection';
alter type public.money_movement_kind add value if not exists 'payable_payment';
alter type public.money_movement_kind add value if not exists 'loan_principal';
alter type public.money_movement_kind add value if not exists 'refund';
alter type public.money_movement_kind add value if not exists 'meal_benefit_load';
alter type public.money_movement_kind add value if not exists 'adjustment';

create table public.financial_parties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind public.financial_party_kind not null default 'person',
  name text not null check (length(trim(name)) > 0),
  tax_id text,
  notes text,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz
);
create unique index financial_parties_active_name on public.financial_parties(household_id, lower(name)) where deactivated_at is null;

create table public.account_ownerships (
  account_id uuid not null references public.accounts(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (account_id, member_id)
);
create index account_ownerships_household on public.account_ownerships(household_id, account_id);

create table public.account_balance_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  kind public.account_balance_event_kind not null,
  amount numeric(19,2) not null,
  effective_date date not null,
  description text not null check (length(trim(description)) > 0),
  created_at timestamptz not null default now(),
  reversed_at timestamptz
);
create unique index account_single_opening_event on public.account_balance_events(account_id) where kind='opening' and reversed_at is null;
create index account_balance_events_household_date on public.account_balance_events(household_id, account_id, effective_date);

alter table public.accounts add column if not exists resource_restriction text
  check (resource_restriction is null or resource_restriction in ('meal_benefit','reserve'));
alter table public.accounts add column if not exists cash_location text;
comment on column public.accounts.owner_member_id is 'LEGACY: use account_ownerships; null must not be interpreted as joint ownership.';
comment on column public.accounts.opening_balance is 'LEGACY: new opening positions use account_balance_events(kind=opening). No automatic backfill.';
comment on column public.accounts.opened_at is 'LEGACY metadata; effective opening position date lives in account_balance_events.';

alter table public.transactions add column if not exists economic_state public.economic_state not null default 'confirmed';
alter table public.transactions add column if not exists estimated_amount numeric(19,2) check (estimated_amount is null or estimated_amount > 0);
alter table public.transactions add column if not exists confirmed_amount numeric(19,2) check (confirmed_amount is null or confirmed_amount > 0);
alter table public.transactions add column if not exists realized_amount numeric(19,2) not null default 0 check (realized_amount >= 0);

create table public.transaction_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  source_transaction_id uuid not null references public.transactions(id) on delete restrict,
  related_transaction_id uuid not null references public.transactions(id) on delete restrict,
  kind public.transaction_link_kind not null,
  amount numeric(19,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  check (source_transaction_id <> related_transaction_id),
  unique (source_transaction_id, related_transaction_id, kind)
);

create table public.transaction_components (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  kind public.financial_component_kind not null,
  amount numeric(19,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (transaction_id, kind)
);

create table public.economic_allocations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  responsible_member_id uuid references public.household_members(id) on delete restrict,
  responsible_party_id uuid references public.financial_parties(id) on delete restrict,
  amount numeric(19,2) not null check (amount > 0),
  percentage numeric(7,4) not null check (percentage > 0 and percentage <= 100),
  created_at timestamptz not null default now(),
  check ((responsible_member_id is not null)::integer + (responsible_party_id is not null)::integer = 1)
);
create unique index economic_allocations_member_unique on public.economic_allocations(transaction_id,responsible_member_id) where responsible_member_id is not null;
create unique index economic_allocations_party_unique on public.economic_allocations(transaction_id,responsible_party_id) where responsible_party_id is not null;
comment on table public.transaction_splits is 'LEGACY-compatible member-only allocations. New flows use economic_allocations.';

create table public.financial_obligations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  kind public.obligation_kind not null,
  origin_kind public.obligation_origin_kind not null default 'other',
  counterparty_id uuid not null references public.financial_parties(id) on delete restrict,
  source_transaction_id uuid references public.transactions(id) on delete restrict,
  invoice_id uuid references public.card_invoices(id) on delete restrict,
  original_amount numeric(19,2) not null check (original_amount > 0),
  obligation_date date not null,
  due_date date,
  state public.obligation_state not null default 'open',
  description text not null check (length(trim(description)) > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((state in ('settled','cancelled','written_off')) = (closed_at is not null))
);
create index financial_obligations_household_state_due on public.financial_obligations(household_id,kind,state,due_date);

create table public.obligation_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  obligation_id uuid not null references public.financial_obligations(id) on delete restrict,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  kind public.obligation_event_kind not null,
  amount numeric(19,2) not null check (amount > 0),
  movement_id uuid references public.money_movements(id) on delete restrict,
  economic_transaction_id uuid references public.transactions(id) on delete restrict,
  occurred_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now(),
  check ((kind in ('receipt','payment')) = (movement_id is not null)),
  check (kind <> 'write_off' or economic_transaction_id is not null)
);
create index obligation_events_obligation_date on public.obligation_events(obligation_id, occurred_at);

alter table public.money_movements add column if not exists counterparty_id uuid references public.financial_parties(id) on delete restrict;
alter table public.money_movements add column if not exists related_transaction_id uuid references public.transactions(id) on delete restrict;
alter table public.money_movements add column if not exists obligation_id uuid references public.financial_obligations(id) on delete restrict;

create table public.financing_allocations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete restrict,
  obligation_id uuid references public.financial_obligations(id) on delete restrict,
  mechanism public.financing_mechanism not null,
  component_kind public.financial_component_kind not null default 'principal',
  amount numeric(19,2) not null check (amount > 0),
  account_id uuid references public.accounts(id) on delete restrict,
  card_id uuid references public.cards(id) on delete restrict,
  invoice_id uuid references public.card_invoices(id) on delete restrict,
  installment_id uuid references public.installments(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((transaction_id is not null)::integer + (obligation_id is not null)::integer = 1),
  check (mechanism not in ('card_purchase','card_pix') or card_id is not null),
  check (mechanism <> 'account' or account_id is not null)
);
create index financing_allocations_household_target on public.financing_allocations(household_id, transaction_id, obligation_id);

alter table public.recurring_rules add column if not exists amount_mode text not null default 'fixed' check (amount_mode in ('fixed','estimated'));
alter table public.recurring_rules add column if not exists estimated_amount numeric(19,2) check (estimated_amount is null or estimated_amount > 0);
alter table public.recurring_occurrences add column if not exists estimated_amount numeric(19,2) check (estimated_amount is null or estimated_amount > 0);
alter table public.recurring_occurrences add column if not exists confirmed_amount numeric(19,2) check (confirmed_amount is null or confirmed_amount > 0);
alter table public.recurring_occurrences add column if not exists confirmed_at timestamptz;

alter table public.card_invoices add column if not exists minimum_payment_amount numeric(19,2) check (minimum_payment_amount is null or minimum_payment_amount >= 0);
alter table public.card_invoices add column if not exists financed_balance numeric(19,2) not null default 0 check (financed_balance >= 0);
alter table public.installments add column if not exists original_due_date date;
alter table public.installments add column if not exists accelerated_at timestamptz;

comment on table public.financial_parties is 'External counterparties only; no auth profile and no legacy DatabaseStore linkage.';
comment on table public.economic_allocations is 'Economic responsibility, independent of creator, buyer, ownership and funding.';
comment on table public.financial_obligations is 'Canonical future model for receivables, payables and new loans.';
comment on table public.financing_allocations is 'Financing mechanism and components; PIX on card is never an economic category.';
comment on table public.loans is 'LEGACY loan family; preserved, do not use for new contracts.';
comment on table public.loan_installments is 'LEGACY loan schedule; preserved.';
comment on table public.loan_contracts is 'LEGACY second loan family; new loans use financial_obligations.';
comment on table public.loan_payment_schedule is 'LEGACY second loan schedule; preserved.';
