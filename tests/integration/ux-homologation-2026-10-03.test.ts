import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const header=await readFile(new URL('../../src/components/app/FinancialPageHeader.tsx',import.meta.url),'utf8');
const expenses=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');
const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const views=await readFile(new URL('../../src/finance/expenseMonthViews.ts',import.meta.url),'utf8');
const role=await readFile(new URL('../../src/components/app/ExpenseRoleCorrectionAction.tsx',import.meta.url),'utf8');
const statement=await readFile(new URL('../../src/components/app/MonthlyPositionStatement.tsx',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');

test('financial creation actions live beside the page title, not in a floating control',()=>{
  assert.match(header,/action\?:ReactNode/);
  assert.match(expenses,/aria-label="Novo gasto"/);
  assert.match(income,/aria-label="Nova entrada"/);
  assert.doesNotMatch(app,/GlobalActions/);
});

test('installment position comes from the commitment installment, not the purchase transaction',()=>{
  assert.match(views,/loadInstallmentVisualsForCommitments/);
  assert.match(views,/source_installment_id\?commitmentInstallments\.get/);
  assert.match(views,/!byTransaction\.has\(plan\.transactionId\)/);
});

test('expense responsibility correction is a focused commitment editor',()=>{
  assert.match(role,/Quem fica com este compromisso\?/);
  assert.match(role,/Dividir entre vocês/);
  assert.doesNotMatch(role,/Quem realmente comprou\?/);
  assert.doesNotMatch(role,/Motivo da correção/);
  assert.match(role,/correctExpenseRoles/);
});

test('monthly story keeps the current humanized coverage summary',()=>{
  assert.match(statement,/Estamos tranquilos neste mês/);
  assert.match(statement,/O mês fecha contando com o que ainda entra/);
  assert.match(statement,/Precisamos nos organizar neste mês/);
  assert.match(home,/Como estamos\?/);
  assert.match(home,/Olhando pra frente/);
  assert.match(home,/Alguns dados não atualizaram agora/);
});
