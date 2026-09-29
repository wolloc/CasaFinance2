import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const transactions=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const wizard=await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const loan=await readFile(new URL('../../src/components/app/LoanAdjustment.tsx',import.meta.url),'utf8');
const principal=await readFile(new URL('../../src/finance/loanPrincipals.ts',import.meta.url),'utf8');

test('Nova despesa abre diretamente a jornada de gasto sem oferecer empréstimo',()=>{
  assert.match(transactions,/<NewExpenseWizard openRequestId=\{createRequestId\}/);
  assert.doesNotMatch(transactions,/Foi um gasto|Emprestei dinheiro — vão me devolver|Natureza do acontecimento/);
  assert.doesNotMatch(wizard,/Emprestei dinheiro|createLoanPrincipal/);
});

test('empréstimo continua existindo como fluxo financeiro separado e contextual',()=>{
  assert.match(app,/setResourceAdjustmentIntent/);
  assert.match(app,/action\.kind!==\'settings\'/);
  assert.match(loan,/createLoanPrincipal/);
  assert.match(loan,/Isso não virou uma despesa/);
  assert.match(principal,/create_loan_principal/);
});

test('Nova despesa não cria segundo motor de empréstimos',()=>{
  assert.doesNotMatch(wizard,/createLoanPrincipal|loanPrincipals|\.rpc\(/);
  assert.match(wizard,/createAndSettleDirectExpense/);
  assert.match(wizard,/createHouseholdTransaction/);
});

test('fluxo de empréstimo continua fail-closed quando pessoas ou contas não podem ser relidas',()=>{
  assert.match(loan,/clearLoadedContext/);
  assert.match(loan,/if \(loadError \|\| loading\)/);
  assert.match(loan,/O empréstimo não pode ser registrado até uma nova leitura válida/);
});
