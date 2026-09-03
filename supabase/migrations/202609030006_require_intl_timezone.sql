-- Restrict household time zones to identifiers verified against the JavaScript
-- Intl.DateTimeFormat consumers. This additive migration supersedes 005 without
-- changing migration history or weakening the atomic SECURITY DEFINER bootstrap.
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
  -- PostgreSQL exposes implementation-specific entries (for example, posix/*)
  -- that Intl.DateTimeFormat rejects. Keep this allowlist intentionally narrow;
  -- add identifiers only after verifying support in every JavaScript runtime used
  -- by Casa Finance.
  if nullif(trim(household_timezone), '') is null
     or trim(household_timezone) not in ('America/Sao_Paulo') then
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

  insert into public.households (name, currency, timezone)
  values (trim(household_name), household_currency, trim(household_timezone))
  returning * into created_household;

  insert into public.household_members (household_id, profile_id, role)
  values (created_household.id, caller_id, 'owner');

  return created_household;
end;
$$;

revoke all on function public.bootstrap_household(text, char, text) from public, anon;
grant execute on function public.bootstrap_household(text, char, text) to authenticated;
