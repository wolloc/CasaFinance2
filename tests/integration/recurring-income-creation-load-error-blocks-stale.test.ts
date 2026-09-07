import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/RecurringIncomeAction.tsx',import.meta.url),'utf8');
test('failed recurring income context read clears stale selections',()=>{for(const snippet of ['setCategories([]);','setResources([]);',"setCategoryId('');","setPlannedDestinationAccountId('');"])assert.ok(source.includes(snippet));});
test('recurring income form is hidden until reread succeeds',()=>{assert.match(source,/loading \? <LoaderCircle[\s\S]*?: loadError \? <div[\s\S]*?Tentar novamente[\s\S]*?: <form/);});
test('stale context cannot create recurring income rule',()=>{const guard=source.indexOf('if (loadError || loading)');const mutation=source.indexOf('await createRecurringIncomeRule');assert.ok(guard>=0&&mutation>guard);});
test('recurring rule still does not move current cash',()=>{assert.match(source,/nenhuma delas altera o saldo até o recebimento real/);});
