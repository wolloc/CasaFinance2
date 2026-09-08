-- Marco 4 / Trilha 1: make the browser app surface deterministic on real Supabase.
--
-- RLS policies already define which household rows an authenticated user may see.
-- Several original tables, however, never received explicit table-level SELECT
-- privileges for `authenticated`. PostgREST checks table privileges before RLS,
-- and security_invoker financial views also require the invoker to be able to
-- read their underlying relations. This caused a valid fresh household to fail
-- across Home, accounts/cards, categories, expenses and other read journeys.
--
-- This migration intentionally grants READ access only to the original RLS-
-- protected finance surface. Direct writes stay restricted to the three setup
-- resources that the current UI deliberately writes through PostgREST.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'households', 'household_members',
    'accounts', 'cards', 'categories',
    'transactions', 'transaction_splits', 'transaction_payment_instruments',
    'card_invoices', 'card_invoice_payments', 'funding_events', 'transfers',
    'recurring_rules', 'recurring_occurrences',
    'installment_plans', 'installments',
    'loans', 'loan_installments', 'settlements', 'money_movements', 'audit_logs',
    'document_imports', 'merchant_category_rules',
    'loan_contracts', 'loan_payment_schedule'
  ] loop
    execute format('revoke all on table public.%I from public, anon', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
  end loop;
end
$$;

-- These are intentional direct-PostgREST setup writes in the current frontend.
-- Their existing RLS policies keep every mutation household-scoped.
grant insert on table public.accounts to authenticated;
grant insert on table public.cards to authenticated;
grant insert, update on table public.categories to authenticated;

-- Deterministic ACL regression contract. RLS/isolation is exercised separately
-- by the dynamic SQL and real Auth/JWT HTTP gates.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'households', 'household_members',
    'accounts', 'cards', 'categories',
    'transactions', 'transaction_splits', 'transaction_payment_instruments',
    'card_invoices', 'card_invoice_payments', 'funding_events', 'transfers',
    'recurring_rules', 'recurring_occurrences',
    'installment_plans', 'installments',
    'loans', 'loan_installments', 'settlements', 'money_movements', 'audit_logs',
    'document_imports', 'merchant_category_rules',
    'loan_contracts', 'loan_payment_schedule'
  ] loop
    if not has_table_privilege('authenticated', format('public.%I', table_name), 'SELECT') then
      raise exception 'authenticated must have SELECT on public.%', table_name;
    end if;
    if has_table_privilege('anon', format('public.%I', table_name), 'SELECT') then
      raise exception 'anon must not have SELECT on public.%', table_name;
    end if;
  end loop;

  if not has_table_privilege('authenticated', 'public.accounts', 'INSERT') then
    raise exception 'authenticated must have INSERT on public.accounts';
  end if;
  if not has_table_privilege('authenticated', 'public.cards', 'INSERT') then
    raise exception 'authenticated must have INSERT on public.cards';
  end if;
  if not has_table_privilege('authenticated', 'public.categories', 'INSERT')
     or not has_table_privilege('authenticated', 'public.categories', 'UPDATE') then
    raise exception 'authenticated must have INSERT/UPDATE on public.categories';
  end if;
end
$$;
