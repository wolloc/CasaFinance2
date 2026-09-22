import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const hub=await readFile(new URL('./SettlementHub.tsx',import.meta.url),'utf8');
const adjustment=await readFile(new URL('./NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const thirdParty=await readFile(new URL('./ThirdPartySettlementAdjustment.tsx',import.meta.url),'utf8');

test('Home settlement hub separates realized from projected positions',()=>{
  assert.match(hub,/Entre nós · já realizado/);
  assert.match(hub,/Entre nós · previsto/);
  assert.match(hub,/Ainda não é dívida realizada/);
  assert.doesNotMatch(hub,/Resolver agora/);
  assert.match(hub,/O Casa acompanha esta diferença até que um acerto correspondente seja registrado/);
});

test('third-party obligations use human language and contextual actions',()=>{
  assert.match(hub,/deve para a Casa/);
  assert.match(hub,/A Casa deve para/);
  assert.match(hub,/Registrar recebimento/);
  assert.match(hub,/Registrar pagamento/);
  assert.match(hub,/Vence hoje/);
});

test('contextual navigation preselects but never auto-settles',()=>{
  assert.match(adjustment,/consumeSettlementActionIntent/);
  assert.match(adjustment,/nada será movimentado até você confirmar/);
  assert.match(adjustment,/initialObligationId/);
  assert.match(thirdParty,/Este acerto veio da Home e já foi localizado/);
  assert.doesNotMatch(hub,/settleMemberPosition|settleThirdPartyObligation/);
});
