import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const transactions=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');

test('app mantém uma revisão financeira global e a propaga às superfícies principais',()=>{
  assert.match(app,/financialRevision/);
  assert.match(app,/markFinancialChange/);
  assert.match(app,/CasaHomeScreen refreshKey=\{financialRevision\}/);
  assert.match(app,/TransactionsScreen mode="expense"[\s\S]*refreshKey=\{financialRevision\}[\s\S]*onFinancialChange=\{markFinancialChange\}/);
  assert.match(app,/TransactionsScreen mode="income"[\s\S]*refreshKey=\{financialRevision\}[\s\S]*onFinancialChange=\{markFinancialChange\}/);
});

test('ações financeiras concluídas invalidam a Home antes de voltar à tela de origem',()=>{
  assert.match(app,/NewAdjustmentScreen onCompleted=\{message=>\{markFinancialChange\(\)/);
  assert.match(home,/household\?\.timezone,refreshKey/);
  assert.match(home,/attentionRefreshKey,refreshKey/);
  assert.match(home,/refreshKey=\{attentionRefreshKey\+refreshKey\}/);
});

test('novas despesas e entradas atualizam lista local e revisão global',()=>{
  assert.match(transactions,/onFinancialChange\?\.\(\)/);
  assert.match(transactions,/expenseListVersion\+refreshKey/);
  assert.match(income,/globalRefreshKey/);
  assert.match(income,/refreshFinancial/);
  assert.match(income,/onFinancialChange\?\.\(\)/);
});
