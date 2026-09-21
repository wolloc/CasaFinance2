import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const migration=fs.readFileSync('supabase/migrations/202609210103_fix_income_settlement_status_enum.sql','utf8');

test('income settlement keeps both canonical state enums typed',()=>{
  assert.match(migration,/'realized'::public\.economic_state/);
  assert.match(migration,/'confirmed'::public\.economic_state/);
  assert.match(migration,/'received'::public\.transaction_state/);
  assert.match(migration,/'pending'::public\.transaction_state/);
});
