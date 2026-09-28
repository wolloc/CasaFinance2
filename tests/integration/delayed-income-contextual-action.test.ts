import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const priority=await readFile(new URL('../../src/components/app/FinancialPriorityCenter.tsx',import.meta.url),'utf8');
const receipt=await readFile(new URL('../../src/components/app/IncomeReceiptAction.tsx',import.meta.url),'utf8');
const intent=await readFile(new URL('../../src/finance/incomeReceiptIntent.ts',import.meta.url),'utf8');

test('delayed expected income carries the exact projected money movement',()=>{
  assert.match(priority,/delayed_expected_income/);
  assert.match(priority,/moneyMovementId:item\.entity_id/);
  assert.match(priority,/Revisar esta entrada/);
  assert.match(app,/setIncomeReceiptIntent/);
  assert.match(app,/moneyMovementId:action\.moneyMovementId/);
});

test('context resolves movement to its canonical income transaction before selecting',()=>{
  assert.match(receipt,/from\('money_movements'\)/);
  assert.match(receipt,/select\('related_transaction_id,beneficiary_member_id,destination_account_id'\)/);
  assert.match(receipt,/targetId = movementData\?\.related_transaction_id \?\? null/);
  assert.match(receipt,/pending\.find\(\(income\) => income\.id === targetId\)/);
  assert.match(receipt,/Essa entrada mudou ou já foi resolvida/);
  assert.doesNotMatch(intent,/supabase|rpc|insert|update|delete/i);
});

test('receipt reuses planned beneficiary and destination but validates them before settling',()=>{
  assert.match(receipt,/setBeneficiaryMemberId\(movementData\?\.beneficiary_member_id/);
  assert.match(receipt,/setDestinationAccountId\(movementData\?\.destination_account_id/);
  assert.match(receipt,/if \(!destinationAccountId\)/);
  assert.match(receipt,/if \(!beneficiaryMemberId\)/);
  assert.match(receipt,/numericAmount - remaining > 0\.005/);
  assert.match(receipt,/Entrou diferente/);
  assert.match(receipt,/settleHouseholdIncome/);
});
