import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const hub=await readFile(new URL('./SettlementHub.tsx',import.meta.url),'utf8');
const adjustment=await readFile(new URL('./NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const thirdParty=await readFile(new URL('./ThirdPartySettlementAdjustment.tsx',import.meta.url),'utf8');

test('Home people positions separate realized from projected without generic member settlement CTA',()=>{
  assert.match(hub,/Valores com pessoas/);
  assert.match(hub,/Entre vocês · posição de hoje/);
  assert.match(hub,/Entre vocês · tendência/);
  assert.match(hub,/posição líquida realizada entre vocês/);
  assert.doesNotMatch(hub,/Acertar agora/);
});

test('third-party obligations use human language and contextual actions',()=>{
  assert.match(hub,/deve para a Casa/);
  assert.match(hub,/A Casa deve para/);
  assert.match(hub,/Registrar recebimento/);
  assert.match(hub,/Registrar pagamento/);
  assert.match(hub,/Vence hoje/);
});

test('contextual navigation preselects third-party operations but never auto-settles',()=>{
  assert.match(adjustment,/consumeSettlementActionIntent/);
  assert.match(adjustment,/nada será movimentado até você confirmar/);
  assert.match(adjustment,/initialObligationId/);
  assert.match(thirdParty,/Este acerto veio da Home e já foi localizado/);
  assert.doesNotMatch(hub,/settleMemberPosition|settleThirdPartyObligation/);
});
