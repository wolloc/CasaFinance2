import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const sql=await readFile(new URL('../../supabase/migrations/202609060048_liquidity_coverage_guidance.sql',import.meta.url),'utf8');
test('free cash discounts commitments before future income',()=>{assert.match(sql,/free_cash_after_commitments/);assert.match(sql,/h\.current_cash-coalesce\(h\.remaining_commitments,0\)-coalesce\(h\.prior_pending_outflow,0\)/);});
test('coverage gap comes from canonical projected ending cash',()=>{assert.match(sql,/greatest\(-h\.projected_ending_cash,0\)/);assert.match(sql,/financial_household_health_position/);});
test('reserves and investments are options, never automatic available cash',()=>{assert.match(sql,/reserve_balance/);assert.match(sql,/investment_balance/);assert.match(sql,/never improve cash automatically/i);});
test('guidance is read only',()=>{assert.doesNotMatch(sql,/insert into public\./);assert.doesNotMatch(sql,/update public\./);assert.doesNotMatch(sql,/delete from public\./);});
