import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/PartialDirectRefundAction.tsx',import.meta.url),'utf8');
test('failed direct refund reread clears stale expense and amount',()=>{for(const snippet of ['setRows([]);',"setSelectedId('');","setAmount('');"])assert.ok(source.includes(snippet));});
test('refund form is hidden until reread succeeds',()=>{assert.match(source,/loading\?<p[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:openRows\.length===0/);});
test('stale refundable balance cannot create a refund',()=>{const guard=source.indexOf('if(loadError||loading)');const mutation=source.indexOf('await recordPartialDirectRefund');assert.ok(guard>=0&&mutation>guard);});
test('refund remains tied to original funding and is not income',()=>{assert.match(source,/devolve caixa à mesma origem real — nunca vira renda/);});
