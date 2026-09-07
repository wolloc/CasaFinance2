import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import test from'node:test';
const ui=await readFile(new URL('./PartialDirectRefundAction.tsx',import.meta.url),'utf8');const service=await readFile(new URL('../../finance/partialRefunds.ts',import.meta.url),'utf8');
test('UI explains refund as smaller expense and money returning to the same account, not income',()=>{assert.match(ui,/reduz o valor real do gasto/);assert.match(ui,/sem transformar devolução em renda/);assert.match(ui,/O dinheiro volta para/);});
test('UI shows original, already returned and remaining amounts',()=>{assert.match(ui,/Valor original/);assert.match(ui,/Já devolvido/);assert.match(ui,/Ainda pode ser devolvido/);assert.match(ui,/Ainda pode ser devolvido no máximo/);});
test('service uses canonical read model and partial refund RPC',()=>{assert.match(service,/financial_direct_refund_positions/);assert.match(service,/refund_direct_expense_partial/);});
