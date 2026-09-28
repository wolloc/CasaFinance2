import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/IncomeCreationAction.tsx',import.meta.url),'utf8');
test('failed income context read clears stale category and destination',()=>{for(const snippet of ['setCategories([]);','setResources([]);',"setCategoryId('');","setPlannedDestinationAccountId('');"])assert.ok(source.includes(snippet));});
test('income form is hidden until a valid reread and retry is offered',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form/);});
test('stale context cannot create an income fact',()=>{const guard=source.indexOf('if(loadError||loading)');const mutation=source.indexOf('await createIncomeFact');assert.ok(guard>=0&&mutation>guard);});
test('income creation moves cash only after a valid context read when the date is today or past',()=>{const guard=source.indexOf('if(loadError||loading)');const settlement=source.indexOf('await settleHouseholdIncome');assert.ok(guard>=0&&settlement>guard);assert.match(source,/if\(!isFuture\).*settleHouseholdIncome/s);assert.match(source,/datas futuras ficam apenas previstas/);assert.doesNotMatch(source,/createResourceTransfer|receiveIncomeFact/);});

test('categoria de entrada é opcional na captura rápida',()=>{assert.match(source,/Categoria <span className="font-normal text-slate-500">\(opcional\)<\/span>/);assert.match(source,/<option value="">Sem categoria<\/option>/);assert.doesNotMatch(source,/Escolha uma categoria de entrada/);});
