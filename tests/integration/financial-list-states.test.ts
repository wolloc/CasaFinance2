import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const expense=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');
const state=await readFile(new URL('../../src/components/app/FinancialListState.tsx',import.meta.url),'utf8');

test('Entradas e Gastos usam estados compartilhados de lista',()=>{
  assert.match(income,/FinancialListState kind="loading"/);
  assert.match(income,/FinancialListState kind="error"/);
  assert.match(income,/FinancialListState kind="empty"/);
  assert.match(expense,/FinancialListState kind="loading"/);
  assert.match(expense,/FinancialListState kind="error"/);
  assert.match(expense,/FinancialListState kind="empty"/);
});

test('estado compartilhado preserva loading erro retry e vazio acessíveis',()=>{
  assert.match(state,/role="status"/);
  assert.match(state,/role="alert"/);
  assert.match(state,/Tentar novamente/);
  assert.match(state,/border-dashed border-slate-700/);
  assert.match(state,/text-xs text-slate-400/);
});
