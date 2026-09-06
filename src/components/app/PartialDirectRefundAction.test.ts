import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import test from'node:test';
const ui=await readFile(new URL('./PartialDirectRefundAction.tsx',import.meta.url),'utf8');const service=await readFile(new URL('../../finance/partialRefunds.ts',import.meta.url),'utf8');
test('UI explains refund as expense reduction and cash return, not income',()=>{assert.match(ui,/reduz o custo efetivo do gasto original/);assert.match(ui,/nunca vira renda/);assert.match(ui,/O dinheiro voltará para/);});
test('UI shows original, already refunded and remaining amounts',()=>{assert.match(ui,/Compra original/);assert.match(ui,/Já estornado/);assert.match(ui,/Ainda estornável/);assert.match(ui,/O máximo ainda estornável/);});
test('service uses canonical read model and partial refund RPC',()=>{assert.match(service,/financial_direct_refund_positions/);assert.match(service,/refund_direct_expense_partial/);});
