import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const serviceSource = await readFile(new URL('./householdFinancialAccounts.ts', import.meta.url), 'utf8');
const migrationSource = await readFile(new URL('../../supabase/migrations/202609030011_accounts_cards_rls.sql', import.meta.url), 'utf8');
const screenSource = await readFile(new URL('../components/auth/HouseholdFinancialSetup.tsx', import.meta.url), 'utf8');

test('financial service derives writes from the authenticated household context', () => {
  assert.match(serviceSource, /household_id: householdId/);
  assert.doesNotMatch(serviceSource, /user_id|owner_user_id/);
  assert.match(screenSource, /household\.id/);
  assert.match(screenSource, /useSupabaseAuth/);
});

test('accounts and cards are scoped by active household RLS', () => {
  assert.match(migrationSource, /accounts_select[\s\S]*is_active_household_member\(household_id\)/);
  assert.match(migrationSource, /cards_select[\s\S]*is_active_household_member\(household_id\)/);
  assert.match(migrationSource, /accounts_insert[\s\S]*with check \(public\.is_active_household_member\(household_id\)\)/);
  assert.match(migrationSource, /cards_insert[\s\S]*with check \(public\.is_active_household_member\(household_id\)\)/);
});

test('cross-household member and payment-account links are rejected in the database', () => {
  assert.match(migrationSource, /member\.household_id = new\.household_id/);
  assert.match(migrationSource, /member\.deactivated_at is null/);
  assert.match(migrationSource, /account\.household_id = new\.household_id/);
  assert.match(migrationSource, /default payment account must belong to the same household/);
});

test('card ownership is not transaction responsibility', () => {
  assert.match(migrationSource, /owner_member_id e somente titularidade/);
  assert.match(screenSource, /não define comprador, responsável econômico ou pagador/);
  assert.doesNotMatch(serviceSource, /buyer_member_id|responsible_member_id|funder_member_id/);
});

test('legacy DatabaseStore remains outside the Supabase financial path', () => {
  assert.doesNotMatch(serviceSource, /DatabaseStore|ApiService|fetch\(['"]\/api/);
  assert.doesNotMatch(screenSource, /DatabaseStore|ApiService/);
});

test('household experience remains available and card default owner follows the session user', async () => {
  const householdScreen = await readFile(new URL('../components/auth/PendingHouseholdScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(householdScreen, /if \(false\)/);
  assert.match(householdScreen, /Contas e cartões/);
  assert.match(screenSource, /member\.profile_id === user\?\.id/);
  assert.doesNotMatch(screenSource, /householdMembers\[0\]/);
});