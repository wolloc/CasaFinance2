import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/ExternalExpensePaymentAction.tsx',import.meta.url),'utf8');
test('failed external payment reread clears stale expense party and amount',()=>{for(const snippet of ['setExpenses([]);','setParties([]);',"setTransactionId('');","setPayerPartyId('');","setAmount('');"])assert.ok(source.includes(snippet));});
test('external payment form is hidden until reread succeeds',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form/);});
test('stale context cannot record an external payment',()=>{const guard=source.indexOf('if(loadError||loading)');const mutation=source.indexOf('await recordExternalExpensePayment');assert.ok(guard>=0&&mutation>guard);});
test('gift and reimbursement do not invent Casa cash inflow',()=>{assert.match(source,/não cria renda nem entrada de caixa/);assert.match(source,/nasceu uma obrigação de pagar o terceiro depois/);});
