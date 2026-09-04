-- Etapa 8.1: accounts/cards persistentes no Supabase.
-- owner_member_id e somente titularidade; nao representa comprador, responsavel
-- economico ou pagador de transacoes futuras.

alter table public.accounts enable row level security;
alter table public.cards enable row level security;

drop policy if exists member_select on public.accounts;
drop policy if exists member_insert on public.accounts;
drop policy if exists member_update on public.accounts;
drop policy if exists member_delete on public.accounts;
drop policy if exists member_select on public.cards;
drop policy if exists member_insert on public.cards;
drop policy if exists member_update on public.cards;
drop policy if exists member_delete on public.cards;

create policy accounts_select on public.accounts for select to authenticated
using (public.is_active_household_member(household_id));
create policy accounts_insert on public.accounts for insert to authenticated
with check (public.is_active_household_member(household_id));
create policy accounts_update on public.accounts for update to authenticated
using (public.is_active_household_member(household_id))
with check (public.is_active_household_member(household_id));
create policy accounts_delete on public.accounts for delete to authenticated
using (public.is_active_household_member(household_id));

create policy cards_select on public.cards for select to authenticated
using (public.is_active_household_member(household_id));
create policy cards_insert on public.cards for insert to authenticated
with check (public.is_active_household_member(household_id));
create policy cards_update on public.cards for update to authenticated
using (public.is_active_household_member(household_id))
with check (public.is_active_household_member(household_id));
create policy cards_delete on public.cards for delete to authenticated
using (public.is_active_household_member(household_id));

create or replace function public.validate_account_card_household_links()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'accounts' then
    if new.owner_member_id is not null and not exists (
      select 1 from public.household_members member
      where member.id = new.owner_member_id
        and member.household_id = new.household_id
        and member.deactivated_at is null
    ) then
      raise exception 'account owner must be an active member of the same household' using errcode = '23514';
    end if;
  else
    if not exists (
      select 1 from public.household_members member
      where member.id = new.owner_member_id
        and member.household_id = new.household_id
        and member.deactivated_at is null
    ) then
      raise exception 'card owner must be an active member of the same household' using errcode = '23514';
    end if;
    if new.default_payment_account_id is not null and not exists (
      select 1 from public.accounts account
      where account.id = new.default_payment_account_id
        and account.household_id = new.household_id
    ) then
      raise exception 'default payment account must belong to the same household' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_account_card_household_links() from public, anon, authenticated;

drop trigger if exists accounts_cards_household_links on public.accounts;
create trigger accounts_cards_household_links before insert or update on public.accounts
for each row execute function public.validate_account_card_household_links();
drop trigger if exists cards_household_links on public.cards;
create trigger cards_household_links before insert or update on public.cards
for each row execute function public.validate_account_card_household_links();