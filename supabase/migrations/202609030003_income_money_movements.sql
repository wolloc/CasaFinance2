-- Entradas alinhadas ao ledger: receitas, circulação interna e contratos de empréstimo.
do $$ begin
  create type public.money_movement_kind as enum ('income', 'transfer', 'investment_deposit', 'investment_withdrawal', 'invoice_payment', 'loan_disbursement');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.money_movement_state as enum ('projected', 'realized');
exception when duplicate_object then null; end $$;

create table if not exists public.money_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  kind public.money_movement_kind not null,
  state public.money_movement_state not null,
  amount numeric(19,2) not null check (amount > 0),
  description text not null check (length(trim(description)) > 0),
  beneficiary_member_id uuid references public.household_members(id) on delete restrict,
  source_account_id uuid references public.accounts(id) on delete restrict,
  destination_account_id uuid references public.accounts(id) on delete restrict,
  category_id uuid references public.categories(id) on delete restrict,
  invoice_id uuid references public.card_invoices(id) on delete restrict,
  movement_date date not null,
  competence_date date not null check (competence_date = date_trunc('month', competence_date)::date),
  notes text,
  realized_at timestamptz,
  created_at timestamptz not null default now(),
  check ((state = 'realized') = (realized_at is not null)),
  check (kind <> 'transfer' or (source_account_id is not null and destination_account_id is not null and source_account_id <> destination_account_id)),
  check (kind <> 'invoice_payment' or (source_account_id is not null and invoice_id is not null)),
  check (kind <> 'income' or (beneficiary_member_id is not null and destination_account_id is not null and category_id is not null))
);

create table if not exists public.loan_contracts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  disbursement_movement_id uuid not null unique references public.money_movements(id) on delete restrict,
  lender text not null check (length(trim(lender)) > 0),
  principal numeric(19,2) not null check (principal > 0),
  installment_count integer not null check (installment_count > 0),
  first_due_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.loan_payment_schedule (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  loan_contract_id uuid not null references public.loan_contracts(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  amount numeric(19,2) not null check (amount > 0),
  state public.money_movement_state not null default 'projected',
  paid_movement_id uuid references public.money_movements(id) on delete restrict,
  unique (loan_contract_id, installment_number)
);

create index if not exists idx_money_movements_household_date on public.money_movements(household_id, movement_date desc);
create index if not exists idx_loan_schedule_due on public.loan_payment_schedule(household_id, due_date) where state = 'projected';

alter table public.money_movements enable row level security;
alter table public.loan_contracts enable row level security;
alter table public.loan_payment_schedule enable row level security;
