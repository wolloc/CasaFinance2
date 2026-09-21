import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const migration=fs.readFileSync('supabase/migrations/202609210102_fix_income_settlement_enum_typing.sql','utf8');

test('income settlement keeps economic_state as the canonical enum',()=>{
  assert.match(migration,/'realized'::public\.economic_state/);
  assert.match(migration,/'confirmed'::public\.economic_state/);
  assert.match(migration,/create or replace function public\.settle_income/);
});
