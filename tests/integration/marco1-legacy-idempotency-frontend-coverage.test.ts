import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cases:Array<[string,string]>=[
 ['invoicePayments.ts','pay_card_invoice_idempotent'],
 ['incomeReceipts.ts','settle_income_idempotent'],
 ['directExpensePayments.ts','settle_direct_expense_idempotent'],
 ['resourceTransfers.ts','create_transfer_idempotent'],
 ['memberSettlements.ts','settle_member_position_idempotent'],
 ['thirdPartyObligations.ts','settle_financial_obligation_idempotent'],
 ['thirdPartyObligations.ts','write_off_receivable_idempotent'],
 ['loanPrincipals.ts','create_loan_principal_idempotent'],
 ['investmentReserveAdjustments.ts','record_investment_performance_idempotent'],
 ['investmentReserveAdjustments.ts','create_transfer_idempotent'],
 ['explicitExpenseCreation.ts','create_and_settle_direct_expense_idempotent'],
 ['householdTransactions.ts','create_and_settle_shared_expense_idempotent'],
 ['recurringExpenseCommitments.ts','settle_recurring_expense_occurrence_idempotent'],
];

for(const [file,rpc] of cases){
 test(`${file} routes sensitive legacy mutation through ${rpc}`,async()=>{
  const source=await readFile(new URL(`../../src/finance/${file}`,import.meta.url),'utf8');
  assert.ok(source.includes(rpc));
  assert.ok(source.includes('runRetryStableRpc'));
 });
}
