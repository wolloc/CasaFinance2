import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql=await readFile(new URL('../../supabase/migrations/20261001003000_household_timezone_financial_clock.sql',import.meta.url),'utf8');

test('financial clock follows household timezone instead of server current_date',()=>{
  assert.match(sql,/financial_household_today/);
  assert.match(sql,/timezone\(h\.timezone,now\(\)\)/);
  assert.match(sql,/financial_household_current_month/);
});

test('household and member projections share the same household financial month',()=>{
  assert.match(sql,/v_current_month date:=public\.financial_household_current_month\(p_household_id\)/);
  assert.match(sql,/v_current date:=public\.financial_household_current_month\(p_household_id\)/);
});

test('health and attention use household-local financial dates',()=>{
  assert.match(sql,/financial_household_health_position/);
  assert.match(sql,/public\.financial_household_current_month\(p_household_id\)/);
  assert.match(sql,/financial_attention_items/);
  assert.match(sql,/public\.financial_household_today\(p_household_id\)/);
});
