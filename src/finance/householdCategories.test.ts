import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const serviceSource = await readFile(new URL('./householdCategories.ts', import.meta.url), 'utf8');
const migrationSource = await readFile(new URL('../../supabase/migrations/202609030012_categories_rls.sql', import.meta.url), 'utf8');
const screenSource = await readFile(new URL('../components/auth/HouseholdCategoriesSetup.tsx', import.meta.url), 'utf8');
const householdSource = await readFile(new URL('../components/auth/PendingHouseholdScreen.tsx', import.meta.url), 'utf8');

test('categories are filtered and written with the authenticated household context', () => {
  assert.match(serviceSource, /eq\('household_id', householdId\)/);
  assert.match(serviceSource, /household_id: householdId/);
  assert.doesNotMatch(serviceSource, /user_id|service_role|DatabaseStore|ApiService/);
  assert.match(householdSource, /setActiveArea\('categories'\)/);
});

test('categories RLS isolates active household members', () => {
  assert.match(migrationSource, /categories_select[\s\S]*is_active_household_member\(household_id\)/);
  assert.match(migrationSource, /categories_insert[\s\S]*with check \(public\.is_active_household_member\(household_id\)\)/);
  assert.match(migrationSource, /categories_update[\s\S]*using \(public\.is_active_household_member\(household_id\)/);
  assert.match(migrationSource, /categories_delete[\s\S]*using \(public\.is_active_household_member\(household_id\)/);
});

test('category deactivation is a soft delete and never classifies financial roles', () => {
  assert.match(serviceSource, /deactivated_at: new Date\(\)\.toISOString\(\)/);
  assert.match(serviceSource, /is\('deactivated_at', null\)/);
  assert.match(screenSource, /O registro foi preservado/);
  assert.match(migrationSource, /soft delete/);
  assert.doesNotMatch(serviceSource, /buyer|payer|funder|card|account/);
});
