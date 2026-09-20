-- Financial surfaces are released only after each member explicitly completes
-- their own entry preparation. This is a UX/readiness marker, not a financial fact.

alter table public.profiles
  add column if not exists financial_onboarding_completed_at timestamptz;

-- Existing owners are grandfathered: this gate targets the invited-member entry journey.
update public.profiles p
set financial_onboarding_completed_at = coalesce(p.financial_onboarding_completed_at, now())
where exists (
  select 1 from public.household_members hm
  where hm.profile_id=p.id and hm.role='owner' and hm.deactivated_at is null
);

create or replace function public.complete_my_financial_onboarding()
returns timestamptz
language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller_id uuid:=auth.uid(); completed timestamptz;
begin
  if caller_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.household_members hm where hm.profile_id=caller_id and hm.deactivated_at is null) then
    raise exception 'active household membership required' using errcode='42501';
  end if;
  update public.profiles
  set financial_onboarding_completed_at=coalesce(financial_onboarding_completed_at,now()),updated_at=now()
  where id=caller_id
  returning financial_onboarding_completed_at into completed;
  if completed is null then raise exception 'profile required' using errcode='23514'; end if;
  return completed;
end;
$$;
revoke all on function public.complete_my_financial_onboarding() from public,anon;
grant execute on function public.complete_my_financial_onboarding() to authenticated;
