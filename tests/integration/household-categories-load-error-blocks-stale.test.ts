import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../../src/components/auth/HouseholdCategoriesSetup.tsx',import.meta.url),'utf8');

test('failed category reread clears stale list editing and form',()=>{
 for(const snippet of ['setCategories([]);','setEditing(null);','setFormOpen(false);'])assert.ok(source.includes(snippet));
});

test('category load error is distinct from a real empty state',()=>{
 assert.match(source,/setLoadError\('Não foi possível conferir as categorias agora\.'\)/);
 assert.match(source,/loadError&&<div[\s\S]*?Tentar novamente/);
 assert.match(source,/!loadError&&categories\.length===0/);
});

test('create and edit are blocked until categories reread succeeds',()=>{
 const save=source.indexOf('const save=async');
 const guard=source.indexOf('if(loadError||loading)',save);
 const update=source.indexOf('await updateHouseholdCategory',save);
 const create=source.indexOf('await createHouseholdCategory',save);
 assert.ok(save>=0&&guard>save&&update>guard&&create>guard);
 assert.match(source,/disabled=\{loading\|\|!!loadError\}/);
});

test('deactivation is blocked until categories reread succeeds',()=>{
 const deactivate=source.indexOf('const deactivate=async');
 const guard=source.indexOf('if(loadError||loading)',deactivate);
 const mutation=source.indexOf('await deactivateHouseholdCategory',deactivate);
 assert.ok(deactivate>=0&&guard>deactivate&&mutation>guard);
});

test('retry is available after load failure',()=>{
 assert.match(source,/loadError&&<div[\s\S]*?onClick=\{\(\)=>void refresh\(\)\}[\s\S]*?Tentar novamente/);
});
