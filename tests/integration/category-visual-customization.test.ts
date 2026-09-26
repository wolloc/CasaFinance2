import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const visuals=await readFile(new URL('../../src/components/categoryVisuals.ts',import.meta.url),'utf8');
const setup=await readFile(new URL('../../src/components/auth/HouseholdCategoriesSetup.tsx',import.meta.url),'utf8');
const service=await readFile(new URL('../../src/finance/householdCategories.ts',import.meta.url),'utf8');

test('category visual catalog offers distinct editable icons instead of a single generic glyph',()=>{
 assert.match(visuals,/CATEGORY_ICON_OPTIONS/);
 for(const icon of ['shopping-basket','utensils','home','car','heart-pulse','graduation-cap','plane','paw-print','dumbbell','gamepad'])assert.ok(visuals.includes(icon),icon);
 assert.match(setup,/Ícone/);
 assert.match(setup,/CATEGORY_ICON_OPTIONS\.map/);
 assert.match(setup,/aria-pressed=\{selected\}/);
});

test('category color is editable and persisted through the existing category row',()=>{
 assert.match(visuals,/CATEGORY_COLOR_OPTIONS/);
 assert.match(setup,/Cor/);
 assert.match(setup,/setColor/);
 assert.match(service,/icon: input\.icon\?\.trim\(\) \|\| null/);
 assert.match(service,/color: input\.color\?\.trim\(\) \|\| null/);
 assert.doesNotMatch(service,/rpc\(|create table|alter table/i);
});

test('stored category visual remains the single source reused by ledgers',()=>{
 assert.match(visuals,/stored && stored!=='tag' && icons\[stored\] \? stored : inferredIconName/);
 assert.match(visuals,/storedColor && storedColor!=='#64748b'/);
 assert.match(setup,/Ícone automático/);
 assert.match(setup,/getCategoryVisual\(category\)/);
});
