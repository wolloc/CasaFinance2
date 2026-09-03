-- Bootstrap e RLS para uma primeira instalacao do Casa Finance.
-- Funcoes SECURITY DEFINER pertencem ao papel que aplica a migration. As tabelas
-- continuam com RLS habilitado, mas sem FORCE, para que somente essas funcoes
-- pequenas e auditaveis possam atravessar o bootstrap circular.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_active_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.household_members member
    where member.household_id = target_household_id
      and member.profile_id = auth.uid()
      and member.deactivated_at is null
  );
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.household_members member
    where member.household_id = target_household_id
      and member.profile_id = auth.uid()
      and member.role = 'owner'
      and member.deactivated_at is null
  );
$$;

-- Cria casa e membership em uma unica transacao. Nao existe INSERT direto em
-- households para papeis da API, eliminando casas orfas e o impasse de RLS.
create or replace function public.bootstrap_household(
  household_name text,
  household_currency char(3) default 'BRL',
  household_timezone text default 'America/Sao_Paulo'
)
returns public.households
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  created_household public.households;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if nullif(trim(household_name), '') is null then
    raise exception 'household name is required' using errcode = '22023';
  end if;
  if household_currency !~ '^[A-Z]{3}$' then
    raise exception 'currency must be an ISO 4217 uppercase code' using errcode = '22023';
  end if;
  if nullif(trim(household_timezone), '') is null then
    raise exception 'timezone is required' using errcode = '22023';
  end if;

  -- Tolerates users created before this trigger was installed.
  insert into public.profiles (id, display_name)
  select caller_id,
         coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
                  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Usuario')
  from auth.users u where u.id = caller_id
  on conflict (id) do nothing;

  if not exists (select 1 from public.profiles where id = caller_id) then
    raise exception 'authenticated user does not exist' using errcode = '42501';
  end if;

  insert into public.households (name, currency, timezone)
  values (trim(household_name), household_currency, household_timezone)
  returning * into created_household;

  insert into public.household_members (household_id, profile_id, role)
  values (created_household.id, caller_id, 'owner');

  return created_household;
end;
$$;

-- Evita que a ultima pessoa owner ativa seja removida ou rebaixada.
create or replace function public.protect_last_household_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and old.role = 'owner' and old.deactivated_at is null then
    if not exists (
      select 1 from public.household_members other
      where other.household_id = old.household_id and other.id <> old.id
        and other.role = 'owner' and other.deactivated_at is null
    ) then
      raise exception 'a household must keep an active owner' using errcode = '23514';
    end if;
  elsif tg_op = 'UPDATE' and old.role = 'owner' and old.deactivated_at is null
        and (new.role <> 'owner' or new.deactivated_at is not null
             or new.household_id <> old.household_id) then
    if not exists (
      select 1 from public.household_members other
      where other.household_id = old.household_id and other.id <> old.id
        and other.role = 'owner' and other.deactivated_at is null
    ) then
      raise exception 'a household must keep an active owner' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_last_household_owner on public.household_members;
create trigger protect_last_household_owner
before update or delete on public.household_members
for each row execute function public.protect_last_household_owner();

-- Remove qualquer politica permissiva de uma revisao anterior antes de instalar
-- o conjunto fechado abaixo.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'households', 'household_members', 'accounts', 'cards',
    'categories', 'transactions', 'transaction_splits',
    'transaction_payment_instruments', 'card_invoices',
    'card_invoice_payments', 'funding_events', 'transfers', 'recurring_rules',
    'recurring_occurrences', 'installment_plans', 'installments', 'loans',
    'loan_installments', 'settlements', 'money_movements', 'audit_logs',
    'document_imports', 'merchant_category_rules', 'loan_contracts',
    'loan_payment_schedule'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I no force row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
  end loop;
end $$;

-- Perfil: o proprio usuario altera seus dados; membros ativos veem os perfis da
-- mesma casa para que nomes e avatares possam ser exibidos.
create policy profiles_select on public.profiles for select to authenticated
using (
  id = auth.uid() or exists (
    select 1 from public.household_members mine
    join public.household_members peer on peer.household_id = mine.household_id
    where mine.profile_id = auth.uid() and mine.deactivated_at is null
      and peer.profile_id = profiles.id and peer.deactivated_at is null
  )
);
create policy profiles_update on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy households_select on public.households for select to authenticated
using (public.is_active_household_member(id));
create policy households_update on public.households for update to authenticated
using (public.is_household_owner(id)) with check (public.is_household_owner(id));
create policy households_delete on public.households for delete to authenticated
using (public.is_household_owner(id));

create policy members_select on public.household_members for select to authenticated
using (public.is_active_household_member(household_id));
create policy members_insert on public.household_members for insert to authenticated
with check (public.is_household_owner(household_id));
create policy members_update on public.household_members for update to authenticated
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));
create policy members_delete on public.household_members for delete to authenticated
using (public.is_household_owner(household_id));

-- Entidades financeiras mutaveis: todo membro ativo da casa pode operar; o
-- household_id nao pode ser trocado para uma casa externa pelo WITH CHECK.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'accounts', 'cards', 'categories', 'transactions', 'transaction_splits',
    'transaction_payment_instruments', 'card_invoices', 'card_invoice_payments',
    'funding_events', 'transfers', 'recurring_rules', 'recurring_occurrences',
    'installment_plans', 'installments', 'loans', 'loan_installments',
    'settlements', 'money_movements', 'document_imports',
    'merchant_category_rules', 'loan_contracts', 'loan_payment_schedule'
  ] loop
    execute format('create policy member_select on public.%I for select to authenticated using (public.is_active_household_member(household_id))', table_name);
    execute format('create policy member_insert on public.%I for insert to authenticated with check (public.is_active_household_member(household_id))', table_name);
    execute format('create policy member_update on public.%I for update to authenticated using (public.is_active_household_member(household_id)) with check (public.is_active_household_member(household_id))', table_name);
    execute format('create policy member_delete on public.%I for delete to authenticated using (public.is_active_household_member(household_id))', table_name);
  end loop;
end $$;

-- Logs sao visiveis aos membros e append-only pela API.
create policy audit_logs_select on public.audit_logs for select to authenticated
using (public.is_active_household_member(household_id));
create policy audit_logs_insert on public.audit_logs for insert to authenticated
with check (public.is_active_household_member(household_id));

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.protect_last_household_owner() from public, anon, authenticated;
revoke all on function public.is_active_household_member(uuid) from public, anon;
revoke all on function public.is_household_owner(uuid) from public, anon;
revoke all on function public.bootstrap_household(text, char, text) from public, anon;
grant execute on function public.is_active_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.bootstrap_household(text, char, text) to authenticated;

revoke all on all sequences in schema public from anon;
