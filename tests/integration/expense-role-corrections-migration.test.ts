import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql=await readFile(new URL('../../supabase/migrations/202609060059_expense_role_corrections.sql',import.meta.url),'utf8');

test('role correction preserves historical funding and cash',()=>{
  assert.match(sql,/Funding and cash are historical facts and remain untouched/i);
  assert.doesNotMatch(sql,/delete from public\.funding_events/i);
  assert.doesNotMatch(sql,/delete from public\.money_movements/i);
  assert.doesNotMatch(sql,/update public\.funding_events/i);
  assert.doesNotMatch(sql,/update public\.money_movements/i);
});

test('role correction records immutable before and after state',()=>{
  assert.match(sql,/expense_role_correction_events/);
  assert.match(sql,/before_buyer_member_id/);
  assert.match(sql,/after_buyer_member_id/);
  assert.match(sql,/before_responsibility/);
  assert.match(sql,/after_responsibility/);
  assert.match(sql,/unique\(household_id,request_key\)/);
});

test('responsibility remains independent and totals one hundred percent',()=>{
  assert.match(sql,/responsibility percentages must total 100/);
  assert.match(sql,/buyer_member_id=p_buyer_member_id/);
  assert.match(sql,/reconcile_member_settlements\(tx\.id\)/);
});

test('unsafe third party corrections are blocked instead of inferred',()=>{
  assert.match(sql,/third-party responsibility requires a dedicated correction route/);
  assert.match(sql,/responsible_party_id is not null/);
});
