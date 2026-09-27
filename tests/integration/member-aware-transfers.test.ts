import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const adjustment=await readFile(new URL('../../src/components/app/NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const transfers=await readFile(new URL('../../src/finance/resourceTransfers.ts',import.meta.url),'utf8');
const hub=await readFile(new URL('../../src/components/app/SettlementHub.tsx',import.meta.url),'utf8');
const migration=await readFile(new URL('../../supabase/migrations/20260927160500_member_position_transfers.sql',import.meta.url),'utf8');

test('cross-member transfers default to affecting the continuous member position',()=>{
  assert.match(adjustment,/memberTransferContext/);
  assert.match(adjustment,/setAffectMemberPosition\(Boolean\(memberTransferContext\)\)/);
  assert.match(adjustment,/Considerar na posição entre vocês/);
  assert.match(adjustment,/marcada por padrão|considera este movimento na posição líquida entre vocês por padrão/i);
  assert.match(adjustment,/createMemberPositionTransfer/);
  assert.match(adjustment,/createResourceTransfer/);
});

test('member-aware transfer remains one neutral cash movement and creates no income or expense',()=>{
  assert.match(transfers,/create_member_position_transfer_idempotent/);
  assert.match(migration,/type,status,description,amount/);
  assert.match(migration,/'transfer','paid'/);
  assert.match(migration,/'member_settlement','realized'/);
  assert.match(migration,/source_money_movement_id/);
  assert.doesNotMatch(migration,/type,status[^;]*'income'|type,status[^;]*'expense'/);
});

test('position transfer can cross zero instead of rejecting an over-settlement',()=>{
  assert.doesNotMatch(migration,/settlement exceeds realized outstanding position/);
  assert.match(migration,/debtor_member_id,creditor_member_id/);
  assert.match(migration,/destination_owner,source_owner,p_amount/);
  assert.match(hub,/Number\(row\.net_position\)>0/);
  assert.match(hub,/money\(row\.net_position\)/);
});

test('Home explains both directions of a member pair using net effects',()=>{
  assert.match(hub,/oppositeOf/);
  assert.match(hub,/eventsFor/);
  assert.match(hub,/Transferência entre vocês/);
  assert.match(hub,/eventImpact\(event,row\)/);
});
