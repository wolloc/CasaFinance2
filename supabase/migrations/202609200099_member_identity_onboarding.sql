-- Member identity is part of financial onboarding, not an email-derived technical detail.
-- Invited members must confirm how they are identified before entering financial surfaces.

alter table public.profiles add column if not exists display_name_confirmed_at timestamptz;

update public.profiles p
set display_name_confirmed_at = coalesce(p.display_name_confirmed_at, now())
where exists (
  select 1 from public.household_members hm
  where hm.profile_id = p.id and hm.role = 'owner' and hm.deactivated_at is null
);

create or replace function public.confirm_my_display_name(display_name text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  caller_id uuid := auth.uid();
  normalized_name text := nullif(trim(display_name), '');
begin
  if caller_id is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if normalized_name is null then raise exception 'display name is required' using errcode = '22023'; end if;
  if char_length(normalized_name) > 80 then raise exception 'display name is too long' using errcode = '22023'; end if;
  if not exists (select 1 from public.household_members hm where hm.profile_id = caller_id and hm.deactivated_at is null) then
    raise exception 'active household membership required' using errcode = '42501';
  end if;

  insert into public.profiles (id, display_name, display_name_confirmed_at)
  values (caller_id, normalized_name, now())
  on conflict (id) do update
    set display_name = excluded.display_name, display_name_confirmed_at = now(), updated_at = now();
  return normalized_name;
end;
$$;

revoke all on function public.confirm_my_display_name(text) from public, anon;
grant execute on function public.confirm_my_display_name(text) to authenticated;

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
  return created_household;
end;
$$;

revoke all on function public.bootstrap_household_with_profile(text, text, char, text) from public, anon;
grant execute on function public.bootstrap_household_with_profile(text, text, char, text) to authenticated;
