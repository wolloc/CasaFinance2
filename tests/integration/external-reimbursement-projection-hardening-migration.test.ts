import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/202609050032_external_reimbursement_projection_hardening.sql'),
  'utf8',
);

test('032 keeps reimbursement payables in projected funding', () => {
  assert.match(sql, /c\.source_obligation_id is null and c\.source_installment_id is null/);
  assert.match(sql, /Reimbursement payables remain separate future household funding commitments/);
});

test('032 rejects partial reimbursement until residual expense commitments are explicit', () => {
  assert.match(sql, /create or replace function public\.reject_partial_external_reimbursement/);
  assert.match(sql, /new\.intent <> 'reimbursement'/);
  assert.match(sql, /member_funded \+ external_before \+ new\.amount <> applicable_amount/);
  assert.match(sql, /partial reimbursement is not supported until residual expense commitments are modeled explicitly/);
  assert.match(sql, /before insert on public\.external_payment_events/);
});

test('032 resolves exact borrowed-loan retries before mutable active-reference checks', () => {
  const lockAt = sql.indexOf("pg_advisory_xact_lock(hashtextextended(p_household_id::text||':borrowed-loan:'");
  const existingAt = sql.indexOf('select * into existing from public.financial_obligations');
  const returnAt = sql.indexOf('return existing.id;');
  const lenderValidationAt = sql.indexOf("active household lender party required");
  const accountValidationAt = sql.indexOf("active household destination account required");

  assert.ok(lockAt >= 0);
  assert.ok(existingAt > lockAt);
  assert.ok(returnAt > existingAt);
  assert.ok(lenderValidationAt > returnAt);
  assert.ok(accountValidationAt > returnAt);
});
