import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../../supabase/migrations/20260925170500_monthly_expense_recurrence_release1.sql', import.meta.url),
  'utf8',
);

test('Release 1 guards new and revised expense recurrence as monthly interval one', () => {
  assert.match(migration, /enforce_release1_monthly_expense_recurrence/);
  assert.match(migration, /template_type='expense'/);
  assert.match(migration, /new\.frequency<>'monthly'/);
  assert.match(migration, /new\.interval_count<>1/);
  assert.match(migration, /Release 1 expense recurrence must be monthly with interval 1/);
  assert.match(migration, /before insert or update of[\s\S]*frequency,[\s\S]*interval_count/);
});

test('Release 1 recurrence guard remains scoped to expenses, not income recurrence', () => {
  assert.match(migration, /new\.income_nature is null/);
  assert.match(migration, /select t\.type[\s\S]*from public\.transactions/);
  assert.doesNotMatch(migration, /new\.income_nature is not null[\s\S]*raise exception/);
});

test('settlement reconciliation waits for complete economic allocations', () => {
  assert.match(migration, /allocation_percentage<>100/);
  assert.match(migration, /round\(allocation_amount,2\)<>round\(expected_amount,2\)/);
  assert.match(migration, /perform public\.reconcile_member_settlements\(tx_id\)/);
});

test('allocation rescale avoids no-op updates that would trigger redundant reconciliation', () => {
  const rescale = migration.slice(
    migration.indexOf('create or replace function public.rescale_economic_allocations'),
    migration.indexOf('create or replace function public.trigger_reconcile_member_settlements'),
  );
  assert.match(rescale, /a\.amount is distinct from f\.amount/);
  assert.match(rescale, /s\.amount is distinct from a\.amount/);
});

test('legacy non-monthly expense rows can still be closed without rewriting recurrence fields', () => {
  assert.match(migration, /before insert or update of[\s\S]*frequency,[\s\S]*interval_count,[\s\S]*template_transaction_id,[\s\S]*income_nature/);
  assert.doesNotMatch(migration, /update of[\s\S]*end_date/);
  assert.doesNotMatch(migration, /update of[\s\S]*deactivated_at/);
});
