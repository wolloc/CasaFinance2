import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const transactions=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const feedback=await readFile(new URL('../../src/components/app/FinancialSaveFeedback.tsx',import.meta.url),'utf8');
const loan=await readFile(new URL('../../src/components/app/LoanAdjustment.tsx',import.meta.url),'utf8');
const loanPayment=await readFile(new URL('../../src/components/app/LoanScheduledPayment.tsx',import.meta.url),'utf8');
const expenseRecurrence=await readFile(new URL('../../src/components/app/RecurringExpenseManagement.tsx',import.meta.url),'utf8');
const incomeRecurrence=await readFile(new URL('../../src/components/app/RecurringIncomeManagement.tsx',import.meta.url),'utf8');
const settlement=await readFile(new URL('../../src/components/app/ThirdPartySettlementAdjustment.tsx',import.meta.url),'utf8');

test('Entrada and Despesa use the same save feedback component',()=>{
  assert.match(income,/FinancialSaveFeedback message="Entrada registrada/);
  assert.match(transactions,/FinancialSaveFeedback message="Despesa registrada/);
});

test('save feedback auto-dismisses after a short confirmation window',()=>{
  assert.match(income,/setTimeout\(\(\)=>setIncomeSaved\(false\),3500\)/);
  assert.match(transactions,/setTimeout\(\(\)=>setExpenseSaved\(false\),3500\)/);
});

test('shared feedback is accessible and visually neutral-positive',()=>{
  assert.match(feedback,/role="status"/);
  assert.match(feedback,/aria-live="polite"/);
  assert.match(feedback,/rounded-2xl border border-emerald-900\/70/);
});


test('core financial journeys reuse the same success feedback language and visible saving state',()=>{
 for(const source of[loan,loanPayment,expenseRecurrence,incomeRecurrence,settlement]){
  assert.match(source,/FinancialSaveFeedback/);
  assert.match(source,/LoaderCircle className="h-4 w-4 animate-spin"/);
 }
 assert.match(feedback,/aria-live="polite"/);
});
