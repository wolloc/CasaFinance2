-- Casa Finance canonical ledger (additive migration).
-- Safe to run repeatedly: objects use IF [NOT] EXISTS and enum values are added defensively.
-- Existing rows are intentionally not rewritten or deleted.

create extension if not exists pgcrypto;

do $$ begin create type public.member_role as enum ('owner', 'member', 'viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type public.account_kind as enum ('cash', 'checking', 'savings', 'investment', 'meal_benefit', 'digital_wallet'); exception when duplicate_object then null; end $$;
do $$ begin create type public.category_kind as enum ('expense', 'income'); exception when duplicate_object then null; end $$;
do $$ begin create type public.transaction_kind as enum ('expense', 'income', 'transfer', 'invoice_payment', 'adjustment'); exception when duplicate_object then null; end $$;
do $$ begin create type public.transaction_state as enum ('planned', 'pending', 'paid', 'received', 'cancelled', 'refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_instrument_kind as enum ('account', 'card'); exception when duplicate_object then null; end $$;
do $$ begin create type public.invoice_state as enum ('open', 'closed', 'paid', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.occurrence_state as enum ('planned', 'pending', 'paid', 'received', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.installment_state as enum ('planned', 'pending', 'paid', 'cancelled', 'refunded'); exception when duplicate_object then null; end $$;
do $$ begin create type public.loan_state as enum ('active', 'paid', 'cancelled', 'defaulted'); exception when duplicate_object then null; end $$;
do $$ begin create type public.settlement_state as enum ('planned', 'pending', 'paid', 'cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.import_state as enum ('uploaded', 'processing', 'review', 'completed', 'failed', 'cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency char(3) not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  pix_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique (household_id, profile_id)
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_member_id uuid references public.household_members(id) on delete restrict,
  name text not null,
  type public.account_kind not null,
  institution text,
  opening_balance numeric(19,2) not null default 0,
  opened_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz
);

-- Upgrade columns are additive for installations that already have Sprint 2 tables.
alter table public.accounts add column if not exists owner_member_id uuid references public.household_members(id) on delete restrict;
alter table public.accounts add column if not exists type public.account_kind;
alter table public.accounts add column if not exists opening_balance numeric(19,2) not null default 0;
alter table public.accounts add column if not exists opened_at date;
alter table public.accounts add column if not exists deactivated_at timestamptz;

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_member_id uuid not null references public.household_members(id) on delete restrict,
  name text not null,
  institution text,
  last_four char(4),
  credit_limit numeric(19,2) not null default 0 check (credit_limit >= 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  default_payment_account_id uuid references public.accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz
);
alter table public.cards add column if not exists owner_member_id uuid references public.household_members(id) on delete restrict;
alter table public.cards add column if not exists last_four char(4);
alter table public.cards add column if not exists deactivated_at timestamptz;

create table if not exists public.card_invoices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete restrict,
  competence_date date not null check (competence_date = date_trunc('month', competence_date)::date),
  closing_date date not null,
  due_date date not null,
  status public.invoice_state not null default 'open',
  total_amount numeric(19,2) not null default 0 check (total_amount >= 0),
  settled_amount numeric(19,2) not null default 0 check (settled_amount >= 0 and settled_amount <= total_amount),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, competence_date)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null,
  type public.category_kind not null,
  icon text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique (household_id, type, name)
);
alter table public.categories add column if not exists deactivated_at timestamptz;
alter table public.categories add column if not exists updated_at timestamptz not null default now();

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  buyer_member_id uuid references public.household_members(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  invoice_id uuid references public.card_invoices(id) on delete restrict,
  type public.transaction_kind not null,
  status public.transaction_state not null default 'pending',
  description text not null,
  merchant text,
  amount numeric(19,2) not null check (amount > 0),
  transaction_date date not null,
  competence_date date not null,
  due_date date,
  settled_at timestamptz,
  notes text,
  refunded_transaction_id uuid references public.transactions(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((status in ('paid', 'received')) = (settled_at is not null)),
  check ((type = 'expense' and status <> 'received') or (type = 'income' and status <> 'paid') or type not in ('expense', 'income'))
);
alter table public.transactions add column if not exists created_by_member_id uuid references public.household_members(id) on delete restrict;
alter table public.transactions add column if not exists buyer_member_id uuid references public.household_members(id) on delete restrict;
alter table public.transactions add column if not exists invoice_id uuid references public.card_invoices(id) on delete restrict;
alter table public.transactions add column if not exists type public.transaction_kind;
alter table public.transactions add column if not exists amount numeric(19,2);
alter table public.transactions add column if not exists competence_date date;
alter table public.transactions add column if not exists due_date date;
alter table public.transactions add column if not exists settled_at timestamptz;
alter table public.transactions add column if not exists refunded_transaction_id uuid references public.transactions(id) on delete restrict;
alter table public.transactions add column if not exists deleted_at timestamptz;

-- Explicit instrument: owner does not imply buyer, funder, or economic responsibility.
create table if not exists public.transaction_payment_instruments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  kind public.payment_instrument_kind not null,
  account_id uuid references public.accounts(id) on delete restrict,
  card_id uuid references public.cards(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((kind = 'account' and account_id is not null and card_id is null) or
         (kind = 'card' and card_id is not null and account_id is null))
);

create table if not exists public.transaction_splits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  responsible_member_id uuid not null references public.household_members(id) on delete restrict,
  percentage numeric(7,4) not null check (percentage > 0 and percentage <= 100),
  amount numeric(19,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (transaction_id, responsible_member_id)
);
alter table public.transaction_splits add column if not exists household_id uuid references public.households(id) on delete cascade;
alter table public.transaction_splits add column if not exists responsible_member_id uuid references public.household_members(id) on delete restrict;
alter table public.transaction_splits add column if not exists percentage numeric(7,4);
alter table public.transaction_splits add column if not exists amount numeric(19,2);

-- Cash financing exists only after settlement; card purchases receive financing at invoice payment.
create table if not exists public.funding_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  financed_transaction_id uuid not null references public.transactions(id) on delete restrict,
  funding_transaction_id uuid not null references public.transactions(id) on delete restrict,
  funder_member_id uuid not null references public.household_members(id) on delete restrict,
  source_account_id uuid not null references public.accounts(id) on delete restrict,
  amount numeric(19,2) not null check (amount > 0),
  funded_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (financed_transaction_id, funding_transaction_id, funder_member_id)
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_id uuid not null unique references public.transactions(id) on delete restrict,
  source_account_id uuid not null references public.accounts(id) on delete restrict,
  destination_account_id uuid not null references public.accounts(id) on delete restrict,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  check (source_account_id <> destination_account_id)
);

create table if not exists public.card_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invoice_id uuid not null references public.card_invoices(id) on delete restrict,
  payment_transaction_id uuid not null unique references public.transactions(id) on delete restrict,
  source_account_id uuid not null references public.accounts(id) on delete restrict,
  amount numeric(19,2) not null check (amount > 0),
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  template_transaction_id uuid references public.transactions(id) on delete restrict,
  frequency text not null check (frequency in ('weekly','monthly','yearly')),
  interval_count integer not null default 1 check (interval_count > 0), start_date date not null, end_date date,
  next_occurrence_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deactivated_at timestamptz,
  check (end_date is null or end_date >= start_date)
);
create table if not exists public.recurring_occurrences (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  recurring_rule_id uuid not null references public.recurring_rules(id) on delete cascade,
  transaction_id uuid unique references public.transactions(id) on delete restrict,
  competence_date date not null, due_date date, status public.occurrence_state not null default 'planned', settled_at timestamptz,
  created_at timestamptz not null default now(), unique (recurring_rule_id, competence_date)
);

create table if not exists public.installment_plans (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  purchase_transaction_id uuid not null unique references public.transactions(id) on delete restrict,
  installment_count integer not null check (installment_count > 1), total_amount numeric(19,2) not null check (total_amount > 0),
  created_at timestamptz not null default now()
);
create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  installment_plan_id uuid not null references public.installment_plans(id) on delete cascade,
  invoice_id uuid references public.card_invoices(id) on delete restrict, number integer not null check (number > 0),
  amount numeric(19,2) not null check (amount > 0), competence_date date not null, due_date date,
  status public.installment_state not null default 'planned', settled_at timestamptz, created_at timestamptz not null default now(),
  unique (installment_plan_id, number)
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  borrower_member_id uuid not null references public.household_members(id) on delete restrict, lender_name text not null,
  principal_amount numeric(19,2) not null check (principal_amount > 0), annual_interest_rate numeric(9,6) not null default 0 check (annual_interest_rate >= 0),
  contracted_at date not null, status public.loan_state not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.loan_installments (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade, transaction_id uuid unique references public.transactions(id) on delete restrict,
  number integer not null check (number > 0), principal_amount numeric(19,2) not null check (principal_amount >= 0),
  interest_amount numeric(19,2) not null check (interest_amount >= 0), due_date date not null, paid_at timestamptz,
  status public.installment_state not null default 'planned', created_at timestamptz not null default now(), unique (loan_id, number)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  debtor_member_id uuid not null references public.household_members(id) on delete restrict,
  creditor_member_id uuid not null references public.household_members(id) on delete restrict,
  payment_transaction_id uuid unique references public.transactions(id) on delete restrict,
  competence_date date not null, due_date date, amount numeric(19,2) not null check (amount > 0),
  status public.settlement_state not null default 'planned', settled_at timestamptz, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (debtor_member_id <> creditor_member_id)
);
alter table public.settlements add column if not exists debtor_member_id uuid references public.household_members(id) on delete restrict;
alter table public.settlements add column if not exists creditor_member_id uuid references public.household_members(id) on delete restrict;
alter table public.settlements add column if not exists payment_transaction_id uuid references public.transactions(id) on delete restrict;
alter table public.settlements add column if not exists competence_date date;
alter table public.settlements add column if not exists due_date date;
alter table public.settlements add column if not exists amount numeric(19,2);
alter table public.settlements add column if not exists settled_at timestamptz;
alter table public.settlements add column if not exists updated_at timestamptz not null default now();

create table if not exists public.document_imports (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  uploaded_by_member_id uuid not null references public.household_members(id) on delete restrict,
  storage_path text not null, mime_type text not null, sha256 char(64) not null, provider text not null default 'gemini',
  status public.import_state not null default 'uploaded', extracted_data jsonb, error_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
  unique (household_id, sha256)
);
alter table public.document_imports add column if not exists uploaded_by_member_id uuid references public.household_members(id) on delete restrict;
alter table public.document_imports add column if not exists storage_path text;
alter table public.document_imports add column if not exists mime_type text;
alter table public.document_imports add column if not exists sha256 char(64);
alter table public.document_imports add column if not exists provider text not null default 'gemini';
alter table public.document_imports add column if not exists extracted_data jsonb;
alter table public.document_imports add column if not exists error_code text;
alter table public.document_imports add column if not exists updated_at timestamptz not null default now();
alter table public.document_imports add column if not exists completed_at timestamptz;
create table if not exists public.merchant_category_rules (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  merchant_pattern text not null, category_id uuid not null references public.categories(id) on delete restrict,
  priority integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deactivated_at timestamptz,
  unique (household_id, merchant_pattern)
);
alter table public.merchant_category_rules add column if not exists priority integer not null default 0;
alter table public.merchant_category_rules add column if not exists deactivated_at timestamptz;
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  actor_member_id uuid references public.household_members(id) on delete set null, action text not null, entity_type text not null,
  entity_id uuid, old_values jsonb, new_values jsonb, request_id uuid, occurred_at timestamptz not null default now()
);

-- A deferred constraint trigger permits replacing all splits in one transaction.
create or replace function public.assert_transaction_splits_total() returns trigger language plpgsql as $$
declare target_id uuid; split_total numeric; transaction_total numeric;
begin
  target_id := coalesce(new.transaction_id, old.transaction_id);
  if exists (select 1 from public.transactions where id = target_id and deleted_at is null) then
    select coalesce(sum(percentage), 0), coalesce(sum(amount), 0) into split_total, transaction_total
    from public.transaction_splits where transaction_id = target_id;
    if split_total <> 100 then raise exception 'transaction % splits must total 100%% (got %)', target_id, split_total; end if;
    if transaction_total <> (select amount from public.transactions where id = target_id) then
      raise exception 'transaction % split amounts must equal transaction amount', target_id;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists transaction_splits_total on public.transaction_splits;
create constraint trigger transaction_splits_total after insert or update or delete on public.transaction_splits
deferrable initially deferred for each row execute function public.assert_transaction_splits_total();

-- Household/competence/status access paths used by dashboard and reconciliation.
create index if not exists idx_members_household on public.household_members(household_id) where deactivated_at is null;
create index if not exists idx_accounts_household_active on public.accounts(household_id) where deactivated_at is null;
create index if not exists idx_cards_household_active on public.cards(household_id) where deactivated_at is null;
create index if not exists idx_categories_household_type on public.categories(household_id, type) where deactivated_at is null;
create index if not exists idx_transactions_household_competence_status on public.transactions(household_id, competence_date, status) where deleted_at is null;
create index if not exists idx_transactions_invoice on public.transactions(invoice_id) where invoice_id is not null;
create index if not exists idx_invoices_household_competence_status on public.card_invoices(household_id, competence_date, status);
create index if not exists idx_funding_household_date on public.funding_events(household_id, funded_at);
create index if not exists idx_recurring_occurrences_lookup on public.recurring_occurrences(household_id, competence_date, status);
create index if not exists idx_installments_lookup on public.installments(household_id, competence_date, status);
create index if not exists idx_loans_household_status on public.loans(household_id, status);
create index if not exists idx_settlements_lookup on public.settlements(household_id, competence_date, status);
create index if not exists idx_imports_household_status on public.document_imports(household_id, status);
create index if not exists idx_audit_household_occurred on public.audit_logs(household_id, occurred_at desc);

comment on table public.funding_events is 'Actual own-resource funding. Created only when cash leaves an account; card purchases are linked when their invoice payment settles.';
comment on table public.transaction_splits is 'Economic responsibility, independent from buyer, payment instrument owner, and effective funder.';
comment on column public.transactions.buyer_member_id is 'Member who originated/performed the purchase; not necessarily instrument owner, funder, or economically responsible member.';
