import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const migration = await readFile(
  new URL('../../supabase/migrations/202609120072_defer_installment_settlement_reconcile.sql', import.meta.url),
  'utf8',
);

test('installment settlement reconciliation waits until the plan is complete on insert', () => {
  assert.match(migration, /create or replace function public\.trigger_reconcile_member_settlements\(\)/i);
  assert.match(migration, /tg_table_name\s*=\s*'installments'/i);
  assert.match(migration, /select\s+p\.purchase_transaction_id\s*,\s*p\.installment_count/i);
  assert.match(migration, /select\s+count\(\*\)::integer[\s\S]*from public\.installments/i);
  assert.match(migration, /if\s+actual_count\s*<\s*expected_count\s+then\s+return null/i);
  assert.match(migration, /perform public\.reconcile_member_settlements\(tx_id\)/i);
});

test('later installment updates still reconcile immediately', () => {
  assert.match(migration, /if\s+tg_op\s*=\s*'INSERT'\s+then/i);
  assert.doesNotMatch(migration, /if\s+tg_op\s+in\s*\([^)]*'UPDATE'/i);
});
