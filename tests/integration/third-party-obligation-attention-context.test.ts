import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const priority=await readFile(new URL('../../src/components/app/FinancialPriorityCenter.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const adjustment=await readFile(new URL('../../src/components/app/ThirdPartySettlementAdjustment.tsx',import.meta.url),'utf8');

test('overdue third-party obligations get exact contextual actions',()=>{
  assert.match(priority,/overdue_payable/);
  assert.match(priority,/overdue_receivable/);
  assert.match(priority,/entity_type==='obligation'/);
  assert.match(priority,/Registrar pagamento/);
  assert.match(priority,/Registrar recebimento/);
  assert.match(priority,/obligationId:item\.entity_id/);
});

test('attention reuses canonical settlement intent instead of settling from Home',()=>{
  assert.match(app,/openSettlementAction\(\{kind:'third-party',obligationId:action\.obligationId,amount:action\.amount\}\)/);
  assert.doesNotMatch(priority,/settleThirdPartyObligation|rpc\(/);
  assert.match(adjustment,/listOpenThirdPartyObligations/);
  assert.match(adjustment,/O valor não pode superar o saldo em aberto desta obrigação/);
});

test('third-party settlement preserves neutral economic semantics',()=>{
  assert.match(adjustment,/sem criar renda nova/);
  assert.match(adjustment,/sem criar nova despesa/);
  assert.match(adjustment,/Informe em qual recurso o dinheiro entrou/);
  assert.match(adjustment,/Informe de qual recurso o dinheiro saiu/);
});
