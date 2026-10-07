import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/app/ExpenseRoleCorrectionAction.tsx',import.meta.url),'utf8');
test('failed role reread clears stale expense and responsibility fields',()=>{for(const snippet of ['setRows([]);',"setSelectedId('');","setBuyer('');","setFirstMember('');","setSecondMember('');"])assert.ok(source.includes(snippet));});
test('role correction form is hidden until reread succeeds',()=>{assert.match(source,/if\(loading\)return[\s\S]*LoaderCircle/);assert.match(source,/if\(loadError\)return[\s\S]*Tentar novamente/);});
test('stale role context cannot be corrected',()=>{const mutation=source.indexOf('await correctExpenseRoles');assert.ok(mutation>=0);assert.match(source,/if\(loadError\|\|loading\)\{setError\('Recarregue/);});
test('correction preserves historical funding and cash',()=>{assert.doesNotMatch(source,/Funding e caixa anteriores foram preservados/);assert.match(source,/Quem fica com este compromisso\?/);});
