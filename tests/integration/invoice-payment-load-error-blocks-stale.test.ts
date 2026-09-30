import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/InvoicePaymentAdjustment.tsx',import.meta.url),'utf8');
test('failed reread clears stale invoices accounts payer and amount',()=>{for(const snippet of ['setInvoices([]);','setAccounts([]);',"setInvoiceId('');","setSourceAccountId('');","setFunderMemberId('');","setAmount('');"])assert.ok(source.includes(snippet));assert.match(source,/catch\{clearLoadedContext\(\);setLoadError/);});
test('payment form is hidden until a valid reread',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form/);});
test('stale invoice context cannot pay',()=>{const guard=source.indexOf('if(loadError||loading)');const mutation=source.indexOf('await payHouseholdInvoice');assert.ok(guard>=0&&mutation>guard);});
test('invoice payment remains a cash settlement without recreating purchases',()=>{assert.match(source,/await payHouseholdInvoice/);assert.doesNotMatch(source,/createHouseholdExpense|createExpense|Nova despesa/);});
