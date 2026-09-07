import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/IncomeCreationAction.tsx',import.meta.url),'utf8');
test('failed income context read clears stale category and destination',()=>{for(const snippet of ['setCategories([]);','setResources([]);',"setCategoryId('');","setPlannedDestinationAccountId('');"])assert.ok(source.includes(snippet));});
test('income form is hidden until a valid reread and retry is offered',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form/);});
test('stale context cannot create an income fact',()=>{const guard=source.indexOf('if(loadError||loading)');const mutation=source.indexOf('await createIncomeFact');assert.ok(guard>=0&&mutation>guard);});
test('income creation still does not move current cash',()=>{assert.doesNotMatch(source,/receiveIncomeFact|createResourceTransfer|settle/);assert.match(source,/O saldo só muda quando você confirmar o recebimento/);});
