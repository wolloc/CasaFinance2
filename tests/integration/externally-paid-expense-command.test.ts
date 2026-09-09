import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../../supabase/migrations/202609090068_externally_paid_expense_command.sql', import.meta.url), 'utf8');
const service = await readFile(new URL('../../src/finance/externallyPaidExpense.ts', import.meta.url), 'utf8');

test('externally paid expense creates one economic fact and delegates external funding atomically', () => {
  assert.match(sql, /create_financial_transaction/);
  assert.match(sql, /record_external_expense_payment/);
  assert.match(sql, /create_externally_paid_expense/);
  assert.doesNotMatch(sql, /insert into public\.money_movements/);
  assert.doesNotMatch(sql, /insert into public\.funding_events/);
});

test('repayment is explicit and creates no payable when user says no', () => {
  assert.match(sql, /p_needs_repayment boolean/);
  assert.match(sql, /case when p_needs_repayment then 'reimbursement'/);
  assert.match(sql, /else 'gift'/);
  assert.match(sql, /repayment due date is required/);
});

test('command is household scoped, retry stable and rejects future expense dates', () => {
  assert.match(sql, /require_active_member\(p_household_id\)/);
  assert.match(sql, /financial_command_existing_or_lock/);
  assert.match(sql, /financial_command_store/);
  assert.match(sql, /p_transaction_date>current_date/);
  assert.match(sql, /active household external payer required/);
  assert.match(sql, /grant execute[\s\S]*to authenticated/);
});

test('frontend preserves buyer, responsibility and external payer as separate inputs', () => {
  assert.match(service, /buyerMemberId/);
  assert.match(service, /responsibility/);
  assert.match(service, /payerPartyId/);
  assert.match(service, /needsRepayment/);
  assert.match(service, /create_externally_paid_expense/);
  assert.match(service, /runRetryStableRpc/);
});
