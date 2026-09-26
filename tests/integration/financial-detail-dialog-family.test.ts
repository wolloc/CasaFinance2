import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const transactions=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const header=await readFile(new URL('../../src/components/app/FinancialDetailDialogHeader.tsx',import.meta.url),'utf8');

test('detalhes de Entrada e Gasto compartilham o mesmo header',()=>{
  assert.match(income,/FinancialDetailDialogHeader tone="income"/);
  assert.match(transactions,/FinancialDetailDialogHeader tone="expense"/);
});

test('header compartilhado mantém mesma hierarquia e fechamento',()=>{
  assert.match(header,/text-xs font-bold uppercase tracking-wider/);
  assert.match(header,/text-lg font-black text-slate-100/);
  assert.match(header,/text-sm text-slate-400/);
  assert.match(header,/min-h-11 min-w-11/);
});
