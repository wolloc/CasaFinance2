import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const income=await readFile(new URL('../../src/components/app/IncomeCreationAction.tsx',import.meta.url),'utf8');
const expense=await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx',import.meta.url),'utf8');
const header=await readFile(new URL('../../src/components/app/FinancialActionDialogHeader.tsx',import.meta.url),'utf8');

test('Nova Entrada e Nova Despesa compartilham o mesmo header de ação financeira',()=>{
  assert.match(income,/FinancialActionDialogHeader tone="income"/);
  assert.match(expense,/FinancialActionDialogHeader tone="expense"/);
  assert.match(header,/border-b border-slate-800 px-4 py-3/);
  assert.match(header,/text-lg font-black text-slate-100/);
});

test('action dialogs share the same shell geometry',()=>{
  for(const source of [income,expense]){
    assert.match(source,/max-h-\[92dvh\][\s\S]{0,100}w-full max-w-lg[\s\S]{0,100}overflow-y-auto[\s\S]{0,100}border border-slate-700 bg-slate-900/);
  }
});

test('primary actions have equivalent hierarchy with semantic colors',()=>{
  assert.match(income,/min-h-14 rounded-2xl bg-emerald-600 px-4 text-base font-black/);
  assert.match(expense,/min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 text-base font-black/);
});
