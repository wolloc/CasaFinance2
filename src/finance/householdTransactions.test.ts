import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const serviceSource = await readFile(new URL('./householdTransactions.ts', import.meta.url), 'utf8');
const migrationSource = await readFile(new URL('../../supabase/migrations/202609030013_transactions_rls.sql', import.meta.url), 'utf8');
const screenSource = await readFile(new URL('../components/auth/HouseholdTransactionsSetup.tsx', import.meta.url), 'utf8');
const householdSource = await readFile(new URL('../components/auth/PendingHouseholdScreen.tsx', import.meta.url), 'utf8');

test('active transaction listing is scoped to the household and excludes deleted rows', () => {
  assert.match(serviceSource, /eq\('household_id', householdId\)/);
  assert.match(serviceSource, /is\('deleted_at', null\)/);
  assert.match(screenSource, /listHouseholdTransactions\(supabase, household\.id\)/);
});

test('creator comes from the authenticated member and buyer is explicit', () => {
  assert.match(screenSource, /member\.profile_id === user\.id/);
  assert.match(screenSource, /creator\.id/);
  assert.match(serviceSource, /created_by_member_id: createdByMemberId/);
  assert.match(serviceSource, /buyer_member_id: type === 'expense' \? input\.buyerMemberId : null/);
  assert.doesNotMatch(serviceSource, /owner_member_id|owner_user_id/);
});

test('payment instrument selection remains independent from buyer', () => {
  assert.match(screenSource, /setBuyerMemberId/);
  assert.match(screenSource, /instrumentKind/);
  const instrumentInsert = serviceSource.match(/transaction_payment_instruments'\)\.insert\(\{([\s\S]*?)\}\)/)?.[1] ?? '';
  assert.doesNotMatch(instrumentInsert, /buyer_member_id/);
});

test('transaction RLS is scoped to active members without physical delete policy', () => {
  assert.match(migrationSource, /transactions_select[\s\S]*is_active_household_member\(household_id\)/);
  assert.match(migrationSource, /transactions_insert[\s\S]*with check \(public\.is_active_household_member\(household_id\)/);
  assert.match(migrationSource, /transactions_update[\s\S]*using \(public\.is_active_household_member\(household_id\)/);
  assert.match(migrationSource, /transaction_instruments_select[\s\S]*is_active_household_member\(household_id\)/);
  assert.doesNotMatch(migrationSource, /create policy[^\n]*for delete/i);
});

test('database validates all transaction references within the same household', () => {
  assert.match(migrationSource, /created_by_member_id/);
  assert.match(migrationSource, /buyer_member_id/);
  assert.match(migrationSource, /category_id/);
  assert.match(migrationSource, /account_id/);
  assert.match(migrationSource, /card_id/);
  assert.match(migrationSource, /m\.household_id = new\.household_id/);
  assert.match(migrationSource, /c\.household_id = new\.household_id/);
  assert.match(migrationSource, /a\.household_id = new\.household_id/);
  assert.match(migrationSource, /c\.household_id = new\.household_id/);
});

test('cancellation is soft delete and this stage excludes later financial modules', () => {
  assert.match(serviceSource, /deleted_at: new Date\(\)\.toISOString\(\)/);
  assert.match(serviceSource, /\.is\('deleted_at', null\)/);
  assert.match(screenSource, /O comprador é escolhido separadamente/);
  assert.doesNotMatch(serviceSource, /funding|split|invoice|installment|recurr|DatabaseStore|service_role/i);
  assert.doesNotMatch(screenSource, /funding|rateio|fatura|parcelamento|DatabaseStore|service_role/i);
  assert.match(householdSource, /Transações/);
});
