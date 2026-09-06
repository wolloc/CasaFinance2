import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const priority=await readFile(new URL('../../src/components/app/FinancialPriorityCenter.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const settlements=await readFile(new URL('../../src/finance/memberSettlements.ts',import.meta.url),'utf8');
const adjustment=await readFile(new URL('../../src/components/app/NewAdjustmentScreen.tsx',import.meta.url),'utf8');

test('overdue scheduled member settlement carries its exact schedule identity',()=>{
  assert.match(priority,/overdue_member_settlement/);
  assert.match(priority,/member_settlement_schedule/);
  assert.match(priority,/kind:'member-settlement-schedule',scheduleId:item\.entity_id/);
  assert.match(priority,/Resolver este acerto/);
});

test('schedule context is reread and bounded by the current realized position',()=>{
  assert.match(settlements,/from\('member_settlement_schedules'\)/);
  assert.match(settlements,/state !== 'scheduled'/);
  assert.match(settlements,/listMemberSettlementPositions/);
  assert.match(settlements,/Math\.min\(Number\(schedule\.data\.amount\), realizedOutstanding\)/);
});

test('home navigation only creates canonical member settlement intent',()=>{
  assert.match(app,/getScheduledMemberSettlementContext/);
  assert.match(app,/openSettlementAction\(\{kind:'members'/);
  assert.doesNotMatch(priority,/settleMemberPosition|rpc\(/);
  assert.match(adjustment,/numeric>realizedOutstanding/);
  assert.match(adjustment,/settleMemberPosition/);
});
