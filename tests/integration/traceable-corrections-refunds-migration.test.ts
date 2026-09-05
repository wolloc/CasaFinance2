import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/202609050033_traceable_corrections_refunds.sql'),
  'utf8',
);

test('033 adds immutable adjustment-event audit facts', () => {
  assert.match(sql, /create table if not exists public\.transaction_adjustment_events/);
  assert.match(sql, /before_payload jsonb/);
  assert.match(sql, /after_payload jsonb/);
  assert.match(sql, /unique\(household_id,request_key\)/);
  assert.doesNotMatch(sql, /delete from public\.transactions/i);
});

test('033 limits direct correction and cancellation to unrealized unlinked facts', () => {
  assert.match(sql, /correct_unrealized_transaction/);
  assert.match(sql, /cancel_unrealized_transaction/);
  assert.match(sql, /economic_state not in \('forecast','confirmed'\)/);
  assert.match(sql, /funding_events/);
  assert.match(sql, /external_payment_events/);
  assert.match(sql, /financial_obligations/);
  assert.match(sql, /installment_plans/);
  assert.match(sql, /linked financial facts require a dedicated correction command/);
});

test('033 full direct refund is a linked reversal and never income', () => {
  assert.match(sql, /refund_direct_expense/);
  assert.match(sql, /only full direct refunds are supported/);
  assert.match(sql, /transaction_payment_instruments[\s\S]*?kind='account'/);
  assert.match(sql, /insert into public\.transaction_links[\s\S]*?'refund'/);
  assert.match(sql, /insert into public\.money_movements[\s\S]*?'refund'/);
  assert.match(sql, /set economic_state='reversed',status='refunded'/);
  assert.doesNotMatch(sql, /type[^\n]*'income'/);
});

test('033 exposes gross, refunded and net expense position', () => {
  assert.match(sql, /financial_transaction_refund_positions/);
  assert.match(sql, /gross_amount/);
  assert.match(sql, /refunded_amount/);
  assert.match(sql, /net_amount/);
});

test('033 deliberately rejects unsafe partial/card/external refund routes', () => {
  assert.match(sql, /multiple or partial refunds require the dedicated partial-refund model/);
  assert.match(sql, /only direct account-paid expenses are supported/);
  assert.match(sql, /external_payment_events/);
  assert.match(sql, /refund route has linked card, obligation, or external-payer facts/);
});
