-- Etapa 8.3: lancamentos basicos de receita e despesa.
-- created/buyer/instrument roles remain independent; no funding or responsibility inference.

alter table public.transactions enable row level security;
alter table public.transaction_payment_instruments enable row level security;

drop policy if exists member_select on public.transactions;
drop policy if exists member_insert on public.transactions;
drop policy if exists member_update on public.transactions;
drop policy if exists member_delete on public.transactions;
drop policy if exists member_select on public.transaction_payment_instruments;
drop policy if exists member_insert on public.transaction_payment_instruments;
drop policy if exists member_update on public.transaction_payment_instruments;
drop policy if exists member_delete on public.transaction_payment_instruments;

drop policy if exists transactions_select on public.transactions;
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_update on public.transactions;
drop policy if exists transactions_delete on public.transactions;
drop policy if exists transaction_instruments_select on public.transaction_payment_instruments;
drop policy if exists transaction_instruments_insert on public.transaction_payment_instruments;
drop policy if exists transaction_instruments_update on public.transaction_payment_instruments;
drop policy if exists transaction_instruments_delete on public.transaction_payment_instruments;

create policy transactions_select on public.transactions for select to authenticated
using (public.is_active_household_member(household_id));
create policy transactions_insert on public.transactions for insert to authenticated
with check (public.is_active_household_member(household_id));
create policy transactions_update on public.transactions for update to authenticated
using (public.is_active_household_member(household_id))
with check (public.is_active_household_member(household_id));

create policy transaction_instruments_select on public.transaction_payment_instruments for select to authenticated
using (public.is_active_household_member(household_id));
create policy transaction_instruments_insert on public.transaction_payment_instruments for insert to authenticated
with check (public.is_active_household_member(household_id));
create policy transaction_instruments_update on public.transaction_payment_instruments for update to authenticated
using (public.is_active_household_member(household_id))
with check (public.is_active_household_member(household_id));

create or replace function public.validate_transaction_household_links()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'transactions' then
    if tg_op = 'UPDATE' and new.created_by_member_id <> old.created_by_member_id then
      raise exception 'transaction creator cannot be changed' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and new.type <> old.type then
      raise exception 'transaction type cannot be changed' using errcode = '23514';
    end if;
    if new.created_by_member_id <> (select m.id from public.household_members m where m.profile_id = auth.uid() and m.household_id = new.household_id and m.deactivated_at is null limit 1) then
      raise exception 'transaction creator must match the authenticated active member' using errcode = '42501';
    end if;
    if new.type = 'expense' and new.buyer_member_id is null then
      raise exception 'expense transaction requires a buyer' using errcode = '23514';
    end if;
    if new.type = 'income' and new.buyer_member_id is not null then
      raise exception 'income transaction cannot have a buyer' using errcode = '23514';
    end if;
    if not exists (select 1 from public.household_members m where m.id = new.created_by_member_id and m.household_id = new.household_id and m.deactivated_at is null) then
      raise exception 'transaction creator must be an active member of the same household' using errcode = '23514';
    end if;
    if new.buyer_member_id is not null and not exists (select 1 from public.household_members m where m.id = new.buyer_member_id and m.household_id = new.household_id and m.deactivated_at is null) then
      raise exception 'transaction buyer must be an active member of the same household' using errcode = '23514';
    end if;
    if new.category_id is not null and not exists (select 1 from public.categories c where c.id = new.category_id and c.household_id = new.household_id and c.deactivated_at is null and c.type::text = new.type::text) then
      raise exception 'transaction category must be active and match the transaction type' using errcode = '23514';
    end if;
  else
    if not exists (select 1 from public.transactions t where t.id = new.transaction_id and t.household_id = new.household_id and t.deleted_at is null) then
      raise exception 'payment instrument must belong to the same active household transaction' using errcode = '23514';
    end if;
    if (select t.type from public.transactions t where t.id = new.transaction_id) <> 'expense' then
      raise exception 'income transaction cannot have a payment instrument' using errcode = '23514';
    end if;
    if new.account_id is not null and not exists (select 1 from public.accounts a where a.id = new.account_id and a.household_id = new.household_id and a.deactivated_at is null) then
      raise exception 'payment account must belong to the same household' using errcode = '23514';
    end if;
    if new.card_id is not null and not exists (select 1 from public.cards c where c.id = new.card_id and c.household_id = new.household_id and c.deactivated_at is null) then
      raise exception 'payment card must belong to the same household' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_transaction_household_links() from public, anon, authenticated;
drop trigger if exists transactions_household_links on public.transactions;
create trigger transactions_household_links before insert or update on public.transactions for each row execute function public.validate_transaction_household_links();
drop trigger if exists transaction_instruments_household_links on public.transaction_payment_instruments;
create trigger transaction_instruments_household_links before insert or update on public.transaction_payment_instruments for each row execute function public.validate_transaction_household_links();

create or replace function public.validate_basic_transaction_completeness()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare instrument_count integer;
begin
  if tg_table_name = 'transactions' then
    select count(*) into instrument_count from public.transaction_payment_instruments i where i.transaction_id = new.id;
    if new.type = 'expense' and instrument_count <> 1 then
      raise exception 'expense transaction requires exactly one payment instrument' using errcode = '23514';
    end if;
    if new.type = 'income' and instrument_count <> 0 then
      raise exception 'income transaction cannot have a payment instrument' using errcode = '23514';
    end if;
  else
    select count(*) into instrument_count from public.transaction_payment_instruments i where i.transaction_id = new.transaction_id;
    if instrument_count <> 1 then
      raise exception 'expense transaction requires exactly one payment instrument' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_basic_transaction_completeness() from public, anon, authenticated;
drop trigger if exists transactions_basic_completeness on public.transactions;
create constraint trigger transactions_basic_completeness after insert or update on public.transactions deferrable initially deferred for each row execute function public.validate_basic_transaction_completeness();
drop trigger if exists transaction_instruments_basic_completeness on public.transaction_payment_instruments;
create constraint trigger transaction_instruments_basic_completeness after insert or update on public.transaction_payment_instruments deferrable initially deferred for each row execute function public.validate_basic_transaction_completeness();

create or replace function public.create_basic_transaction(
  p_type public.transaction_kind, p_description text, p_amount numeric, p_transaction_date date,
  p_category_id uuid, p_buyer_member_id uuid default null, p_notes text default null,
  p_instrument_kind public.payment_instrument_kind default null, p_account_id uuid default null, p_card_id uuid default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller_member public.household_members; new_transaction_id uuid;
begin
  select * into caller_member from public.household_members m where m.profile_id = auth.uid() and m.deactivated_at is null order by m.joined_at limit 1;
  if caller_member.id is null then raise exception 'authenticated active household membership required' using errcode = '42501'; end if;
  if p_type = 'expense' and (p_buyer_member_id is null or p_instrument_kind is null) then raise exception 'expense requires buyer and payment instrument' using errcode = '23514'; end if;
  if p_type = 'income' and (p_buyer_member_id is not null or p_instrument_kind is not null) then raise exception 'income cannot have buyer or payment instrument' using errcode = '23514'; end if;
  insert into public.transactions (household_id, created_by_member_id, buyer_member_id, category_id, type, status, description, amount, transaction_date, competence_date, notes)
  values (caller_member.household_id, caller_member.id, p_buyer_member_id, p_category_id, p_type, 'pending', p_description, p_amount, p_transaction_date, p_transaction_date, p_notes)
  returning id into new_transaction_id;
  if p_type = 'expense' then
    insert into public.transaction_payment_instruments (household_id, transaction_id, kind, account_id, card_id)
    values (caller_member.household_id, new_transaction_id, p_instrument_kind, case when p_instrument_kind = 'account' then p_account_id end, case when p_instrument_kind = 'card' then p_card_id end);
  end if;
  return new_transaction_id;
end;
$$;

create or replace function public.update_basic_transaction(
  p_transaction_id uuid, p_description text, p_amount numeric, p_transaction_date date,
  p_category_id uuid, p_notes text default null, p_instrument_kind public.payment_instrument_kind default null,
  p_account_id uuid default null, p_card_id uuid default null
) returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare existing public.transactions; caller_member public.household_members;
begin
  select * into caller_member from public.household_members m where m.profile_id = auth.uid() and m.deactivated_at is null order by m.joined_at limit 1;
  select * into existing from public.transactions t where t.id = p_transaction_id and t.household_id = caller_member.household_id and t.deleted_at is null for update;
  if existing.id is null then raise exception 'transaction not found in authenticated household' using errcode = '42501'; end if;
  update public.transactions set description = p_description, amount = p_amount, transaction_date = p_transaction_date, competence_date = p_transaction_date, category_id = p_category_id, notes = p_notes, updated_at = now() where id = existing.id;
  if existing.type = 'expense' then
    update public.transaction_payment_instruments set kind = coalesce(p_instrument_kind, kind), account_id = case when coalesce(p_instrument_kind, kind) = 'account' then coalesce(p_account_id, account_id) else null end, card_id = case when coalesce(p_instrument_kind, kind) = 'card' then coalesce(p_card_id, card_id) else null end where transaction_id = existing.id;
  end if;
end;
$$;

revoke all on function public.create_basic_transaction(public.transaction_kind, text, numeric, date, uuid, uuid, text, public.payment_instrument_kind, uuid, uuid) from public, anon;
grant execute on function public.create_basic_transaction(public.transaction_kind, text, numeric, date, uuid, uuid, text, public.payment_instrument_kind, uuid, uuid) to authenticated;
revoke all on function public.update_basic_transaction(uuid, text, numeric, date, uuid, text, public.payment_instrument_kind, uuid, uuid) from public, anon;
grant execute on function public.update_basic_transaction(uuid, text, numeric, date, uuid, text, public.payment_instrument_kind, uuid, uuid) to authenticated;