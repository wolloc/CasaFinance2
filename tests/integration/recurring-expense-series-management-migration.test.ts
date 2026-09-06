import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../../supabase/migrations/202609060042_recurring_expense_series_management.sql', import.meta.url), 'utf8');
const constitution = await readFile(new URL('../../docs/casa-finance-constitution.md', import.meta.url), 'utf8');

test('recurring expense revisions are prospective and auditable', () => {
  assert.match(sql, /recurring_expense_series_events/);
  assert.match(sql, /kind in \('revision','closure'\)/);
  assert.match(sql, /p_effective_from<current_date/);
  assert.match(sql, /successor_rule_id/);
  assert.match(sql, /before_snapshot/);
  assert.match(sql, /after_snapshot/);
});

test('series change blocks already concrete downstream financial effects', () => {
  for (const dependency of ['funding_events','financial_obligations','external_payment_events','installment_plans','member_settlement_events']) assert.match(sql, new RegExp(dependency));
  assert.match(sql, /t\.invoice_id is not null/);
  assert.match(sql, /mse\.state='realized'/);
  assert.match(sql, /realized_amount>0/);
});

test('future cancellation preserves history instead of deleting financial facts', () => {
  assert.match(sql, /economic_state='cancelled'/);
  assert.match(sql, /status='cancelled'/);
  assert.doesNotMatch(sql, /delete from public\.transactions/);
  assert.doesNotMatch(sql, /delete from public\.recurring_occurrences/);
  assert.match(constitution, /O passado financeiro não é apagado/);
});

test('revision preserves template roles and only changes future schedule and amount', () => {
  assert.match(sql, /r\.template_transaction_id,p_frequency,p_interval_count,p_effective_from/);
  assert.doesNotMatch(sql, /buyer_member_id\s*=/);
  assert.doesNotMatch(sql, /transaction_payment_instruments\s+set/);
  assert.doesNotMatch(sql, /economic_allocations\s+set/);
});
