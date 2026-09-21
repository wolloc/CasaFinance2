import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const migration=fs.readFileSync('supabase/migrations/202609210105_security_advisor_search_path_hardening.sql','utf8');

test('release security hardening pins legacy trigger function search paths',()=>{
  assert.match(migration,/alter function public\.assert_transaction_splits_total\(\)[\s\S]*set search_path = public, pg_temp/);
  assert.match(migration,/alter function public\.enforce_two_active_household_members\(\)[\s\S]*set search_path = public, pg_temp/);
});
