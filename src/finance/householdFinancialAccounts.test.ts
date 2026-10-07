import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const serviceSource = await readFile(new URL('./householdFinancialAccounts.ts', import.meta.url), 'utf8');
const migrationSource = await readFile(new URL('../../supabase/migrations/202609030011_accounts_cards_rls.sql', import.meta.url), 'utf8');
const screenSource = await readFile(new URL('../components/auth/HouseholdFinancialSetup.tsx', import.meta.url), 'utf8');
const openingCardModalSource = await readFile(new URL('../components/auth/OpeningCardCommitmentsModal.tsx', import.meta.url), 'utf8');

test('financial onboarding derives writes from the authenticated household context and canonical commands', () => {
  assert.match(serviceSource, /p_household_id: householdId/);
  assert.match(serviceSource, /create_account_with_opening_position_idempotent/);
  assert.match(serviceSource, /record_opening_card_purchase_idempotent/);
  assert.match(serviceSource, /record_opening_card_balance_adjustment_idempotent/);
  assert.doesNotMatch(serviceSource, /from\('accounts'\)\.insert/);
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
  assert.match(screenSource, /Titular do cartão/);
  assert.match(screenSource, /Titular do cartão/);
  const cardRegistrationSource = serviceSource.slice(0, serviceSource.indexOf('export async function recordOpeningCardPurchase'));
  assert.doesNotMatch(cardRegistrationSource, /buyer_member_id|responsible_member_id|funder_member_id/);
  assert.match(serviceSource, /p_buyer_member_id/);
  const identityEdit = serviceSource.slice(serviceSource.indexOf('export async function updateHouseholdCardIdentity'), serviceSource.indexOf('export async function recordOpeningCardPurchase'));
  assert.doesNotMatch(identityEdit, /owner_member_id|buyer_member_id|responsible_member_id|funder_member_id/);
  for (const field of ['credit_limit','closing_day','due_day']) assert.match(identityEdit, new RegExp(field));
  assert.match(screenSource, /Limite do cartão/);
  assert.match(screenSource, /Dia em que fecha/);
  assert.match(screenSource, /Dia em que vence/);
  assert.match(screenSource, /Compras e faturas já registradas não são reescritas/);
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

test('opening positions stay separate from ordinary financial registration UX', () => {
  assert.match(screenSource, /A partir de que data você começa a acompanhar suas finanças/);
  assert.match(screenSource, /OpeningCardCommitmentsModal/);
  assert.match(screenSource, /Já existem compras neste cartão/);
  assert.doesNotMatch(screenSource, /Da Casa \/ compartilhada/);
});

test('opening card UX preserves detailed facts or explicitly keeps history aggregated', () => {
  assert.match(openingCardModalSource, /recordOpeningCardPurchase/);
  assert.match(openingCardModalSource, /recordOpeningCardBalance/);
  assert.match(openingCardModalSource, /Quem fez a compra/);
  assert.match(openingCardModalSource, /Quem fica responsável economicamente/);
  assert.match(openingCardModalSource, /não inventará quem comprou, categoria ou responsabilidade/);
  assert.match(openingCardModalSource, /pelo menos uma parcela em aberto/);
});