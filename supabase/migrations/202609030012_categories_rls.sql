-- Etapa 8.2: categories persistentes. Desativacao e soft delete.
-- Categorias sao apenas classificacao; nao deduzem comprador, pagador ou funding.

alter table public.categories enable row level security;

drop policy if exists member_select on public.categories;
drop policy if exists member_insert on public.categories;
drop policy if exists member_update on public.categories;
drop policy if exists member_delete on public.categories;
drop policy if exists categories_delete on public.categories;

create policy categories_select on public.categories for select to authenticated
using (public.is_active_household_member(household_id));
create policy categories_insert on public.categories for insert to authenticated
with check (public.is_active_household_member(household_id));
create policy categories_update on public.categories for update to authenticated
using (public.is_active_household_member(household_id))
with check (public.is_active_household_member(household_id));

revoke all on table public.categories from anon;