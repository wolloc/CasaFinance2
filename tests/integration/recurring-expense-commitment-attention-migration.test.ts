import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql=await readFile(new URL('../../supabase/migrations/202609060046_recurring_expense_commitment_attention.sql',import.meta.url),'utf8');

test('046 exposes near-due recurring occurrences as read-only attention positions',()=>{
  assert.match(sql,/financial_recurring_expense_attention_positions/);
  assert.match(sql,/c\.due_date<=current_date\+7/);
  assert.match(sql,/c\.remaining_amount>0/);
  assert.match(sql,/source_type='recurring_occurrence'/);
});

test('confirming occurrence is auditable and changes amount without creating cash',()=>{
  const confirm=sql.slice(sql.indexOf('confirm_recurring_expense_occurrence'),sql.indexOf('create or replace function public.settle_recurring_expense_occurrence'));
  assert.match(confirm,/transaction_adjustment_events/);
  assert.match(confirm,/confirm_financial_transaction/);
  assert.match(confirm,/recurring_occurrence_id/);
  assert.doesNotMatch(confirm,/insert into public\.money_movements/);
  assert.doesNotMatch(confirm,/insert into public\.funding_events/);
});

test('settlement delegates to canonical direct expense Funding + Caixa',()=>{
  const settle=sql.slice(sql.indexOf('settle_recurring_expense_occurrence'),sql.indexOf('create or replace view public.financial_recurring_expense_attention_positions'));
  assert.match(settle,/public\.settle_direct_expense/);
  assert.doesNotMatch(settle,/insert into public\.money_movements/);
  assert.doesNotMatch(settle,/insert into public\.funding_events/);
});

test('planned account remains context and is not forced as actual cash source',()=>{
  assert.match(sql,/pi\.account_id as planned_account_id/);
  assert.match(sql,/p_source_account_id/);
  assert.match(sql,/planned account is context only until explicit settlement/i);
});

test('authenticated-only surface keeps household isolation',()=>{
  assert.match(sql,/security_invoker=true/);
  assert.match(sql,/revoke all on public\.financial_recurring_expense_attention_positions from public,anon/);
  assert.match(sql,/grant select on public\.financial_recurring_expense_attention_positions to authenticated/);
});
