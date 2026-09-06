import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../../supabase/migrations/202609060045_explicit_expense_creation_journey.sql', import.meta.url), 'utf8');

test('paid-now expense creates one economic fact then settles it canonically', () => {
  assert.match(sql, /create or replace function public\.create_and_settle_direct_expense/);
  assert.match(sql, /public\.create_financial_transaction[\s\S]*public\.settle_direct_expense/);
  assert.doesNotMatch(sql, /insert into public\.funding_events/);
  assert.doesNotMatch(sql, /insert into public\.money_movements/);
});

test('command requires explicit account and funder inputs instead of inference', () => {
  assert.match(sql, /p_source_account_id uuid/);
  assert.match(sql, /p_funder_member_id uuid/);
  assert.match(sql, /Never infers funder from buyer, instrument or account ownership/);
});

test('command is authenticated-only and invoker security', () => {
  assert.match(sql, /security invoker/);
  assert.match(sql, /revoke all on function public\.create_and_settle_direct_expense[\s\S]*from public,anon/);
  assert.match(sql, /grant execute on function public\.create_and_settle_direct_expense[\s\S]*to authenticated/);
});
