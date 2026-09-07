import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const transactions=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const loan=await readFile(new URL('../../src/components/app/LoanAdjustment.tsx',import.meta.url),'utf8');
const principal=await readFile(new URL('../../src/finance/loanPrincipals.ts',import.meta.url),'utf8');

test('Nova despesa separa consumo de dinheiro emprestado antes de abrir uma mutação',()=>{
  assert.match(transactions,/O que aconteceu\?/);
  assert.match(transactions,/Foi um gasto/);
  assert.match(transactions,/Emprestei dinheiro — vão me devolver/);
  assert.match(transactions,/chooseExpense=.*setExpenseFormRequestId/);
  assert.match(transactions,/chooseLoan=.*onGrantLoan/);
});

test('dinheiro emprestado reutiliza o fluxo canônico de empréstimo concedido',()=>{
  assert.match(app,/screen==='loan-granted'/);
  assert.match(app,/initialDirection="granted"/);
  assert.match(app,/backLabel="Voltar aos gastos"/);
  assert.match(loan,/createLoanPrincipal/);
  assert.match(loan,/Isso não virou uma despesa/);
  assert.match(principal,/create_loan_principal/);
});

test('atalho de empréstimo não chama criação de despesa nem cria segundo motor financeiro',()=>{
  const loanJourney=app.slice(app.indexOf("screen==='loan-granted'"));
  assert.doesNotMatch(loanJourney,/createHouseholdTransaction|createAndSettleDirectExpense/);
  assert.doesNotMatch(transactions,/createLoanPrincipal|\.rpc\(/);
});

test('fluxo de empréstimo continua fail-closed quando pessoas ou contas não podem ser relidas',()=>{
  assert.match(loan,/clearLoadedContext/);
  assert.match(loan,/if \(loadError \|\| loading\)/);
  assert.match(loan,/O empréstimo não pode ser registrado até uma nova leitura válida/);
});
