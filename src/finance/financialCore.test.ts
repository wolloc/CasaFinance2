import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migration = await readFile(new URL('../../supabase/migrations/202609030014_financial_core_consolidation.sql', import.meta.url), 'utf8');
const service = await readFile(new URL('./financialCore.ts', import.meta.url), 'utf8');
const coreScreen = await readFile(new URL('../components/auth/HouseholdFinancialCoreSetup.tsx', import.meta.url), 'utf8');

test('core operations use authenticated-household RPCs', () => {
  assert.match(service, /create_expense_bundle/);
  assert.match(service, /create_income_transaction/);
  assert.match(service, /create_transfer/);
  assert.match(service, /pay_card_invoice/);
  assert.match(service, /create_recurring_rule/);
  assert.match(service, /generate_recurring_occurrence/);
  assert.match(service, /p_household_id: input\.householdId/);
  assert.doesNotMatch(service, /DatabaseStore|ApiService|service_role/);
});

test('financial core has household-scoped RLS and no physical delete policies', () => {
  assert.match(migration, /FOR SELECT TO authenticated USING \(public\.is_active_household_member\(household_id\)\)/);
  assert.match(migration, /FOR INSERT TO authenticated WITH CHECK \(public\.is_active_household_member\(household_id\)\)/);
  assert.match(migration, /FOR UPDATE TO authenticated USING \(public\.is_active_household_member\(household_id\)/);
  assert.doesNotMatch(migration, /CREATE POLICY[^\n]+FOR DELETE/i);
});

test('expense bundle is atomic and preserves independent roles', () => {
  assert.match(migration, /INSERT INTO public\.transactions/);
  assert.match(migration, /INSERT INTO public\.transaction_payment_instruments/);
  assert.match(migration, /INSERT INTO public\.transaction_splits/);
  assert.match(migration, /created_by_member_id/);
  assert.match(migration, /p_buyer_member_id/);
  assert.match(migration, /SECURITY DEFINER SET search_path = public, pg_temp/);
  assert.match(migration, /splits must equal expense total/);
  assert.match(coreScreen, /Responsável econômico/);
  assert.match(migration, /card_invoices/);
  assert.match(migration, /total_amount = public\.card_invoices\.total_amount \+ EXCLUDED\.total_amount/);
});

test('installments, invoice payment, transfers and recurrence have atomic entry points', () => {
  assert.match(migration, /installment_plans/);
  assert.match(migration, /installments/);
  assert.match(migration, /card_invoice_payments/);
  assert.match(migration, /funding_events/);
  assert.match(migration, /create_transfer/);
  assert.match(migration, /ON CONFLICT \(recurring_rule_id, competence_date\)/);
  assert.match(migration, /generated_transaction_id/);
  assert.match(migration, /floor\(p_amount \* 100 \/ p_installment_count\)/);
  assert.match(migration, /Liquidação de fatura; não cria nova despesa/);
});
