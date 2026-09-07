import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql=await readFile(new URL('../../supabase/migrations/202609060062_payable_debt_forgiveness.sql',import.meta.url),'utf8');

test('payable forgiveness reduces a real payable and creates one economic gain',()=>{
  assert.match(sql,/function public\.forgive_payable_obligation/);
  assert.match(sql,/obligation\.kind<>'payable'/);
  assert.match(sql,/insert into public\.transactions[\s\S]+\'income\'[\s\S]+\'realized\'/);
  assert.match(sql,/insert into public\.transaction_components[\s\S]+\'other\'/);
  assert.match(sql,/insert into public\.obligation_events[\s\S]+\'write_off\'/);
});

test('forgiveness never pretends payment, funding or cash',()=>{
  assert.doesNotMatch(sql,/insert into public\.money_movements\s*\(/i);
  assert.doesNotMatch(sql,/insert into public\.funding_events\s*\(/i);
  assert.match(sql,/perdão não é pagamento/i);
});

test('benefit allocation is explicit, authenticated and idempotent',()=>{
  assert.match(sql,/public\.require_active_member\(p_household_id\)/);
  assert.match(sql,/forgiveness requires explicit beneficiary allocations/);
  assert.match(sql,/forgiveness allocations must equal amount and 100 percent/);
  assert.match(sql,/unique \(household_id, request_key\)/);
  assert.match(sql,/forgiveness beneficiary must be an active household member/);
});

test('forgiveness cannot exceed remaining liability and preserves history',()=>{
  assert.match(sql,/already_reduced\+p_amount>obligation\.original_amount/);
  assert.match(sql,/create table if not exists public\.payable_forgiveness_events/);
  assert.match(sql,/state=case when already_reduced\+p_amount=original_amount then 'written_off' else 'partially_settled' end/);
});
