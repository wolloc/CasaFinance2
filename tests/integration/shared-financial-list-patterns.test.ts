import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const expense=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');
const search=await readFile(new URL('../../src/components/app/FinancialListSearch.tsx',import.meta.url),'utf8');
const categories=await readFile(new URL('../../src/components/app/FinancialCategoryBreakdown.tsx',import.meta.url),'utf8');

test('Entradas and Gastos reuse the same search interaction',()=>{
 for(const source of[income,expense])assert.match(source,/FinancialListSearch/);
 assert.match(search,/aria-label="Limpar busca"/);
 assert.match(search,/resultText/);
 assert.match(search,/placeholder/);
});

test('Entradas and Gastos reuse the same category breakdown while preserving semantic tone',()=>{
 for(const source of[income,expense])assert.match(source,/FinancialCategoryBreakdown/);
 assert.match(income,/tone="income"/);
 assert.match(expense,/tone="commitment"/);
 assert.match(expense,/tone="expense"/);
 assert.match(categories,/Ver categorias/);
 assert.match(categories,/showBars/);
 assert.match(categories,/footer/);
});
