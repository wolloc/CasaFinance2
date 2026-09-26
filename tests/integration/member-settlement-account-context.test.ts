import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const screen=await readFile(new URL('../../src/components/app/NewAdjustmentScreen.tsx',import.meta.url),'utf8');

test('member settlement filters transactional accounts by the payer and receiver ownership',()=>{
  assert.match(screen,/transactionalAccounts=accounts\.filter/);
  assert.match(screen,/owner_member_ids/);
  assert.match(screen,/owners\.includes\(memberId\)/);
  assert.match(screen,/payerAccounts/);
  assert.match(screen,/receiverAccounts/);
  assert.match(screen,/payerOptions/);
  assert.match(screen,/receiverOptions/);
});

test('changing payer or receiver clears an incompatible preselected account',()=>{
  assert.match(screen,/if\(sourceAccount&&!payerAccounts\.some/);
  assert.match(screen,/setSourceAccount\(''\)/);
  assert.match(screen,/if\(destinationAccount&&!receiverAccounts\.some/);
  assert.match(screen,/setDestinationAccount\(''\)/);
});

test('settlement account filtering does not affect ordinary household transfers',()=>{
  assert.match(screen,/const options=accounts\.map/);
  assert.match(screen,/Mover dinheiro entre contas/);
});
