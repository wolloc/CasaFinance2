-- Etapa 10H.18: close legacy mutation bypasses and settlement/recur guards.
-- Forward-only companion to migrations 033-035 in the same unreleased branch.
--
-- Final review boundaries addressed here:
-- * authenticated callers cannot update transaction rows directly; writes go through RPCs;
-- * the legacy update RPC is retained only as a compatibility wrapper over the audited correction command;
-- * materialized recurring occurrences are rejected by direct correction/cancellation;
-- * cancellation removes projected member-acerto effects for the cancelled source;
-- * direct refunds are rejected when realized member-acerto effects already exist;
-- * corrected amounts re-run member-settlement reconciliation after allocations are rescaled.

-- Authenticated app code must not bypass audited command semantics with direct row updates.
revoke update on public.transactions from public,anon,authenticated;

-- Compatibility wrapper for the old authenticated UI. It no longer performs an
-- unaudited raw update. Fields not represented by the new audit payload must stay
-- unchanged until a dedicated full-edit command exists.
create or replace function public.update_basic_transaction(
  p_household_id uuid, p_transaction_id uuid, p_description text, p_amount numeric, p_transaction_date date,
  p_category_id uuid, p_buyer_member_id uuid default null, p_notes text default null,
  p_instrument_kind public.payment_instrument_kind default null,
  p_account_id uuid default null, p_card_id uuid default null
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  existing public.transactions;
  pi public.transaction_payment_instruments;
  audit_id uuid;
begin
  perform public.require_active_member(p_household_id);

  select * into existing from public.transactions
  where id=p_transaction_id and household_id=p_household_id and deleted_at is null
  for update;
  if existing.id is null then
    raise exception 'transaction not found in authenticated household' using errcode='42501';
  end if;

  select * into pi from public.transaction_payment_instruments
  where household_id=p_household_id and transaction_id=existing.id;

  if existing.buyer_member_id is distinct from p_buyer_member_id
     or existing.notes is distinct from nullif(trim(coalesce(p_notes,'')),'')
     or (existing.type='expense' and (
       pi.kind is distinct from p_instrument_kind
       or pi.account_id is distinct from case when p_instrument_kind='account' then p_account_id else null end
       or pi.card_id is distinct from case when p_instrument_kind='card' then p_card_id else null end
     ))
  then
    raise exception 'buyer, notes or payment instrument changes require the dedicated audited edit flow' using errcode='0A000';
  end if;

  audit_id:=public.correct_unrealized_transaction(
    p_household_id,
    existing.id,
    p_description,
    p_amount,
    p_transaction_date,
    existing.due_date,
    p_category_id,
    'Legacy UI audited edit',
    'legacy-update:'||gen_random_uuid()::text
  );
end
$$;

revoke all on function public.update_basic_transaction(uuid,uuid,text,numeric,date,uuid,uuid,text,public.payment_instrument_kind,uuid,uuid) from public,anon;
grant execute on function public.update_basic_transaction(uuid,uuid,text,numeric,date,uuid,uuid,text,public.payment_instrument_kind,uuid,uuid) to authenticated;

-- A materialized recurring occurrence is its own canonical downstream fact.
-- Reject direct correction/cancellation before the transaction mutation occurs.
create or replace function public.guard_adjustment_event_dependencies()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.kind in ('correction','cancellation') and exists(
    select 1 from public.recurring_occurrences o
    where o.household_id=new.household_id and o.transaction_id=new.source_transaction_id
  ) then
    raise exception 'materialized recurring occurrence requires the dedicated recurrence correction flow' using errcode='0A000';
  end if;

  if new.kind='refund' and exists(
    select 1 from public.member_settlement_events mse
    where mse.household_id=new.household_id
      and mse.source_transaction_id=new.source_transaction_id
      and mse.kind='responsibility_funding'
      and mse.state='realized'
  ) then
    raise exception 'refund with realized member settlement effects requires a dedicated settlement-reversal flow' using errcode='0A000';
  end if;

  return new;
end
$$;
revoke all on function public.guard_adjustment_event_dependencies() from public,anon,authenticated;

drop trigger if exists transaction_adjustment_events_dependency_guard on public.transaction_adjustment_events;
create trigger transaction_adjustment_events_dependency_guard
before insert on public.transaction_adjustment_events
for each row execute function public.guard_adjustment_event_dependencies();

-- Keep projected member acertos synchronized when the source commitment changes.
create or replace function public.sync_member_settlements_after_transaction_change()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if new.type<>'expense' then return new; end if;

  if new.economic_state='cancelled' and old.economic_state is distinct from new.economic_state then
    update public.member_settlement_events
    set state='cancelled',updated_at=now()
    where household_id=new.household_id
      and source_transaction_id=new.id
      and kind='responsibility_funding'
      and state='projected';
    return new;
  end if;

  if new.economic_state not in ('cancelled','reversed') and (
       old.amount is distinct from new.amount
    or old.estimated_amount is distinct from new.estimated_amount
    or old.confirmed_amount is distinct from new.confirmed_amount
    or old.transaction_date is distinct from new.transaction_date
    or old.due_date is distinct from new.due_date
  ) then
    perform public.reconcile_member_settlements(new.id);
  end if;

  return new;
end
$$;
revoke all on function public.sync_member_settlements_after_transaction_change() from public,anon,authenticated;

drop trigger if exists transactions_sync_member_settlements_after_change on public.transactions;
create trigger transactions_sync_member_settlements_after_change
after update of amount,estimated_amount,confirmed_amount,transaction_date,due_date,economic_state
on public.transactions
for each row execute function public.sync_member_settlements_after_transaction_change();

comment on function public.update_basic_transaction(uuid,uuid,text,numeric,date,uuid,uuid,text,public.payment_instrument_kind,uuid,uuid) is
  'Compatibility-only wrapper. Audited corrections go through correct_unrealized_transaction; buyer/notes/instrument edits are deliberately blocked until their dedicated flow exists.';
