import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/202609050031_liability_external_payer_hardening.sql'),
  'utf8',
);

test('031 serializes retries and validates effectful borrowed-loan payload', () => {
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(p_household_id::text\|\|':borrowed-loan:'/);
  assert.match(sql, /existing\.due_date is distinct from p_due_date/);
  assert.match(sql, /m\.destination_account_id=p_destination_account_id/);
  assert.match(sql, /m\.realized_at=p_borrowed_at/);
  assert.match(sql, /existing\.notes is distinct from p_notes/);
});

test('031 validates reimbursement replay terms', () => {
  assert.match(sql, /existing\.notes is distinct from p_notes/);
  assert.match(sql, /o\.due_date is not distinct from p_due_date/);
  assert.match(sql, /o\.notes is not distinct from p_notes/);
  assert.match(sql, /:external-payment:/);
});

test('031 rejects all known card-backed external-payment routes', () => {
  assert.match(sql, /transaction_payment_instruments[\s\S]*?pi\.kind='card'/);
  assert.match(sql, /tx\.invoice_id is not null/);
  assert.match(sql, /installment_plans[\s\S]*?ins\.invoice_id is not null/);
  assert.match(sql, /financing_allocations[\s\S]*?card_purchase[\s\S]*?card_pix/);
});

test('031 removes external settlement from future funding without inventing member funder', () => {
  assert.match(sql, /create or replace view public\.financial_projected_funding_routes/);
  assert.match(sql, /sum\(e\.amount\)[\s\S]*?public\.external_payment_events e/);
  assert.doesNotMatch(sql, /insert into public\.funding_events[\s\S]*?external_payment_events/);
});
