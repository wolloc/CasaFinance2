-- Restore the table-level privileges required by the authenticated browser client
-- to discover its household after login. RLS remains the row-level authority.
--
-- Without these GRANTs PostgREST rejects the request before evaluating the
-- existing policies (42501 permission denied), so a valid authenticated user
-- cannot complete household onboarding.

revoke all on table public.profiles from anon;
revoke all on table public.households from anon;
revoke all on table public.household_members from anon;

grant select on table public.profiles to authenticated;
grant select on table public.households to authenticated;
grant select on table public.household_members to authenticated;

-- Fail the migration if the release contract is accidentally changed while this
-- migration is replayed. These checks cover table privileges; RLS/policies are
-- separately exercised by the database security gates.
do $$
begin
  if not has_table_privilege('authenticated', 'public.profiles', 'SELECT') then
    raise exception 'authenticated must have SELECT on public.profiles';
  end if;
  if not has_table_privilege('authenticated', 'public.households', 'SELECT') then
    raise exception 'authenticated must have SELECT on public.households';
  end if;
  if not has_table_privilege('authenticated', 'public.household_members', 'SELECT') then
    raise exception 'authenticated must have SELECT on public.household_members';
  end if;
  if has_table_privilege('anon', 'public.profiles', 'SELECT')
     or has_table_privilege('anon', 'public.households', 'SELECT')
     or has_table_privilege('anon', 'public.household_members', 'SELECT') then
    raise exception 'anonymous onboarding table reads must remain revoked';
  end if;
end
$$;
