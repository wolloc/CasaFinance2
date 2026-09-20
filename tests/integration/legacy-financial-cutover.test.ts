import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../../supabase/migrations/202609200098_legacy_financial_cutover.sql', import.meta.url), 'utf8');
const service = await readFile(new URL('../../src/finance/householdFinancialAccounts.ts', import.meta.url), 'utf8');
const setup = await readFile(new URL('../../src/components/auth/HouseholdFinancialSetup.tsx', import.meta.url), 'utf8');
const cutover = await readFile(new URL('../../src/components/auth/LegacyFinancialCutover.tsx', import.meta.url), 'utf8');
const expenseWizard = await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx', import.meta.url), 'utf8');

test('legacy cutover uses the household financial timezone and keeps the cutoff immutable', () => {
  assert.match(migration, /current_timestamp at time zone household_timezone/);
  assert.match(migration, /financial tracking start must be today or earlier in household timezone/);
  assert.match(migration, /financial tracking start is immutable after configuration/);
  assert.match(migration, /revoke all on function public\.set_household_financial_tracking_start\(uuid,date\) from public,anon,authenticated/);
});

test('canonical account balances ignore only effects before the configured cutoff', () => {
  assert.match(migration, /e\.effective_date>=h\.financial_tracking_started_on/);
  assert.match(migration, /m\.movement_date>=h\.financial_tracking_started_on/);
  assert.match(migration, /h\.financial_tracking_started_on is null/);
});

test('legacy account reconciliation is explicit, complete and does not promote legacy fields', () => {
  const start = migration.indexOf('function public.reconcile_existing_accounts_at_cutoff(');
  const end = migration.indexOf('function public.reconcile_existing_accounts_at_cutoff_idempotent', start);
  const body = migration.slice(start, end);
  assert.match(body, /all active household accounts must be reconciled together/);
  assert.match(body, /legacy cutover cannot reinterpret an account that already has canonical opening/);
  assert.match(body, /set_account_ownerships/);
  assert.match(body, /record_account_opening_position/);
  assert.doesNotMatch(body, /\bopening_balance\b|\bowner_member_id\b/);
  assert.doesNotMatch(body, /insert into public\.transactions|insert into public\.money_movements|insert into public\.funding_events/);
});

test('cutover command is retry-idempotent and only the wrapper is exposed', () => {
  assert.match(migration, /financial_command_existing_or_lock/);
  assert.match(migration, /financial_command_store/);
  assert.match(migration, /revoke all on function public\.reconcile_existing_accounts_at_cutoff\(uuid,date,jsonb\) from public,anon,authenticated/);
  assert.match(migration, /grant execute on function public\.reconcile_existing_accounts_at_cutoff_idempotent\(uuid,date,jsonb,text\) to authenticated/);
  assert.match(service, /runRetryStableRpc\(client, 'legacy-financial-cutover'/);
  assert.match(service, /reconcile_existing_accounts_at_cutoff_idempotent/);
});

test('existing financial setup requires cutover before new accounts, cards or card openings', () => {
  assert.match(setup, /legacyCutoverRequired/);
  assert.match(setup, /financialSetupBlocked/);
  assert.match(setup, /<LegacyFinancialCutover/);
  assert.match(setup, /disabled=\{loading\|\|!!loadError\|\|financialSetupBlocked\}/);
  assert.match(setup, /disabled=\{financialSetupBlocked\}/);
});

test('cutover UX asks for confirmed values instead of displaying the legacy opening balance', () => {
  assert.match(cutover, /Quanto havia nesta conta no início desse dia/);
  assert.match(cutover, /De quem é esta conta/);
  assert.match(cutover, /Compartilhada entre/);
  assert.match(cutover, /não copiará automaticamente o saldo antigo cadastrado/);
  assert.doesNotMatch(cutover, /opening_balance/);
});


test('direct account expenses infer funding from canonical resource ownership without asking the user', () => {
  assert.match(expenseWizard, /selectedAccount\?\.owner_member_ids/);
  assert.doesNotMatch(expenseWizard, /Quem bancou esta saída\?/);
  assert.doesNotMatch(expenseWizard, /accountFunderMemberId/);
  assert.match(expenseWizard, /recurso é compartilhado/);
});
