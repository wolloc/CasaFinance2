-- Third-party receivable lifecycle: materialize only funded responsibility,
-- then consume contributions received before funding against the funded tranche.
-- This migration is additive and does not backfill historical finance records.

alter table public.third_party_contribution_applications
  drop constraint if exists third_party_contribution_applications_application_kind_check;
alter table public.third_party_contribution_applications
  add constraint third_party_contribution_applications_application_kind_check
  check (application_kind in ('pre_funding_offset','receivable_settlement','pre_funding_consumption'));
alter table public.third_party_contribution_applications
  drop constraint if exists third_party_contribution_applications_check;
alter table public.third_party_contribution_applications
  add constraint third_party_contribution_applications_check
  check (
    (application_kind='pre_funding_offset' and receivable_link_id is null)
    or (application_kind in ('receivable_settlement','pre_funding_consumption') and receivable_link_id is not null)
  );

create or replace function public.materialize_third_party_receivables_from_funding()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  commitment record;
  allocation record;
  receivable_id uuid;
  link_id uuid;
  receivable_amount numeric(19,2);
  remaining numeric(19,2);
  contribution record;
  available_offset numeric(19,2);
  applied numeric(19,2);
  actor_id uuid := new.funder_member_id;
begin
  -- Funding evidence is the only entry point. Serialize work for this exact
  -- commitment so concurrent partial funding/contributions cannot consume an
  -- offset twice.
  select c.* into commitment
  from public.financial_commitment_positions c
  where c.household_id=new.household_id
    and c.source_transaction_id=new.financed_transaction_id
    and c.source_installment_id is not distinct from new.installment_id
  order by c.commitment_key
  limit 1;

  if not found then return new; end if;

  for allocation in
    select ea.responsible_party_id, ea.percentage, p.name
    from public.economic_allocations ea
    join public.financial_parties p
      on p.id=ea.responsible_party_id
     and p.household_id=ea.household_id
     and p.deactivated_at is null
    where ea.household_id=new.household_id
      and ea.transaction_id=new.financed_transaction_id
      and ea.responsible_party_id is not null
    order by ea.allocation_order
  loop
    -- Use the same lock key as record_third_party_contribution so a receipt
    -- and invoice funding for this counterparty/commitment serialize together.
    perform pg_advisory_xact_lock(hashtextextended(
      new.household_id::text||':third-party-contribution-commitment:'||
      commitment.commitment_key||':'||allocation.responsible_party_id::text,0
    ));

    receivable_amount := round(new.amount * allocation.percentage / 100, 2);
    if receivable_amount <= 0 then continue; end if;

    -- Idempotent even if a funding-event retry reaches this trigger.
    if exists (
      select 1 from public.third_party_commitment_receivables x
      where x.household_id=new.household_id
        and x.commitment_key=commitment.commitment_key
        and x.counterparty_id=allocation.responsible_party_id
        and x.funding_event_id=new.id
    ) then
      continue;
    end if;

    insert into public.financial_obligations(
      household_id,created_by_member_id,kind,origin_kind,counterparty_id,
      source_transaction_id,invoice_id,original_amount,obligation_date,due_date,
      state,description,notes
    ) values (
      new.household_id,actor_id,'receivable','shared_expense',
      allocation.responsible_party_id,new.financed_transaction_id,new.invoice_id,
      receivable_amount,new.funded_at::date,commitment.due_date,'open',
      'Valor financiado pela Casa — ' || commitment.description,
      'Gerado a partir do funding_event ' || new.id::text
    ) returning id into receivable_id;

    insert into public.third_party_commitment_receivables(
      household_id,commitment_key,counterparty_id,funding_event_id,
      obligation_id,funded_responsibility_amount
    ) values (
      new.household_id,commitment.commitment_key,allocation.responsible_party_id,
      new.id,receivable_id,receivable_amount
    ) returning id into link_id;

    remaining := receivable_amount;

    -- Apply previously received contributions, oldest first. The original
    -- pre_funding_offset stays as history; consumption is a separate ledger row.
    for contribution in
      select e.id,e.movement_id,e.created_by_member_id,e.occurred_at,e.notes,
        greatest(
          coalesce(sum(a.amount) filter(where a.application_kind='pre_funding_offset'),0)
          - coalesce(sum(a.amount) filter(where a.application_kind='pre_funding_consumption'),0),
          0
        )::numeric(19,2) available
      from public.third_party_contribution_events e
      left join public.third_party_contribution_applications a
        on a.household_id=e.household_id and a.contribution_event_id=e.id
      where e.household_id=new.household_id
        and e.commitment_key=commitment.commitment_key
        and e.counterparty_id=allocation.responsible_party_id
      group by e.id,e.movement_id,e.created_by_member_id,e.occurred_at,e.notes
      having greatest(
          coalesce(sum(a.amount) filter(where a.application_kind='pre_funding_offset'),0)
          - coalesce(sum(a.amount) filter(where a.application_kind='pre_funding_consumption'),0),
          0
        ) > 0
      order by e.occurred_at,e.id
    loop
      exit when remaining <= 0;
      available_offset := contribution.available;
      applied := least(remaining,available_offset);
      if applied <= 0 then continue; end if;

      insert into public.obligation_events(
        household_id,obligation_id,created_by_member_id,kind,amount,
        movement_id,occurred_at,notes
      ) values (
        new.household_id,receivable_id,contribution.created_by_member_id,
        'receipt',applied,contribution.movement_id,contribution.occurred_at,
        coalesce(contribution.notes,'Contribuição anterior ao financiamento')
      );

      insert into public.third_party_contribution_applications(
        household_id,contribution_event_id,receivable_link_id,application_kind,amount
      ) values (
        new.household_id,contribution.id,link_id,'pre_funding_consumption',applied
      );

      remaining := remaining - applied;
    end loop;

    if remaining < receivable_amount then
      update public.financial_obligations
      set state=case when remaining=0 then 'settled'::public.obligation_state
                     else 'partially_settled'::public.obligation_state end,
          closed_at=case when remaining=0 then new.funded_at else null end,
          updated_at=now()
      where id=receivable_id and household_id=new.household_id;
    end if;
  end loop;

  return new;
end $$;

drop trigger if exists funding_events_materialize_third_party_receivables on public.funding_events;
create trigger funding_events_materialize_third_party_receivables
after insert on public.funding_events
for each row execute function public.materialize_third_party_receivables_from_funding();
revoke all on function public.materialize_third_party_receivables_from_funding() from public,anon,authenticated;

-- A pre-funding contribution reduces the forecast only until it is consumed by
-- a funded receivable. Settlement after funding never reduces forecast twice.
create or replace view public.financial_third_party_commitment_positions
with (security_invoker=true) as
with contribution_totals as (
  select e.household_id,e.commitment_key,e.counterparty_id,
    coalesce(sum(e.amount),0)::numeric(19,2) received_contribution_amount
  from public.third_party_contribution_events e
  group by e.household_id,e.commitment_key,e.counterparty_id
), application_totals as (
  select e.household_id,e.commitment_key,e.counterparty_id,
    coalesce(sum(a.amount) filter(where a.application_kind='pre_funding_offset'),0)::numeric(19,2)
      - coalesce(sum(a.amount) filter(where a.application_kind='pre_funding_consumption'),0)::numeric(19,2)
      pre_funding_offset_amount
  from public.third_party_contribution_events e
  join public.third_party_contribution_applications a
    on a.household_id=e.household_id and a.contribution_event_id=e.id
  group by e.household_id,e.commitment_key,e.counterparty_id
), contributions as (
  select t.household_id,t.commitment_key,t.counterparty_id,
    t.received_contribution_amount,
    greatest(coalesce(a.pre_funding_offset_amount,0),0)::numeric(19,2) pre_funding_offset_amount
  from contribution_totals t
  left join application_totals a
    on a.household_id=t.household_id and a.commitment_key=t.commitment_key
   and a.counterparty_id=t.counterparty_id
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
  'Expected contribution nets only unconsumed pre-funding offsets. Post-funding receipts settle linked receivables without reducing forecast twice.';
revoke all on public.financial_third_party_commitment_positions from public,anon;
grant select on public.financial_third_party_commitment_positions to authenticated;
