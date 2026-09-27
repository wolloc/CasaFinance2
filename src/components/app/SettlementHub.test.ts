import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const hub=await readFile(new URL('./SettlementHub.tsx',import.meta.url),'utf8');
const adjustment=await readFile(new URL('./NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const thirdParty=await readFile(new URL('./ThirdPartySettlementAdjustment.tsx',import.meta.url),'utf8');

test('Home people positions show the current balance first and defer trend/history to detail',()=>{
  assert.match(hub,/Valores com pessoas/);
  assert.match(hub,/memberName\(pair\.leftId\).*↔.*memberName\(pair\.rightId\)/s);
  assert.match(hub,/current\?currentText:'Tudo equilibrado hoje'/);
  assert.match(hub,/Ver tendência/);
  assert.match(hub,/Ver histórico e compromissos/);
  assert.doesNotMatch(hub,/Acertar agora/);
});

test('third-party obligations put the person, balance and due date first',()=>{
  assert.match(hub,/group\.name/);
  assert.match(hub,/A receber/);
  assert.match(hub,/A pagar/);
  assert.match(hub,/dateLabel\(group\.nearestDue\)/);
  assert.match(hub,/Registrar recebimento/);
  assert.match(hub,/Registrar pagamento/);
  assert.match(hub,/Corrigir cadastro ou vencimento/);
  assert.match(hub,/Não será recebido/);
  assert.match(hub,/Dívida foi perdoada/);
});

test('contextual navigation preselects third-party operations but never auto-settles',()=>{
  assert.match(adjustment,/consumeSettlementActionIntent/);
  assert.match(adjustment,/initialObligationId/);
  assert.match(thirdParty,/initialObligationId/);
  assert.doesNotMatch(hub,/settleMemberPosition|settleThirdPartyObligation/);
});
