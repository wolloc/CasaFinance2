import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const priority=await readFile(new URL('../../src/components/app/FinancialPriorityCenter.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const resolver=await readFile(new URL('../../src/finance/overdueCommitments.ts',import.meta.url),'utf8');
const directIntent=await readFile(new URL('../../src/finance/directExpensePaymentIntent.ts',import.meta.url),'utf8');
const transactions=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const directPayment=await readFile(new URL('../../src/components/app/DirectExpensePaymentAction.tsx',import.meta.url),'utf8');

test('overdue commitment keeps the canonical commitment key instead of trusting a loose source id',()=>{
  assert.match(priority,/attention_type==='overdue_commitment'/);
  assert.match(priority,/item\.attention_key\.startsWith\('commitment:'\)/);
  assert.match(priority,/commitmentKey:item\.attention_key\.slice\('commitment:'\.length\)/);
  assert.match(priority,/Resolver este gasto/);
});

test('resolver rereads the exact current commitment and only supports safe expense routes',()=>{
  assert.match(resolver,/from\('financial_commitment_positions'\)/);
  assert.match(resolver,/eq\('commitment_key', commitmentKey\)/);
  assert.match(resolver,/!row\.is_overdue/);
  assert.match(resolver,/row\.source_invoice_id \|\| row\.source_obligation_id/);
  assert.match(resolver,/row\.source_type === 'recurring_occurrence'/);
  assert.match(resolver,/row\.source_type === 'direct_expense'/);
});

test('navigation uses transient intents and never settles from Home',()=>{
  assert.match(app,/getOverdueCommitmentContext/);
  assert.match(app,/setRecurringExpenseActionIntent/);
  assert.match(app,/setDirectExpensePaymentIntent/);
  assert.doesNotMatch(priority,/settleDirectExpense|rpc\(/);
  assert.doesNotMatch(directIntent,/supabase|rpc|insert|update|delete/i);
});

test('direct expense target is selected only after rereading current payment candidates',()=>{
  assert.match(transactions,/consumeDirectExpensePaymentIntent/);
  assert.match(transactions,/initialTransactionId=\{directExpenseIntent\?\.transactionId\}/);
  assert.match(directPayment,/listDirectExpensePaymentCandidates/);
  assert.match(directPayment,/expenseRows\.find\(\(expense\) => expense\.id === initialTransactionId\)/);
  assert.match(directPayment,/Este gasto mudou ou já foi resolvido/);
  assert.match(directPayment,/settleDirectExpense/);
  assert.match(directPayment,/funderMemberId/);
  assert.match(directPayment,/sourceAccountId/);
});
