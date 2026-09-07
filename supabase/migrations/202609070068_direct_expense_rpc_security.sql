-- Marco 3.05: make the authenticated direct-expense command executable through PostgREST.
-- The original wrapper was SECURITY INVOKER but calls require_active_member(), an intentionally
-- private helper. Keep that helper private and align this public canonical command with the other
-- SECURITY DEFINER financial commands. Membership is still checked explicitly before mutation.

alter function public.create_and_settle_direct_expense(
  uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,timestamptz,text
) security definer;

alter function public.create_and_settle_direct_expense(
  uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,timestamptz,text
) set search_path = public, pg_temp;

revoke all on function public.create_and_settle_direct_expense(
  uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,timestamptz,text
) from public, anon;

grant execute on function public.create_and_settle_direct_expense(
  uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,timestamptz,text
) to authenticated;

comment on function public.create_and_settle_direct_expense(
  uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,timestamptz,text
) is 'Atomic authenticated direct-expense command. SECURITY DEFINER with fixed search_path; explicitly enforces active household membership and keeps buyer, responsibility, account ownership and funder independent.';
