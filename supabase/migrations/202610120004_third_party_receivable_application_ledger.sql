-- Third-party funding/receivable lifecycle: auditable link between canonical
-- funding evidence, per-commitment receivables, and contribution applications.
-- This migration is additive only. RPC integration follows in a separate slice;
-- no historical financial rows are inferred or backfilled here.

create table public.third_party_commitment_receivables (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  commitment_key text not null,
  counterparty_id uuid not null references public.financial_parties(id) on delete restrict,
  funding_event_id uuid not null references public.funding_events(id) on delete restrict,
  obligation_id uuid not null unique references public.financial_obligations(id) on delete restrict,
  funded_responsibility_amount numeric(19,2) not null check (funded_responsibility_amount > 0),
  created_at timestamptz not null default now(),
  unique (household_id, commitment_key, counterparty_id, funding_event_id),
  unique (household_id, obligation_id)
);

create index third_party_commitment_receivables_source_idx
  on public.third_party_commitment_receivables(household_id, commitment_key, counterparty_id);

comment on table public.third_party_commitment_receivables is
  'Maps a third-party receivable tranche to canonical funding_events and a single financial_obligation. No receivable is valid without real funding evidence.';

create table public.third_party_contribution_applications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  contribution_event_id uuid not null references public.third_party_contribution_events(id) on delete restrict,
  receivable_link_id uuid references public.third_party_commitment_receivables(id) on delete restrict,
  application_kind text not null check (application_kind in ('pre_funding_offset','receivable_settlement')),
  amount numeric(19,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  check (
    (application_kind = 'pre_funding_offset' and receivable_link_id is null)
    or
    (application_kind = 'receivable_settlement' and receivable_link_id is not null)
  )
);

create index third_party_contribution_applications_event_idx
  on public.third_party_contribution_applications(household_id, contribution_event_id);
create index third_party_contribution_applications_receivable_idx
  on public.third_party_contribution_applications(household_id, receivable_link_id)
  where receivable_link_id is not null;

comment on table public.third_party_contribution_applications is
  'Append-only allocation of a real contribution: either offsets an unfunded expected contribution once, or settles an already-created receivable. The same amount must never be applied to both.';

alter table public.third_party_commitment_receivables enable row level security;
alter table public.third_party_contribution_applications enable row level security;

drop policy if exists third_party_commitment_receivables_member_select
  on public.third_party_commitment_receivables;
create policy third_party_commitment_receivables_member_select
  on public.third_party_commitment_receivables for select to authenticated
  using (public.is_active_household_member(household_id));

drop policy if exists third_party_contribution_applications_member_select
  on public.third_party_contribution_applications;
create policy third_party_contribution_applications_member_select
  on public.third_party_contribution_applications for select to authenticated
  using (public.is_active_household_member(household_id));

revoke all on public.third_party_commitment_receivables from public, anon;
revoke all on public.third_party_contribution_applications from public, anon;
grant select on public.third_party_commitment_receivables to authenticated;
grant select on public.third_party_contribution_applications to authenticated;
