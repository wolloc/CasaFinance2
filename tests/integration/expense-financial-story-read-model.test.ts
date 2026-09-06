import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../../supabase/migrations/202609060043_expense_financial_story_read_model.sql', import.meta.url), 'utf8');
const constitution = await readFile(new URL('../../docs/casa-finance-constitution.md', import.meta.url), 'utf8');

test('expense story reads responsibility, funding, external payment and settlements from canonical ledgers', () => {
  assert.match(sql, /economic_allocations/);
  assert.match(sql, /funding_events/);
  assert.match(sql, /external_payment_events/);
  assert.match(sql, /member_settlement_events/);
});

test('remaining funding is derived from the effective economic amount without creating a new expense', () => {
  assert.match(sql, /financial_effective_total_amount/);
  assert.match(sql, /remaining_to_fund/);
  assert.match(sql, /member_funded_amount/);
  assert.match(sql, /external_paid_amount/);
  assert.doesNotMatch(sql, /insert into public\.transactions/);
});

test('read model is security invoker and never infers funder from buyer or account owner', () => {
  assert.match(sql, /security_invoker=true/);
  assert.doesNotMatch(sql, /buyer_member_id/);
  assert.doesNotMatch(sql, /owner_member_id/);
  assert.match(constitution, /Comprador, titular do instrumento, responsável econômico e pagador\/funder são independentes/);
});
