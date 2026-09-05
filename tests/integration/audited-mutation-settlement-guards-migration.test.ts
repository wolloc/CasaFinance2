import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/202609050036_audited_mutation_settlement_guards.sql'),
  'utf8',
);
const householdSource = fs.readFileSync(
  path.join(root, 'src/finance/householdTransactions.ts'),
  'utf8',
);

test('036 closes authenticated direct transaction update bypasses', () => {
  assert.match(sql, /revoke update on public\.transactions from public,anon,authenticated/);
  assert.match(sql, /create or replace function public\.update_basic_transaction/);
  assert.match(sql, /public\.correct_unrealized_transaction/);
  assert.match(sql, /buyer, notes or payment instrument changes require the dedicated audited edit flow/);
});

test('036 guards materialized recurring occurrences and member settlement effects', () => {
  assert.match(sql, /public\.recurring_occurrences/);
  assert.match(sql, /materialized recurring occurrence requires the dedicated recurrence correction flow/);
  assert.match(sql, /mse\.kind='responsibility_funding'/);
  assert.match(sql, /mse\.state='realized'/);
  assert.match(sql, /refund with realized member settlement effects requires a dedicated settlement-reversal flow/);
});

test('036 cancels projected acertos and reconciles corrected expense facts', () => {
  assert.match(sql, /set state='cancelled',updated_at=now\(\)/);
  assert.match(sql, /kind='responsibility_funding'/);
  assert.match(sql, /state='projected'/);
  assert.match(sql, /perform public\.reconcile_member_settlements\(new\.id\)/);
});

test('authenticated UI cancellation uses the audited cancellation RPC', () => {
  assert.match(householdSource, /rpc\('cancel_unrealized_transaction'/);
  assert.doesNotMatch(householdSource, /from\('transactions'\)\.update/);
});
