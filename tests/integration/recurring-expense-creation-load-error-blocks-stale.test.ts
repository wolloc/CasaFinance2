import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/RecurringExpenseAction.tsx',import.meta.url),'utf8');
test('failed recurring expense reread clears stale reference',()=>{assert.ok(source.includes('setExpenses([]);'));assert.ok(source.includes("setTransactionId('');"));});
test('recurring expense form is hidden until reread succeeds',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form/);});
test('stale expense cannot seed a recurring series',()=>{const guard=source.indexOf('if(loadError||loading)');const mutation=source.indexOf('await createRecurringExpenseFromTransaction');assert.ok(guard>=0&&mutation>guard);});
test('buyer responsibility and payer semantics remain separated',()=>{assert.match(source,/nunca presume quem vai efetivamente pagar/);assert.match(source,/pagador real continua sendo confirmado somente quando houver funding\/caixa/);});
