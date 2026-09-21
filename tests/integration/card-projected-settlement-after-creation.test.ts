import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const migration=fs.readFileSync('supabase/migrations/202609210104_reconcile_card_settlements_after_creation.sql','utf8');

test('card installment creation closes with settlement reconciliation',()=>{
  assert.match(migration,/p_instrument_kind='card'/);
  assert.match(migration,/p_installment_count>1/);
  assert.match(migration,/perform public\.reconcile_member_settlements\(result\)/);
  assert.match(migration,/financial_command_store/);
});
