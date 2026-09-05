import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const serviceSource = await readFile(new URL('./householdTransactions.ts', import.meta.url), 'utf8');
const migrationSource = await readFile(new URL('../../supabase/migrations/202609030013_transactions_rls.sql', import.meta.url), 'utf8');
const auditedMutationSource = await readFile(new URL('../../supabase/migrations/202609050036_audited_mutation_settlement_guards.sql', import.meta.url), 'utf8');
const screenSource = await readFile(new URL('../components/auth/HouseholdTransactionsSetup.tsx', import.meta.url), 'utf8');
const householdSource = await readFile(new URL('../components/auth/PendingHouseholdScreen.tsx', import.meta.url), 'utf8');

test('active transaction listing is scoped to the household and exposes financial state', () => {
  assert.match(serviceSource, /eq\('household_id', householdId\)/);
  assert.match(serviceSource, /is\('deleted_at', null\)/);
  assert.match(serviceSource, /economic_state/);
  assert.match(serviceSource, /realized_amount/);
  assert.match(serviceSource, /settled_at/);
  assert.match(screenSource, /listHouseholdTransactions\(supabase, household\.id\)/);
});

test('creator comes from the authenticated member and buyer is explicit', () => {
  assert.match(screenSource, /member\.profile_id === user\.id/);
  assert.match(screenSource, /const creator = householdMembers\.find/);
  assert.match(serviceSource, /rpc\('create_financial_transaction'/);
  assert.doesNotMatch(serviceSource, /created_by_member_id: createdByMemberId/);
  assert.match(serviceSource, /p_buyer_member_id: type === 'expense' \? input\.buyerMemberId : null/);
  assert.match(serviceSource, /p_household_id: householdId/);
  assert.doesNotMatch(serviceSource, /owner_member_id|owner_user_id/);
});

test('payment instrument selection remains independent from buyer', () => {
  assert.match(screenSource, /setBuyerMemberId/);
  assert.match(screenSource, /instrumentKind/);
});

test('transaction RLS is scoped to active members without physical delete policy', () => {
  assert.match(migrationSource, /transactions_select[\s\S]*is_active_household_member\(household_id\)/);
  assert.match(migrationSource, /transactions_insert[\s\S]*with check \(public\.is_active_household_member\(household_id\)/);
  assert.match(migrationSource, /transactions_update[\s\S]*using \(public\.is_active_household_member\(household_id\)/);
  assert.match(migrationSource, /transaction_instruments_select[\s\S]*is_active_household_member\(household_id\)/);
  assert.doesNotMatch(migrationSource, /create policy[^\n]*for delete/i);
  assert.match(auditedMutationSource, /revoke update on public\.transactions from public,anon,authenticated/);
});

test('database validates all transaction references within the same household', () => {
  assert.match(migrationSource, /created_by_member_id/);
  assert.match(migrationSource, /buyer_member_id/);
  assert.match(migrationSource, /category_id/);
  assert.match(migrationSource, /account_id/);
  assert.match(migrationSource, /card_id/);
  assert.match(migrationSource, /auth\.uid\(\)/);
  assert.match(migrationSource, /expense transaction requires a buyer/);
  assert.match(migrationSource, /income transaction cannot have a buyer/);
  assert.match(migrationSource, /exactly one payment instrument/);
  assert.match(migrationSource, /transaction creator cannot be changed/);
  assert.match(migrationSource, /transaction type cannot be changed/);
});

test('edit and cancellation use first-class audited commands', () => {
  assert.match(serviceSource, /rpc\('correct_unrealized_transaction'/);
  assert.match(serviceSource, /p_reason: 'Editado pelo usuário'/);
  assert.match(serviceSource, /rpc\('cancel_unrealized_transaction'/);
  assert.match(serviceSource, /p_reason: 'Cancelado pelo usuário'/);
  assert.doesNotMatch(serviceSource, /rpc\('update_basic_transaction'/);
  assert.doesNotMatch(serviceSource, /deleted_at: new Date\(\)\.toISOString\(\)/);
  assert.match(auditedMutationSource, /audit_id:=public\.correct_unrealized_transaction/);
});

test('direct realized expense refund uses the canonical refund command', () => {
  assert.match(serviceSource, /refundHouseholdDirectExpense/);
  assert.match(serviceSource, /rpc\('refund_direct_expense'/);
  assert.match(serviceSource, /p_amount: transaction\.realized_amount/);
  assert.match(serviceSource, /p_refunded_at: new Date\(\)\.toISOString\(\)/);
  assert.match(serviceSource, /transaction\.payment_instrument\?\.kind === 'account'/);
});

test('transaction history reads immutable adjustment events scoped to source transaction', () => {
  assert.match(serviceSource, /from\('transaction_adjustment_events'\)/);
  assert.match(serviceSource, /eq\('household_id', householdId\)/);
  assert.match(serviceSource, /eq\('source_transaction_id', transactionId\)/);
  assert.match(serviceSource, /order\('occurred_at', \{ ascending: true \}\)/);
});

test('shared expense usa RPC canônica com terceiro e financiador independentes', () => {
  assert.match(serviceSource, /create_and_settle_shared_expense/);
  assert.match(serviceSource, /party_id/);
  assert.match(serviceSource, /p_funder_member_id/);
  assert.match(serviceSource, /p_gross_amount/);
});

test('parcelamento desnecessário é evitado pelo contrato financeiro', () => {
  assert.match(serviceSource, /p_installment_count/);
  assert.match(screenSource, /instrumentKind === 'card' && <label[^>]*>Parcelas/);
  assert.match(screenSource, /if \(next === 'account'\) setInstallmentCount\(1\)/);
  assert.match(householdSource, /Transações/);
});
