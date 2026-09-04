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