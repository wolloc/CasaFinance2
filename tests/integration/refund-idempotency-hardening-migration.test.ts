import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/202609050034_refund_idempotency_hardening.sql'),
  'utf8',
);

test('034 compares exact refund occurrence time during idempotent replay', () => {
  assert.match(sql, /existing\.occurred_at<>p_refunded_at/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /return existing\.id/);
});

test('034 preserves safe full direct refund boundaries', () => {
  assert.match(sql, /only full direct refunds are supported/);
  assert.match(sql, /only direct account-paid expenses are supported/);
  assert.match(sql, /refund requires fully realized direct member funding/);
  assert.match(sql, /set economic_state='reversed',status='refunded'/);
});
