import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
const migration=await readFile(new URL('../../supabase/migrations/202609200100_resource_entry_after_household_cutoff.sql',import.meta.url),'utf8');
test('later resource preserves immutable household start',()=>{assert.match(migration,/elsif p_effective_date<household_start/);assert.doesNotMatch(migration,/set_household_financial_tracking_start\(p_household_id,p_effective_date\);\s*owner_count/);});
test('later resource starts with neutral opening position',()=>{assert.match(migration,/kind,amount,effective_date,description/);assert.match(migration,/'opening',p_opening_amount,p_effective_date/);assert.doesNotMatch(migration,/money_movements|funding_events|create_financial_transaction/);});
test('resource cannot predate household or start in future',()=>{assert.match(migration,/p_effective_date>current_date/);assert.match(migration,/p_effective_date<household_start/);});
