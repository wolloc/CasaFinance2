import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const expense=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');
const header=await readFile(new URL('../../src/components/app/FinancialPageHeader.tsx',import.meta.url),'utf8');

test('Casa Entradas e Gastos usam o mesmo header de tela',()=>{
  assert.match(home,/FinancialPageHeader title="Casa"/);
  assert.match(income,/FinancialPageHeader title="Entradas"/);
  assert.match(expense,/FinancialPageHeader title="Gastos"/);
});

test('escala tipográfica do título é definida em um único lugar',()=>{
  assert.match(header,/text-2xl font-black leading-tight tracking-tight text-slate-100/);
});
