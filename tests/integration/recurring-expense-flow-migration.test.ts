import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../../supabase/migrations/202609060041_recurring_expense_flow.sql', import.meta.url), 'utf8');
const engine = await readFile(new URL('../../supabase/migrations/202609040020_financial_engine_v1_rpcs.sql', import.meta.url), 'utf8');

test('recurring expense command requires an expense with explicit responsibility', () => {
  assert.match(sql, /type='expense'/);
  assert.match(sql, /economic_allocations/);
  assert.match(sql, /sum\(percentage\)/);
  assert.match(sql, /<>100/);
  assert.match(sql, /p_start_date<=tx\.transaction_date/);
});

test('recurring expense horizon delegates occurrence creation to canonical generator', () => {
  assert.match(sql, /generate_recurring_occurrence/);
  assert.match(sql, /not exists\(select 1 from public\.recurring_occurrences/);
  assert.match(engine, /template\.buyer_member_id/);
  assert.match(engine, /transaction_payment_instruments/);
  assert.match(engine, /economic_allocations/);
  assert.match(engine, /transaction_splits/);
});

test('dedicated command never creates funding or realized cash', () => {
  assert.doesNotMatch(sql, /insert into public\.funding_events/);
  assert.doesNotMatch(sql, /insert into public\.money_movements/);
  assert.match(sql, /no funder is inferred/i);
});
