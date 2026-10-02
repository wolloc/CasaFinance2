import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const settings=await readFile(new URL('../../src/components/app/SettingsScreen.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const migration=await readFile(new URL('../../supabase/migrations/20261001215000_manage_household_members.sql',import.meta.url),'utf8');

test('Casa e membros lets owner remove another member without deleting history',()=>{
  assert.match(settings,/Retirar .* da Casa/);
  assert.match(settings,/Retirar da Casa/);
  assert.match(settings,/histórico foi preservado/);
  assert.match(settings,/deactivate_household_member/);
});

test('owner cannot remove themselves through the member management RPC',()=>{
  assert.match(migration,/owner cannot remove themselves from the household/);
  assert.match(migration,/deactivated_at=now\(\)/);
  assert.doesNotMatch(migration,/delete from public\.household_members/);
});

test('removed financial perspective falls back to Nossa Casa',()=>{
  assert.match(app,/perspective!=='household'/);
  assert.match(app,/!householdMembers\.some\(member=>member\.id===perspective\)/);
  assert.match(app,/setPerspective\('household'\)/);
});

test('reinvite reactivates the historical membership row',()=>{
  assert.match(migration,/set deactivated_at=null, role='member', joined_at=now\(\)/);
  assert.match(migration,/existing_membership/);
});
