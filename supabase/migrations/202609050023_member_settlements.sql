-- Etapa 10H.5: ledger canonico e continuo de acertos entre membros.
-- Forward-only: migrations 001-022 permanecem imutaveis.

do $$ begin
  create type public.member_settlement_state as enum ('projected','realized','cancelled','reversed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.member_settlement_kind as enum ('responsibility_funding','explicit_settlement','adjustment','correction');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.member_settlement_schedule_state as enum ('scheduled','realized','cancelled');
exception when duplicate_object then null; end $$;

alter type public.money_movement_kind add value if not exists 'member_settlement';

create table public.member_settlement_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  debtor_member_id uuid not null references public.household_members(id) on delete restrict,
  creditor_member_id uuid not null references public.household_members(id) on delete restrict,
  amount numeric(19,2) not null check (amount > 0),
  state public.member_settlement_state not null,
  kind public.member_settlement_kind not null,
  financial_date date not null,
  occurred_at timestamptz,
  source_transaction_id uuid references public.transactions(id) on delete restrict,
  source_installment_id uuid references public.installments(id) on delete restrict,
  source_funding_event_id uuid references public.funding_events(id) on delete restrict,
  source_money_movement_id uuid references public.money_movements(id) on delete restrict,
  reverses_event_id uuid references public.member_settlement_events(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (debtor_member_id <> creditor_member_id),
  check (state <> 'realized' or occurred_at is not null),
  check (state <> 'projected' or occurred_at is null),
  check (state <> 'realized' or num_nonnulls(source_transaction_id,source_money_movement_id,reverses_event_id) > 0),
  check (kind <> 'responsibility_funding' or source_transaction_id is not null),
  check (kind <> 'explicit_settlement' or source_money_movement_id is not null),
  check (kind <> 'correction' or reverses_event_id is not null)
);

-- One stable economic commitment has one row. Invoice funding updates this row
-- instead of inserting a second debt. A funding source can likewise contribute
-- at most one directed effect.
create unique index member_settlement_installment_origin_unique
  on public.member_settlement_events(source_installment_id,debtor_member_id,creditor_member_id)
  where source_installment_id is not null and kind='responsibility_funding';
create unique index member_settlement_funding_origin_unique
  on public.member_settlement_events(source_funding_event_id,debtor_member_id,creditor_member_id)
  where source_funding_event_id is not null;
create unique index member_settlement_movement_origin_unique
  on public.member_settlement_events(source_money_movement_id)
  where source_money_movement_id is not null;
create index member_settlement_events_position
  on public.member_settlement_events(household_id,debtor_member_id,creditor_member_id,state,kind);

create table public.member_settlement_schedules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  payer_member_id uuid not null references public.household_members(id) on delete restrict,
  receiver_member_id uuid not null references public.household_members(id) on delete restrict,
  amount numeric(19,2) not null check (amount > 0),
  due_date date not null,
  state public.member_settlement_schedule_state not null default 'scheduled',
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  settlement_event_id uuid references public.member_settlement_events(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (payer_member_id <> receiver_member_id),
  check ((state='cancelled') = (cancelled_at is not null)),
  check ((state='realized') = (settlement_event_id is not null)),
  unique (household_id,idempotency_key)
);
create index member_settlement_schedules_due
  on public.member_settlement_schedules(household_id,due_date) where state='scheduled';

create or replace function public.assert_member_settlement_links()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare h uuid:=new.household_id;
begin
  if not exists(select 1 from public.household_members where id=new.created_by_member_id and household_id=h and deactivated_at is null) then raise exception 'settlement creator must be active in household' using errcode='23514'; end if;
  if tg_table_name='member_settlement_events' then
    if not exists(select 1 from public.household_members where id=new.debtor_member_id and household_id=h and deactivated_at is null)
       or not exists(select 1 from public.household_members where id=new.creditor_member_id and household_id=h and deactivated_at is null) then raise exception 'settlement members must be active in household' using errcode='23514'; end if;
    if new.source_transaction_id is not null and not exists(select 1 from public.transactions where id=new.source_transaction_id and household_id=h and deleted_at is null) then raise exception 'settlement transaction belongs to another household' using errcode='23514'; end if;
    if new.source_installment_id is not null and not exists(select 1 from public.installments where id=new.source_installment_id and household_id=h) then raise exception 'settlement installment belongs to another household' using errcode='23514'; end if;
    if new.source_funding_event_id is not null and not exists(select 1 from public.funding_events where id=new.source_funding_event_id and household_id=h) then raise exception 'settlement funding belongs to another household' using errcode='23514'; end if;
    if new.source_money_movement_id is not null and not exists(select 1 from public.money_movements where id=new.source_money_movement_id and household_id=h and kind='member_settlement') then raise exception 'settlement movement belongs to another household or is not a settlement' using errcode='23514'; end if;
  else
    if not exists(select 1 from public.household_members where id=new.payer_member_id and household_id=h and deactivated_at is null)
       or not exists(select 1 from public.household_members where id=new.receiver_member_id and household_id=h and deactivated_at is null) then raise exception 'schedule members must be active in household' using errcode='23514'; end if;
  end if;
  return new;
end $$;
revoke all on function public.assert_member_settlement_links() from public,anon,authenticated;
create trigger member_settlement_event_links before insert or update on public.member_settlement_events for each row execute function public.assert_member_settlement_links();
create trigger member_settlement_schedule_links before insert or update on public.member_settlement_schedules for each row execute function public.assert_member_settlement_links();

-- Internal deterministic reconciliation. Responsibility always comes from
-- economic_allocations. Funding comes from funding_events/account ownership;
-- card projections use the explicit card owner and the installment schedule.
create or replace function public.reconcile_member_settlements(p_transaction_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare tx public.transactions; creator uuid; card_owner uuid; ins record; fe record; debtor uuid; creditor uuid; effect numeric; tx_total numeric; funded_total numeric;
begin
  select * into tx from public.transactions where id=p_transaction_id and deleted_at is null;
  if tx.id is null or tx.type<>'expense' or tx.economic_state in ('cancelled','reversed') then return; end if;
  creator:=tx.created_by_member_id; tx_total:=public.financial_effective_total_amount(tx.economic_state,tx.estimated_amount,tx.confirmed_amount,tx.realized_amount,tx.amount);
  if tx_total<=0 then return; end if;

  -- Project each card installment against the card owner. Every member allocation
  -- participates in the balance calculation; buyer and third-party allocations
  -- are deliberately absent. Third-party positions belong to their own ledger.
  select c.owner_member_id into card_owner from public.transaction_payment_instruments pi join public.cards c on c.id=pi.card_id and c.household_id=tx.household_id where pi.transaction_id=tx.id and pi.kind='card';
  if card_owner is not null then
    for ins in select i.* from public.installments i join public.installment_plans p on p.id=i.installment_plan_id where p.purchase_transaction_id=tx.id loop
      with balances as (
        select m.id member_id,
          (case when m.id=card_owner then ins.amount else 0 end)-coalesce(sum(a.amount)*ins.amount/tx_total,0) balance
        from public.household_members m
        left join public.economic_allocations a on a.transaction_id=tx.id and a.responsible_member_id=m.id
        where m.household_id=tx.household_id and m.deactivated_at is null
        group by m.id
      )
      select (array_agg(member_id order by balance,member_id) filter(where balance<0))[1],
             (array_agg(member_id order by balance desc,member_id) filter(where balance>0))[1],
             round(least(abs(min(balance) filter(where balance<0)),max(balance) filter(where balance>0)),2)
        into debtor,creditor,effect from balances;
      if debtor is not null and effect>0 then
        update public.member_settlement_events set state='cancelled',updated_at=now()
         where source_installment_id=ins.id and kind='responsibility_funding' and state='projected'
           and (debtor_member_id<>debtor or creditor_member_id<>creditor);
        insert into public.member_settlement_events(household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,source_transaction_id,source_installment_id)
        values(tx.household_id,creator,debtor,creditor,effect,'projected','responsibility_funding',coalesce(ins.due_date,ins.competence_date),tx.id,ins.id)
        on conflict (source_installment_id,debtor_member_id,creditor_member_id) where source_installment_id is not null and kind='responsibility_funding'
        do update set amount=excluded.amount,state='projected',financial_date=excluded.financial_date,updated_at=now()
        where member_settlement_events.state in ('projected','cancelled')
          and member_settlement_events.occurred_at is null
          and member_settlement_events.source_funding_event_id is null;
      else
        update public.member_settlement_events set state='cancelled',updated_at=now()
         where source_installment_id=ins.id and kind='responsibility_funding' and state='projected';
      end if;
    end loop;
  end if;

  -- Real funding normally belongs to funding_events.funder_member_id, regardless
  -- of account ownership. The only exception is the explicit joint-liquidity
  -- convention: exactly two active account owners split that funding 50/50.
  -- This attribution never writes or changes economic responsibility.
  for fe in select f.* from public.funding_events f where f.financed_transaction_id=tx.id loop
    funded_total:=fe.amount;
    if not exists(select 1 from public.household_members where id=fe.funder_member_id and household_id=tx.household_id and deactivated_at is null)
       or not exists(select 1 from public.accounts where id=fe.source_account_id and household_id=tx.household_id and deactivated_at is null) then
      raise exception 'funding member and source account must be active in household' using errcode='23514';
    end if;

    if fe.installment_id is not null then
      select i.amount,coalesce(sum(f.amount),0) into effect,funded_total
        from public.installments i left join public.funding_events f on f.installment_id=i.id
       where i.id=fe.installment_id group by i.amount;
      -- Conservative partial-card rule for 023: keep the single obligation
      -- projected until its installment is fully funded. Never mark the whole
      -- projected amount realized after only a partial invoice payment.
      if funded_total<effect then continue; end if;
      if fe.id<>(select f.id from public.funding_events f where f.installment_id=fe.installment_id order by f.created_at desc,f.id desc fetch first 1 row only) then continue; end if;
    end if;

    with funding_sources as (
      select f.* from public.funding_events f
       where (fe.installment_id is null and f.id=fe.id)
          or (fe.installment_id is not null and f.installment_id=fe.installment_id)
    ), owner_counts as (
      select fs.id funding_id,count(om.id) owner_count
        from funding_sources fs
        left join public.account_ownerships ao on ao.account_id=fs.source_account_id and ao.household_id=tx.household_id
        left join public.household_members om on om.id=ao.member_id and om.household_id=tx.household_id and om.deactivated_at is null
       group by fs.id
    ), funders as (
      select ao.member_id,sum(fs.amount/2) funding_amount
        from funding_sources fs join owner_counts oc on oc.funding_id=fs.id and oc.owner_count=2
        join public.account_ownerships ao on ao.account_id=fs.source_account_id and ao.household_id=tx.household_id
        join public.household_members om on om.id=ao.member_id and om.household_id=tx.household_id and om.deactivated_at is null
       group by ao.member_id
      union all
      select fs.funder_member_id,sum(fs.amount) funding_amount
        from funding_sources fs join owner_counts oc on oc.funding_id=fs.id and oc.owner_count<>2
       group by fs.funder_member_id
    ), balances as (
      select m.id member_id,coalesce(sum(f.funding_amount),0)-coalesce(sum(a.amount)*funded_total/tx_total,0) balance
      from public.household_members m left join funders f on f.member_id=m.id
      left join public.economic_allocations a on a.transaction_id=tx.id and a.responsible_member_id=m.id
      where m.household_id=tx.household_id and m.deactivated_at is null
      group by m.id
    ) select (array_agg(member_id order by balance,member_id) filter(where balance<0))[1],
             (array_agg(member_id order by balance desc,member_id) filter(where balance>0))[1],
             round(least(abs(min(balance) filter(where balance<0)),max(balance) filter(where balance>0)),2)
        into debtor,creditor,effect from balances;
    if fe.installment_id is not null then
      update public.member_settlement_events set state='cancelled',updated_at=now()
       where source_installment_id=fe.installment_id and kind='responsibility_funding' and state='projected'
         and (debtor is null or creditor is null or effect<=0 or debtor_member_id<>debtor or creditor_member_id<>creditor);
    end if;
    if debtor is not null and creditor is not null and effect>0 then
      if fe.installment_id is not null and exists(select 1 from public.member_settlement_events where source_installment_id=fe.installment_id and debtor_member_id=debtor and creditor_member_id=creditor) then
        update public.member_settlement_events set state='realized',amount=effect,occurred_at=fe.funded_at,source_funding_event_id=fe.id,updated_at=now()
         where source_installment_id=fe.installment_id and debtor_member_id=debtor and creditor_member_id=creditor and state='projected';
      else
        insert into public.member_settlement_events(household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,occurred_at,source_transaction_id,source_funding_event_id)
        values(tx.household_id,creator,debtor,creditor,effect,'realized','responsibility_funding',fe.funded_at::date,fe.funded_at,tx.id,fe.id)
        on conflict (source_funding_event_id,debtor_member_id,creditor_member_id) where source_funding_event_id is not null do nothing;
      end if;
    end if;
  end loop;
end $$;
revoke all on function public.reconcile_member_settlements(uuid) from public,anon,authenticated;

create or replace function public.trigger_reconcile_member_settlements()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare tx_id uuid;
begin
  if tg_table_name='economic_allocations' then tx_id:=coalesce(new.transaction_id,old.transaction_id);
  elsif tg_table_name='installments' then select purchase_transaction_id into tx_id from public.installment_plans where id=coalesce(new.installment_plan_id,old.installment_plan_id);
  else tx_id:=coalesce(new.financed_transaction_id,old.financed_transaction_id); end if;
  perform public.reconcile_member_settlements(tx_id); return null;
end $$;
revoke all on function public.trigger_reconcile_member_settlements() from public,anon,authenticated;
create trigger reconcile_settlement_allocation after insert or update or delete on public.economic_allocations for each row execute function public.trigger_reconcile_member_settlements();
create trigger reconcile_settlement_installment after insert or update on public.installments for each row execute function public.trigger_reconcile_member_settlements();
create trigger reconcile_settlement_funding after insert or update on public.funding_events for each row execute function public.trigger_reconcile_member_settlements();

create or replace view public.financial_member_settlement_positions with (security_invoker=true) as
with pairs as (
  select household_id,debtor_member_id,creditor_member_id,
    coalesce(sum(amount) filter(where state='realized' and kind in ('responsibility_funding','adjustment')),0)-coalesce(sum(amount) filter(where state='realized' and kind in ('explicit_settlement','correction')),0) realized_outstanding,
    coalesce(sum(amount) filter(where state='projected' and kind in ('responsibility_funding','adjustment')),0) projected_outstanding
  from public.member_settlement_events where state in ('projected','realized') group by household_id,debtor_member_id,creditor_member_id
), scheduled as (
  select household_id,payer_member_id,receiver_member_id,sum(amount) scheduled_settlement_amount from public.member_settlement_schedules where state='scheduled' group by household_id,payer_member_id,receiver_member_id
)
select p.*,coalesce(s.scheduled_settlement_amount,0)::numeric(19,2) scheduled_settlement_amount,
  (p.realized_outstanding-coalesce((select o.realized_outstanding from pairs o where o.household_id=p.household_id and o.debtor_member_id=p.creditor_member_id and o.creditor_member_id=p.debtor_member_id),0))::numeric(19,2) net_position
from pairs p left join scheduled s on s.household_id=p.household_id and s.payer_member_id=p.debtor_member_id and s.receiver_member_id=p.creditor_member_id;

create or replace function public.create_member_settlement_schedule(p_household_id uuid,p_payer_member_id uuid,p_receiver_member_id uuid,p_amount numeric,p_due_date date,p_idempotency_key text,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; result uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if p_amount<=0 or p_due_date is null or nullif(trim(p_idempotency_key),'') is null then raise exception 'positive amount, due date and idempotency key required' using errcode='22023'; end if;
  insert into public.member_settlement_schedules(household_id,created_by_member_id,payer_member_id,receiver_member_id,amount,due_date,idempotency_key,notes)
  values(p_household_id,caller.id,p_payer_member_id,p_receiver_member_id,p_amount,p_due_date,p_idempotency_key,p_notes)
  on conflict(household_id,idempotency_key) do nothing returning id into result;
  if result is null then
    select id into result from public.member_settlement_schedules
     where household_id=p_household_id and idempotency_key=p_idempotency_key
       and payer_member_id=p_payer_member_id and receiver_member_id=p_receiver_member_id
       and amount=p_amount and due_date=p_due_date and notes is not distinct from p_notes;
    if result is null then raise exception 'idempotency key already used with different schedule data' using errcode='23505'; end if;
  end if;
  return result;
end $$;

create or replace function public.cancel_member_settlement_schedule(p_household_id uuid,p_schedule_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members;
begin caller:=public.require_active_member(p_household_id);
  update public.member_settlement_schedules set state='cancelled',cancelled_at=now(),updated_at=now() where id=p_schedule_id and household_id=p_household_id and state='scheduled';
  if not found then raise exception 'active settlement schedule not found' using errcode='P0002'; end if; return p_schedule_id;
end $$;

create or replace function public.settle_member_position(p_household_id uuid,p_payer_member_id uuid,p_receiver_member_id uuid,p_amount numeric,p_source_account_id uuid,p_destination_account_id uuid,p_occurred_at timestamptz default now(),p_notes text default null,p_schedule_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; outstanding numeric; movement uuid; event_id uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if p_amount<=0 or p_payer_member_id=p_receiver_member_id then raise exception 'positive amount and distinct members required' using errcode='22023'; end if;
  if not exists(select 1 from public.accounts where id=p_source_account_id and household_id=p_household_id and deactivated_at is null) or not exists(select 1 from public.accounts where id=p_destination_account_id and household_id=p_household_id and deactivated_at is null) then raise exception 'settlement accounts must belong to household' using errcode='23514'; end if;
  perform 1 from public.member_settlement_events where household_id=p_household_id and debtor_member_id=p_payer_member_id and creditor_member_id=p_receiver_member_id for update;
  select coalesce(realized_outstanding,0) into outstanding from public.financial_member_settlement_positions where household_id=p_household_id and debtor_member_id=p_payer_member_id and creditor_member_id=p_receiver_member_id;
  if p_amount>coalesce(outstanding,0) then raise exception 'settlement exceeds realized outstanding position' using errcode='23514'; end if;
  insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,source_account_id,destination_account_id,movement_date,competence_date,notes,realized_at)
  values(p_household_id,caller.id,'member_settlement','realized',p_amount,'Acerto entre membros',p_source_account_id,p_destination_account_id,p_occurred_at::date,date_trunc('month',p_occurred_at)::date,p_notes,p_occurred_at) returning id into movement;
  insert into public.member_settlement_events(household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,occurred_at,source_money_movement_id,notes)
  values(p_household_id,caller.id,p_payer_member_id,p_receiver_member_id,p_amount,'realized','explicit_settlement',p_occurred_at::date,p_occurred_at,movement,p_notes) returning id into event_id;
  if p_schedule_id is not null then
    update public.member_settlement_schedules set state='realized',settlement_event_id=event_id,updated_at=now() where id=p_schedule_id and household_id=p_household_id and state='scheduled' and payer_member_id=p_payer_member_id and receiver_member_id=p_receiver_member_id and amount=p_amount;
    if not found then raise exception 'matching active schedule not found' using errcode='23514'; end if;
  end if; return event_id;
end $$;

alter table public.member_settlement_events enable row level security;
alter table public.member_settlement_schedules enable row level security;
revoke all on table public.member_settlement_events,public.member_settlement_schedules from public,anon;
revoke insert,update,delete,truncate,references,trigger on table public.member_settlement_events,public.member_settlement_schedules from authenticated;
grant select on table public.member_settlement_events,public.member_settlement_schedules to authenticated;
create policy member_settlement_events_household_select on public.member_settlement_events for select to authenticated using(public.is_active_household_member(household_id));
create policy member_settlement_schedules_household_select on public.member_settlement_schedules for select to authenticated using(public.is_active_household_member(household_id));
revoke all on table public.financial_member_settlement_positions from public,anon;
grant select on table public.financial_member_settlement_positions to authenticated;

revoke all on function public.create_member_settlement_schedule(uuid,uuid,uuid,numeric,date,text,text) from public,anon;
revoke all on function public.cancel_member_settlement_schedule(uuid,uuid) from public,anon;
revoke all on function public.settle_member_position(uuid,uuid,uuid,numeric,uuid,uuid,timestamptz,text,uuid) from public,anon;
grant execute on function public.create_member_settlement_schedule(uuid,uuid,uuid,numeric,date,text,text) to authenticated;
grant execute on function public.cancel_member_settlement_schedule(uuid,uuid) to authenticated;
grant execute on function public.settle_member_position(uuid,uuid,uuid,numeric,uuid,uuid,timestamptz,text,uuid) to authenticated;

comment on table public.member_settlement_events is 'Continuous append-oriented intermember ledger; never income or expense and never reset monthly.';
comment on table public.member_settlement_schedules is 'Future explicit payments; schedules do not reduce realized position until settled.';
comment on view public.financial_member_settlement_positions is 'Gross directional member positions plus informational net; underlying opposite ledgers remain intact.';
