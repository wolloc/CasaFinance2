import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/ExpenseRoleCorrectionAction.tsx',import.meta.url),'utf8');
test('failed role reread clears stale expense and responsibility fields',()=>{for(const snippet of ['setRows([]);',"setSelectedId('');","setBuyer('');","setFirstMember('');","setSecondMember('');"])assert.ok(source.includes(snippet));});
test('role correction form is hidden until reread succeeds',()=>{assert.match(source,/loading\?<LoaderCircle[\s\S]*?:loadError\?<div[\s\S]*?Tentar novamente[\s\S]*?:<form/);});
test('stale role context cannot be corrected',()=>{const guard=source.indexOf('if(loadError||loading)');const mutation=source.indexOf('await correctExpenseRoles');assert.ok(guard>=0&&mutation>guard);});
test('correction preserves historical funding and cash',()=>{assert.match(source,/Funding e caixa anteriores foram preservados/);assert.match(source,/Comprador, responsável econômico e financiador continuam independentes/);});
