import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const expense=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');
const summary=await readFile(new URL('../../src/components/app/FinancialListSummaryCard.tsx',import.meta.url),'utf8');

test('Entradas and Gastos share the same financial summary component',()=>{
  assert.match(income,/FinancialListSummaryCard tone="income"/);
  assert.match(expense,/FinancialListSummaryCard tone="expense"/);
});

test('shared financial summary fixes hierarchy and typography in one place',()=>{
  assert.match(summary,/rounded-2xl border p-4/);
  assert.match(summary,/text-xs font-bold uppercase tracking-wide/);
  assert.match(summary,/mt-1 block text-2xl/);
  assert.match(summary,/text-right text-xs text-slate-400/);
  assert.match(summary,/label='Total da visão'|label=\"Total da visão\"|label='Total da visão'/);
});

test('income and expense differ by semantic tone, not by layout',()=>{
  assert.match(summary,/tone==='income'/);
  assert.match(summary,/emerald/);
  assert.match(summary,/rose/);
  assert.doesNotMatch(income,/Total listado/);
});
