import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/CardRefundAction.tsx',import.meta.url),'utf8');
test('refund load failure clears purchase and invoice target context',()=>{for(const snippet of ['setRows([]);',"setSelectedId('');","setTargetInvoiceId('');","setAmount('');"])assert.ok(source.includes(snippet));assert.match(source,/catch\{clearLoadedContext\(\);setLoadError/);});
test('refund form is hidden on failed reread and can retry',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form onSubmit=\{submit\}/);});
test('stale read cannot reduce expense or card obligation',()=>{const guard=source.indexOf('if(loadError)');const mutation=source.indexOf('await recordCardInvoiceCreditRefund');assert.ok(guard>=0&&mutation>guard);assert.match(source,/Nenhum crédito de estorno pode ser registrado até uma nova leitura válida/);});
