import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql=await readFile(new URL('../../supabase/migrations/202609060047_recurring_attention_home.sql',import.meta.url),'utf8');

test('047 adds near-due recurring expenses to canonical attention',()=>{
  assert.match(sql,/recurring_expense_due/);
  assert.match(sql,/financial_recurring_expense_attention_positions/);
  assert.match(sql,/due_today/);
  assert.match(sql,/due_soon/);
});

test('overdue recurring expenses stay deduplicated in canonical overdue commitment path',()=>{
  assert.match(sql,/not \(r\.attention_state='overdue'\)/);
  assert.match(sql,/c\.is_overdue/);
});

test('attention remains a read model and does not realize cash',()=>{
  assert.doesNotMatch(sql,/insert into public\.money_movements/);
  assert.doesNotMatch(sql,/insert into public\.funding_events/);
  assert.match(sql,/never becomes realized cash by time alone/i);
});
