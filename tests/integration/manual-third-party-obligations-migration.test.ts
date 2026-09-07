import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql=await readFile(new URL('../../supabase/migrations/202609060061_manual_third_party_obligations.sql',import.meta.url),'utf8');

test('manual third-party obligation creates an auditable authenticated command',()=>{
  assert.match(sql,/create table if not exists public\.manual_obligation_events/);
  assert.match(sql,/create or replace function public\.create_manual_third_party_obligation/);
  assert.match(sql,/public\.require_active_member\(p_household_id\)/);
  assert.match(sql,/unique \(household_id, request_key\)/);
  assert.match(sql,/grant execute on function public\.create_manual_third_party_obligation/);
});

test('manual obligation creates only commitment and history, never economic or cash facts',()=>{
  assert.match(sql,/insert into public\.financial_obligations/);
  assert.match(sql,/insert into public\.manual_obligation_events/);
  assert.doesNotMatch(sql,/insert into public\.transactions\s*\(/i);
  assert.doesNotMatch(sql,/insert into public\.money_movements\s*\(/i);
  assert.doesNotMatch(sql,/insert into public\.funding_events\s*\(/i);
  assert.match(sql,/Deliberadamente sem transactions, money_movements ou funding_events/);
});

test('manual obligation requires a real active counterparty and valid dates',()=>{
  assert.match(sql,/active household counterparty required/);
  assert.match(sql,/p_due_date<p_obligation_date/);
  assert.match(sql,/p_kind not in \('receivable','payable'\)/);
});
