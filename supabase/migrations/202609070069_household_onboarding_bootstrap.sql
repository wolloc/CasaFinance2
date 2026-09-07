-- Harden the real onboarding path discovered during staging homologation.
-- The previous client updated profiles before calling bootstrap_household; a
-- profile write failure could prevent household creation. This RPC keeps the
-- profile name + household + owner membership in one SECURITY DEFINER transaction.

create or replace function public.bootstrap_household_with_profile(
  household_name text,
  display_name text,
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
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(caller_id::text, 0)
  );

  if nullif(trim(household_name), '') is null then
    raise exception 'household name is required' using errcode = '22023';
  end if;
  if nullif(trim(display_name), '') is null then
    raise exception 'display name is required' using errcode = '22023';
  end if;
  if household_currency !~ '^[A-Z]{3}$' then
    raise exception 'currency must be an ISO 4217 uppercase code' using errcode = '22023';
  end if;
  if nullif(trim(household_timezone), '') is null
     or trim(household_timezone) not in ('America/Sao_Paulo') then
    raise exception 'timezone is not supported by Casa Finance' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name)
  values (caller_id, trim(display_name))
  on conflict (id) do update
    set display_name = excluded.display_name,
        updated_at = now();

  select household.* into existing_household
  from public.households household
  join public.household_members member on member.household_id = household.id
  where member.profile_id = caller_id
    and member.deactivated_at is null
  order by member.joined_at
  limit 1;

  if existing_household.id is not null then
    return existing_household;
  end if;

  insert into public.households (name, currency, timezone)
  values (trim(household_name), household_currency, trim(household_timezone))
  returning * into created_household;

  insert into public.household_members (household_id, profile_id, role)
  values (created_household.id, caller_id, 'owner');

  return created_household;
end;
$$;

revoke all on function public.bootstrap_household_with_profile(text, text, char, text) from public, anon;
grant execute on function public.bootstrap_household_with_profile(text, text, char, text) to authenticated;
