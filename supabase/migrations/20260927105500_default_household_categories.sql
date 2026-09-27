-- Default category suggestions for newly created households.
-- Categories remain user-editable classification only and never determine
-- buyer, payer, funder, responsibility, cash movement or income semantics.

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
  existing_household public.households;
  created_household public.households;
begin
  if caller_id is null then raise exception 'authentication required' using errcode = '42501'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));

  if nullif(trim(household_name), '') is null then raise exception 'household name is required' using errcode = '22023'; end if;
  if household_currency !~ '^[A-Z]{3}$' then raise exception 'currency must be an ISO 4217 uppercase code' using errcode = '22023'; end if;
  if nullif(trim(household_timezone), '') is null or trim(household_timezone) not in ('America/Sao_Paulo') then
    raise exception 'timezone is not supported by Casa Finance' using errcode = '22023';
  end if;

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

  select household.* into existing_household
  from public.households household
  join public.household_members member on member.household_id = household.id
  where member.profile_id = caller_id and member.deactivated_at is null
  order by member.joined_at limit 1;

  if existing_household.id is not null then return existing_household; end if;

  insert into public.households (name, currency, timezone)
  values (trim(household_name), household_currency, trim(household_timezone))
  returning * into created_household;

  insert into public.household_members (household_id, profile_id, role)
  values (created_household.id, caller_id, 'owner');

  insert into public.categories (household_id,type,name,icon,color) values
    (created_household.id,'expense','Alimentação','utensils','#f59e0b'),
    (created_household.id,'expense','Mercado','shopping-basket','#34d399'),
    (created_household.id,'expense','Moradia','home','#60a5fa'),
    (created_household.id,'expense','Transporte','bus','#22d3ee'),
    (created_household.id,'expense','Saúde','heart-pulse','#fb7185'),
    (created_household.id,'expense','Lazer','gamepad','#a78bfa'),
    (created_household.id,'expense','Assinaturas','smartphone','#94a3b8'),
    (created_household.id,'expense','Compras','shirt','#f472b6'),
    (created_household.id,'expense','Educação','graduation-cap','#60a5fa'),
    (created_household.id,'expense','Pets','paw-print','#34d399'),
    (created_household.id,'expense','Viagens','plane','#22d3ee'),
    (created_household.id,'expense','Outros','sparkles','#94a3b8'),
    (created_household.id,'income','Salário','briefcase-business','#34d399'),
    (created_household.id,'income','Freelance / Trabalho extra','briefcase-business','#22d3ee'),
    (created_household.id,'income','Benefício','wallet-cards','#60a5fa'),
    (created_household.id,'income','Rendimentos','piggy-bank','#a78bfa'),
    (created_household.id,'income','Reembolso','receipt-text','#f59e0b'),
    (created_household.id,'income','Venda','circle-dollar-sign','#34d399'),
    (created_household.id,'income','Presente / Ajuda','gift','#f472b6'),
    (created_household.id,'income','Outros','sparkles','#94a3b8')
  on conflict (household_id,type,name) do nothing;

  return created_household;
end;
$$;

revoke all on function public.bootstrap_household(text, char, text) from public, anon;
grant execute on function public.bootstrap_household(text, char, text) to authenticated;

create or replace function public.bootstrap_household_with_profile(
  household_name text,
  display_name text,
  household_currency char(3) default 'BRL',
  household_timezone text default 'America/Sao_Paulo'
)
returns public.households language plpgsql security definer set search_path = public, pg_temp as $$
declare
  caller_id uuid := auth.uid();
  existing_household public.households;
  created_household public.households;
begin
  if caller_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller_id::text, 0));
  if nullif(trim(household_name), '') is null then raise exception 'household name is required' using errcode = '22023'; end if;
  if nullif(trim(display_name), '') is null then raise exception 'display name is required' using errcode = '22023'; end if;
  if household_currency !~ '^[A-Z]{3}$' then raise exception 'currency must be an ISO 4217 uppercase code' using errcode = '22023'; end if;
  if nullif(trim(household_timezone), '') is null or trim(household_timezone) not in ('America/Sao_Paulo') then
    raise exception 'timezone is not supported by Casa Finance' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name, display_name_confirmed_at)
  values (caller_id, trim(display_name), now())
  on conflict (id) do update
    set display_name = excluded.display_name, display_name_confirmed_at = now(), updated_at = now();

  select household.* into existing_household
  from public.households household
  join public.household_members member on member.household_id = household.id
  where member.profile_id = caller_id and member.deactivated_at is null
  order by member.joined_at limit 1;

  if existing_household.id is not null then return existing_household; end if;

  insert into public.households (name, currency, timezone)
  values (trim(household_name), household_currency, trim(household_timezone))
  returning * into created_household;

  insert into public.household_members (household_id, profile_id, role)
  values (created_household.id, caller_id, 'owner');

  insert into public.categories (household_id,type,name,icon,color) values
    (created_household.id,'expense','Alimentação','utensils','#f59e0b'),
    (created_household.id,'expense','Mercado','shopping-basket','#34d399'),
    (created_household.id,'expense','Moradia','home','#60a5fa'),
    (created_household.id,'expense','Transporte','bus','#22d3ee'),
    (created_household.id,'expense','Saúde','heart-pulse','#fb7185'),
    (created_household.id,'expense','Lazer','gamepad','#a78bfa'),
    (created_household.id,'expense','Assinaturas','smartphone','#94a3b8'),
    (created_household.id,'expense','Compras','shirt','#f472b6'),
    (created_household.id,'expense','Educação','graduation-cap','#60a5fa'),
    (created_household.id,'expense','Pets','paw-print','#34d399'),
    (created_household.id,'expense','Viagens','plane','#22d3ee'),
    (created_household.id,'expense','Outros','sparkles','#94a3b8'),
    (created_household.id,'income','Salário','briefcase-business','#34d399'),
    (created_household.id,'income','Freelance / Trabalho extra','briefcase-business','#22d3ee'),
    (created_household.id,'income','Benefício','wallet-cards','#60a5fa'),
    (created_household.id,'income','Rendimentos','piggy-bank','#a78bfa'),
    (created_household.id,'income','Reembolso','receipt-text','#f59e0b'),
    (created_household.id,'income','Venda','circle-dollar-sign','#34d399'),
    (created_household.id,'income','Presente / Ajuda','gift','#f472b6'),
    (created_household.id,'income','Outros','sparkles','#94a3b8')
  on conflict (household_id,type,name) do nothing;

  return created_household;
end;
$$;

revoke all on function public.bootstrap_household_with_profile(text, text, char, text) from public, anon;
grant execute on function public.bootstrap_household_with_profile(text, text, char, text) to authenticated;
