import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shared=await readFile(new URL('../../src/components/app/FinancialDetailActionGroup.tsx',import.meta.url),'utf8');
const income=await readFile(new URL('../../src/components/app/IncomeFactManagement.tsx',import.meta.url),'utf8');
const expenseSetup=await readFile(new URL('../../src/components/auth/HouseholdTransactionsSetup.tsx',import.meta.url),'utf8');
const transactions=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');

test('income and expense details share the same action hierarchy',()=>{
 assert.match(income,/FinancialDetailActionGroup/);
 assert.match(expenseSetup,/FinancialDetailActionGroup/);
 assert.match(shared,/Ações deste lançamento/);
 assert.match(shared,/Outras opções/);
});

test('destructive or exceptional actions stay secondary in contextual details',()=>{
 assert.match(income,/secondary=\{actions\.canCancel/);
 assert.match(expenseSetup,/Cancelar gasto/);
 assert.match(expenseSetup,/Registrar estorno/);
 assert.match(transactions,/Ações especiais/);
 assert.match(transactions,/Devolução no cartão|Devolução após pagamento|Outra pessoa pagou/);
});

test('everyday actions remain immediately available',()=>{
 assert.match(income,/>Corrigir</);
 assert.match(income,/>Histórico</);
 assert.match(expenseSetup,/>Editar lançamento</);
 assert.match(expenseSetup,/>Histórico</);
 assert.match(transactions,/\{detailRecurringOpen\?'Fechar':'Gerenciar'\}/);
});
