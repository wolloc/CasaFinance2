-- Third-party funding/receivable lifecycle: auditable link between canonical
-- funding evidence, per-commitment receivables, and contribution applications.
-- No historical financial rows are inferred or backfilled here.

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
    or (application_kind = 'receivable_settlement' and receivable_link_id is not null)
  )
);
create index third_party_contribution_applications_event_idx
  on public.third_party_contribution_applications(household_id, contribution_event_id);
create index third_party_contribution_applications_receivable_idx
  on public.third_party_contribution_applications(household_id, receivable_link_id)
  where receivable_link_id is not null;
comment on table public.third_party_contribution_applications is
  'Append-only contribution application. One portion either offsets an unfunded expectation or settles a funded receivable, never both.';

alter table public.third_party_commitment_receivables enable row level security;
alter table public.third_party_contribution_applications enable row level security;
drop policy if exists third_party_commitment_receivables_member_select on public.third_party_commitment_receivables;
create policy third_party_commitment_receivables_member_select
  on public.third_party_commitment_receivables for select to authenticated
  using (public.is_active_household_member(household_id));
drop policy if exists third_party_contribution_applications_member_select on public.third_party_contribution_applications;
create policy third_party_contribution_applications_member_select
  on public.third_party_contribution_applications for select to authenticated
  using (public.is_active_household_member(household_id));
revoke all on public.third_party_commitment_receivables from public, anon;
revoke all on public.third_party_contribution_applications from public, anon;
grant select on public.third_party_commitment_receivables to authenticated;
grant select on public.third_party_contribution_applications to authenticated;

-- A contribution received after the Casa has funded a commitment settles the
-- existing receivable using the same cash movement. Only any residual portion
-- offsets the unfunded expectation. Trigger and RPC run in the same transaction.
create or replace function public.apply_third_party_contribution_to_receivables()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  remaining numeric(19,2) := new.amount;
  item record;
  outstanding numeric(19,2);
  applied numeric(19,2);
  actor uuid := new.created_by_member_id;
begin
  for item in
    select link.id link_id, link.obligation_id, obligation.original_amount
    from public.third_party_commitment_receivables link
    join public.financial_obligations obligation
      on obligation.id=link.obligation_id and obligation.household_id=link.household_id
    where link.household_id=new.household_id
      and link.commitment_key=new.commitment_key
      and link.counterparty_id=new.counterparty_id
      and obligation.kind='receivable'
      and obligation.state in ('open','partially_settled')
    order by obligation.due_date nulls last, obligation.created_at, obligation.id
    for update of obligation
  loop
    exit when remaining<=0;
    select greatest(item.original_amount-coalesce(sum(e.amount) filter (
      where e.kind in ('receipt','payment','cancellation','write_off')),0),0)::numeric(19,2)
      into outstanding
    from public.obligation_events e
    where e.household_id=new.household_id and e.obligation_id=item.obligation_id;

    applied:=least(remaining,coalesce(outstanding,0));
    if applied>0 then
      insert into public.obligation_events(
        household_id,obligation_id,created_by_member_id,kind,amount,
        movement_id,occurred_at,notes
      ) values (
        new.household_id,item.obligation_id,actor,'receipt',applied,
        new.movement_id,new.occurred_at,
        coalesce(new.notes,'Contribuição de terceiro aplicada ao recebível')
      );
      insert into public.third_party_contribution_applications(
        household_id,contribution_event_id,receivable_link_id,application_kind,amount
      ) values (
        new.household_id,new.id,item.link_id,'receivable_settlement',applied
      );
      update public.financial_obligations
      set state=case when coalesce((
            select sum(e.amount) from public.obligation_events e
            where e.household_id=new.household_id and e.obligation_id=item.obligation_id
              and e.kind in ('receipt','payment','cancellation','write_off')
          ),0)>=original_amount then 'settled'::public.obligation_state
          else 'partially_settled'::public.obligation_state end,
          closed_at=case when coalesce((
            select sum(e.amount) from public.obligation_events e
            where e.household_id=new.household_id and e.obligation_id=item.obligation_id
              and e.kind in ('receipt','payment','cancellation','write_off')
          ),0)>=original_amount then new.occurred_at else null end,
          updated_at=now()
      where id=item.obligation_id and household_id=new.household_id;
      remaining:=remaining-applied;
    end if;
  end loop;

  if remaining>0 then
    insert into public.third_party_contribution_applications(
      household_id,contribution_event_id,receivable_link_id,application_kind,amount
    ) values(new.household_id,new.id,null,'pre_funding_offset',remaining);
  end if;
  return new;
end $$;

drop trigger if exists third_party_contribution_apply_receivables
  on public.third_party_contribution_events;
create trigger third_party_contribution_apply_receivables
after insert on public.third_party_contribution_events
for each row execute function public.apply_third_party_contribution_to_receivables();

revoke all on function public.apply_third_party_contribution_to_receivables() from public, anon, authenticated;

-- Expected contribution is reduced only by the portion explicitly applied
-- before funding. Receipts used to settle an existing receivable are not netted
-- against a second forecast.
create or replace view public.financial_third_party_commitment_positions
with (security_invoker=true) as
with contributions as (
  select e.household_id,e.commitment_key,e.counterparty_id,
    coalesce(sum(e.amount),0)::numeric(19,2) received_contribution_amount,
    coalesce(sum(a.amount) filter(where a.application_kind='pre_funding_offset'),0)::numeric(19,2) pre_funding_offset_amount
  from public.third_party_contribution_events e
  left join public.third_party_contribution_applications a
    on a.household_id=e.household_id and a.contribution_event_id=e.id
  group by e.household_id,e.commitment_key,e.counterparty_id
)
select
  r.household_id,r.commitment_key,r.source_type,r.source_id,r.source_transaction_id,
  r.source_installment_id,c.source_invoice_id as invoice_id,
  r.responsible_party_id as counterparty_id,p.name as counterparty_name,
  r.financial_date,r.financial_month,r.commitment_state,
  r.responsibility_amount::numeric(19,2) responsibility_amount,
  r.realized_responsibility_amount::numeric(19,2) funded_responsibility_amount,
  greatest(r.remaining_responsibility_amount-coalesce(x.pre_funding_offset_amount,0),0)::numeric(19,2) expected_contribution_amount,
  c.description,c.due_date,c.economic_date,
  coalesce(x.received_contribution_amount,0)::numeric(19,2) received_contribution_amount
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
  'Expected contribution nets only pre-funding offsets. Post-funding receipts settle linked receivables and do not reduce the same forecast a second time.';
revoke all on public.financial_third_party_commitment_positions from public,anon;
grant select on public.financial_third_party_commitment_positions to authenticated;
