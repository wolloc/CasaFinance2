-- Third-party contributions are real cash movements but not income and not yet
-- receivables. This slice records auditable receipts against canonical commitments
-- and nets them out of expected contributions. It does not create/settle obligations.
create table public.third_party_contribution_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  commitment_key text not null,
  counterparty_id uuid not null references public.financial_parties(id) on delete restrict,
  destination_account_id uuid not null references public.accounts(id) on delete restrict,
  movement_id uuid not null unique references public.money_movements(id) on delete restrict,
  amount numeric(19,2) not null check (amount > 0),
  occurred_at timestamptz not null,
  request_key text not null check (length(trim(request_key)) > 0),
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  unique (household_id, request_key)
);
create index third_party_contribution_commitment_idx
  on public.third_party_contribution_events(household_id, commitment_key, counterparty_id);

alter table public.third_party_contribution_events enable row level security;
drop policy if exists third_party_contribution_events_member_select on public.third_party_contribution_events;
create policy third_party_contribution_events_member_select
  on public.third_party_contribution_events for select to authenticated
  using (public.is_active_household_member(household_id));
revoke all on public.third_party_contribution_events from public, anon;
grant select on public.third_party_contribution_events to authenticated;

create or replace function public.record_third_party_contribution(
  p_household_id uuid,
  p_commitment_key text,
  p_counterparty_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_request_key text,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  existing public.third_party_contribution_events;
  position record;
  movement uuid;
  result uuid;
  received_before numeric(19,2);
begin
  caller:=public.require_active_member(p_household_id);
  if p_amount is null or p_amount<=0 or p_occurred_at is null
     or length(trim(coalesce(p_commitment_key,'')))=0
     or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'invalid third-party contribution command' using errcode='22023'; end if;

  -- Serialize retries and different receipts against the same commitment.
  perform pg_advisory_xact_lock(hashtextextended(
    p_household_id::text||':third-party-contribution-request:'||trim(p_request_key),0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_household_id::text||':third-party-contribution-commitment:'||p_commitment_key||':'||p_counterparty_id::text,0
  ));

  select * into existing from public.third_party_contribution_events
  where household_id=p_household_id and request_key=trim(p_request_key);
  if existing.id is not null then
    if existing.commitment_key<>p_commitment_key
       or existing.counterparty_id<>p_counterparty_id
       or existing.destination_account_id<>p_destination_account_id
       or existing.amount<>p_amount
       or existing.occurred_at<>p_occurred_at
       or existing.notes is distinct from p_notes
    then raise exception 'idempotency key already used with different payload' using errcode='23505'; end if;
    return existing.id;
  end if;

  select c.source_transaction_id into result
  from public.financial_commitment_positions c
  join public.financial_member_commitment_responsibility_positions r
    on r.household_id=c.household_id and r.commitment_key=c.commitment_key
  where c.household_id=p_household_id and c.commitment_key=p_commitment_key
    and r.responsible_party_id=p_counterparty_id
    and c.commitment_state not in ('cancelled','reversed')
    and r.responsibility_amount>0;

  if not found then
    raise exception 'active third-party commitment required' using errcode='23514';
  end if;
  if not exists(select 1 from public.financial_parties
    where id=p_counterparty_id and household_id=p_household_id and deactivated_at is null)
  then raise exception 'active household counterparty required' using errcode='23514'; end if;
  if not exists(select 1 from public.accounts
    where id=p_destination_account_id and household_id=p_household_id and deactivated_at is null)
  then raise exception 'active household destination account required' using errcode='23514'; end if;

  select r.responsibility_amount::numeric(19,2) as remaining_amount into position
  from public.financial_member_commitment_responsibility_positions r
  where r.household_id=p_household_id and r.commitment_key=p_commitment_key
    and r.responsible_party_id=p_counterparty_id;

  select coalesce(sum(e.amount),0)::numeric(19,2) into received_before
  from public.third_party_contribution_events e
  where e.household_id=p_household_id and e.commitment_key=p_commitment_key
    and e.counterparty_id=p_counterparty_id;

  if received_before+p_amount>position.remaining_amount then
    raise exception 'contribution exceeds third-party responsibility remaining' using errcode='23514';
  end if;

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,
    destination_account_id,counterparty_id,related_transaction_id,
    movement_date,competence_date,notes,realized_at
  )
  select p_household_id,caller.id,'third_party_contribution','realized',p_amount,
    'Contribuição recebida de '||party.name, p_destination_account_id,p_counterparty_id,
    c.source_transaction_id,p_occurred_at::date,
    date_trunc('month',p_occurred_at)::date,p_notes,p_occurred_at
  from public.financial_commitment_positions c
  join public.financial_parties party on party.id=p_counterparty_id and party.household_id=p_household_id
  where c.household_id=p_household_id and c.commitment_key=p_commitment_key
  returning id into movement;

  insert into public.third_party_contribution_events(
    household_id,commitment_key,counterparty_id,destination_account_id,movement_id,
    amount,occurred_at,request_key,created_by_member_id,notes
  ) values (
    p_household_id,p_commitment_key,p_counterparty_id,p_destination_account_id,movement,
    p_amount,p_occurred_at,trim(p_request_key),caller.id,p_notes
  ) returning id into result;

  return result;
end $$;

revoke all on function public.record_third_party_contribution(uuid,text,uuid,uuid,numeric,timestamptz,text,text) from public,anon;
grant execute on function public.record_third_party_contribution(uuid,text,uuid,uuid,numeric,timestamptz,text,text) to authenticated;

create or replace view public.financial_third_party_commitment_positions
with (security_invoker=true) as
with contributions as (
  select household_id,commitment_key,counterparty_id,
    coalesce(sum(amount),0)::numeric(19,2) as received_contribution_amount
  from public.third_party_contribution_events
  group by household_id,commitment_key,counterparty_id
)
select
  r.household_id,
  r.commitment_key,
  r.source_type,
  r.source_id,
  r.source_transaction_id,
  r.source_installment_id,
  c.source_invoice_id as invoice_id,
  r.responsible_party_id as counterparty_id,
  p.name as counterparty_name,
  r.financial_date,
  r.financial_month,
  r.commitment_state,
  r.responsibility_amount::numeric(19,2) as responsibility_amount,
  r.realized_responsibility_amount::numeric(19,2) as funded_responsibility_amount,
  greatest(r.remaining_responsibility_amount-coalesce(x.received_contribution_amount,0),0)::numeric(19,2) as expected_contribution_amount,
  c.description,
  c.due_date,
  c.economic_date,
  coalesce(x.received_contribution_amount,0)::numeric(19,2) as received_contribution_amount
from public.financial_member_commitment_responsibility_positions r
join public.financial_commitment_positions c
  on c.household_id=r.household_id and c.commitment_key=r.commitment_key
join public.financial_parties p
  on p.id=r.responsible_party_id and p.household_id=r.household_id and p.deactivated_at is null
left join contributions x
  on x.household_id=r.household_id and x.commitment_key=r.commitment_key
 and x.counterparty_id=r.responsible_party_id
where r.responsible_party_id is not null
  and r.responsibility_amount>0
  and r.remaining_responsibility_amount>0
  and r.commitment_state not in ('cancelled','reversed');

comment on view public.financial_third_party_commitment_positions is
  'Per-commitment third-party responsibility and cash contributions. Contribution receipts are real cash, not income and not proof the household funded the card invoice. Receivable lifecycle remains a separate step.';
revoke all on public.financial_third_party_commitment_positions from public,anon;
grant select on public.financial_third_party_commitment_positions to authenticated;
