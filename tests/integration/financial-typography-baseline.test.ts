import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const summary=await readFile(new URL('../../src/components/app/FinancialListSummaryCard.tsx',import.meta.url),'utf8');
const selector=await readFile(new URL('../../src/components/app/FinancialPerspectiveSelector.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const expense=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');

test('financial summary uses readable label and metadata sizes',()=>{
  assert.match(summary,/text-xs font-bold uppercase tracking-wide/);
  assert.match(summary,/text-right text-xs text-slate-400/);
});

test('perspective selector is readable and consistent across screens',()=>{
  assert.match(selector,/min-h-11 rounded-xl px-2 text-sm font-bold/);
  assert.match(selector,/text-slate-300/);
});

test('period helper text and bottom navigation share a readable baseline',()=>{
  assert.match(home,/text-xs text-slate-400">Toque para escolher o mês/);
  assert.match(income,/text-xs text-slate-400">Toque para escolher o período/);
  assert.match(expense,/text-xs text-slate-400">Toque para escolher o período/);
  assert.match(app,/gap-1 text-xs font-semibold/);
});
