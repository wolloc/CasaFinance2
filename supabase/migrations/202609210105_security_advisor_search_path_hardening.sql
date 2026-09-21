-- Release 1 security hardening from Supabase Security Advisor.
-- These trigger functions are intentionally invoker-security, but their object
-- resolution must still be deterministic and not depend on a caller-controlled search_path.

alter function public.assert_transaction_splits_total()
  set search_path = public, pg_temp;

alter function public.enforce_two_active_household_members()
  set search_path = public, pg_temp;
