import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/202609050035_correction_refund_consistency_hardening.sql'),
  'utf8',
);

test('035 rescales economic allocations when an unrealized amount is corrected', () => {
  assert.match(sql, /rescale_economic_allocations\(tx\.id,p_amount\)/);
  assert.match(sql, /economic_allocations/);
  assert.match(sql, /preserve the existing percentages\/order/i);
});

test('035 routes a direct refund to the single account that actually funded it', () => {
  assert.match(sql, /count\(distinct f\.source_account_id\)/);
  assert.match(sql, /max\(f\.source_account_id::text\)::uuid/);
  assert.match(sql, /f\.source_account_id is null/);
  assert.match(sql, /funding_account_count<>1 or source_account is null/);
  assert.match(sql, /destination_account_id/);
  assert.match(sql, /'refund','realized'/);
});

test('035 preserves exact refund replay and safe route boundaries', () => {
  assert.match(sql, /existing\.occurred_at<>p_refunded_at/);
  assert.match(sql, /only full direct refunds are supported/);
  assert.match(sql, /external_payment_events/);
  assert.match(sql, /installment_plans/);
  assert.doesNotMatch(sql, /type[^\n]*'income'/);
});
