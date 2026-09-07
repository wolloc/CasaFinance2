import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../../src/components/auth/HouseholdCategoriesSetup.tsx',import.meta.url),'utf8');
test('failed category reread clears stale list editing and form',()=>{for(const snippet of ['setCategories([]);','setEditing(null);','setFormOpen(false);'])assert.ok(source.includes(snippet));});
test('category load error is distinct from a real empty state',()=>{assert.match(source,/loadError \? <p[\s\S]*?Recarregue para visualizar ou alterar as categorias[\s\S]*?: categories\.length === 0/);});
test('create and edit are blocked until categories reread succeeds',()=>{const guard=source.indexOf("if (loadError || loading) { setError('Recarregue as categorias atuais antes de salvar.');");const update=source.indexOf('await updateHouseholdCategory');const create=source.indexOf('await createHouseholdCategory');assert.ok(guard>=0&&update>guard&&create>guard);});
test('deactivation is blocked until categories reread succeeds',()=>{const guard=source.indexOf("if (loadError || loading) { setError('Recarregue as categorias atuais antes de desativar.');");const mutation=source.indexOf('await deactivateHouseholdCategory');assert.ok(guard>=0&&mutation>guard);});
test('retry is available after load failure',()=>{assert.match(source,/loadError && <div[\s\S]*?Tentar novamente/);});