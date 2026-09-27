import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shared=await readFile(new URL('../../src/components/app/FinancialResourceChoice.tsx',import.meta.url),'utf8');
const income=await readFile(new URL('../../src/components/app/IncomeCreationAction.tsx',import.meta.url),'utf8');
const expense=await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx',import.meta.url),'utf8');

test('Nova Entrada and Nova Despesa share the same compact resource card',()=>{
 assert.match(income,/FinancialResourceChoice/);
 assert.match(expense,/FinancialResourceChoice/);
 assert.match(shared,/min-h-\[58px\]/);
 assert.match(shared,/institution&&/);
 assert.match(shared,/name/);
 assert.match(shared,/ownerLabel&&/);
});

test('resource card hierarchy is institution then resource name then owner',()=>{
 const institution=shared.indexOf('{institution&&');
 const name=shared.indexOf('{name}');
 const owner=shared.indexOf('{ownerLabel&&');
 assert.ok(institution>=0&&name>institution&&owner>name);
 assert.doesNotMatch(expense,/Recurso da Casa/);
});

test('income and expense preserve their own semantic selected tones',()=>{
 assert.match(income,/tone="emerald"/);
 assert.match(shared,/tone\?:'blue'\|'emerald'/);
 assert.doesNotMatch(expense,/tone="emerald"/);
});
