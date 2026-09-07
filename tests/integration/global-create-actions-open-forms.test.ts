import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const screen=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const expenses=await readFile(new URL('../../src/components/auth/HouseholdTransactionsSetup.tsx',import.meta.url),'utf8');
const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');

test('Nova despesa gera nova intenção mesmo em Gastos e exige escolha de natureza antes do formulário',()=>{
 assert.match(app,/setExpenseCreateRequestId\(value=>value\+1\);setScreen\('expenses'\)/);
 assert.match(app,/TransactionsScreen mode="expense" createRequestId=\{expenseCreateRequestId\}/);
 assert.match(screen,/createRequestId!==handledCreateRequestId[\s\S]*setShowNature\(true\)/);
 assert.match(screen,/chooseExpense=.*setExpenseFormRequestId\(value=>value\+1\)/);
 assert.match(screen,/HouseholdTransactionsSetup embedded mode=\{mode\} createRequestId=\{expenseFormRequestId\}/);
});

test('formulário principal abre a intenção somente após contexto válido',()=>{
 assert.match(expenses,/createRequestId>0&&createRequestId!==handledCreateRequestId&&!loading&&!loadError/);
 assert.match(expenses,/setHandledCreateRequestId\(createRequestId\);resetForm\(\)/);
 assert.match(expenses,/formOpen && !loadError && !loading/);
});

test('Nova entrada leva ao fluxo que já mantém o formulário canônico visível',()=>{
 assert.match(app,/onIncome=\{\(\)=>setScreen\('income'\)\}/);
 assert.match(screen,/mode === 'income'\) return <IncomeLedgerScreen/);
 assert.match(income,/<IncomeCreationAction onCreated=\{refresh\}\/>/);
});
