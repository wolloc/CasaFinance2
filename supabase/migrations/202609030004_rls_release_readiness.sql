-- Defesa em profundidade: toda entidade financeira fica isolada pela casa.
create or replace function public.is_active_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members member
    where member.household_id = target_household_id
      and member.profile_id = auth.uid()
      and member.deactivated_at is null
  );
$$;
revoke all on function public.is_active_household_member(uuid) from public;
grant execute on function public.is_active_household_member(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'household_members', 'accounts', 'cards', 'categories', 'transactions',
    'transaction_splits', 'transaction_payment_instruments', 'card_invoices',
    'funding_events', 'transfers', 'card_invoice_payments', 'recurring_rules',
    'recurring_occurrences', 'installment_plans', 'installments', 'loans',
    'loan_installments', 'money_movements', 'loan_contracts', 'loan_payment_schedule'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('drop policy if exists household_isolation on public.%I', table_name);
    execute format(
      'create policy household_isolation on public.%I for all to authenticated using (public.is_active_household_member(household_id)) with check (public.is_active_household_member(household_id))',
      table_name
    );
  end loop;
end $$;

alter table public.households enable row level security;
alter table public.households force row level security;
drop policy if exists household_isolation on public.households;
create policy household_isolation on public.households for all to authenticated
using (public.is_active_household_member(id))
with check (public.is_active_household_member(id));
