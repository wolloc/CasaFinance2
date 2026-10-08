import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const categoryMigration=await readFile(new URL('../../supabase/migrations/20261003130000_transaction_category_correction.sql',import.meta.url),'utf8');
const tx=await readFile(new URL('../../src/finance/householdTransactions.ts',import.meta.url),'utf8');
const txScreen=await readFile(new URL('../../src/components/auth/HouseholdTransactionsSetup.tsx',import.meta.url),'utf8');
const invoice=await readFile(new URL('../../src/components/app/InvoicePaymentAdjustment.tsx',import.meta.url),'utf8');
const setup=await readFile(new URL('../../src/components/auth/HouseholdFinancialSetup.tsx',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');

test('existing non-cancelled transactions can change only their category',()=>{
  assert.match(categoryMigration,/correct_transaction_category/);
  assert.match(categoryMigration,/category_id/);
  assert.match(categoryMigration,/Categoria ajustada pelo usuário/);
  assert.match(categoryMigration,/does not alter amount/i);
  assert.match(tx,/updateHouseholdTransactionCategory/);
  assert.match(tx,/canEditCategory/);
  assert.match(txScreen,/Alterar categoria/);
});

test('invoice payment signals the planned source account without removing payer accountability',()=>{
  assert.match(invoice,/De qual conta o dinheiro saiu\?/);
  assert.match(invoice,/Conta planejada sinalizada/);
  assert.match(invoice,/Conta planejada sinalizada/);
});

test('card identity editing keeps limit and cycle dates editable',()=>{
  for(const field of ['editCardLimit','editClosingDay','editDueDay','creditLimit','closingDay','dueDay'])assert.match(setup,new RegExp(field));
  assert.match(setup,/Editar /);
});

test('future Casa view keeps the same money map language',()=>{
  assert.match(home,/referenceMonth!==currentReferenceMonth/);
  assert.match(home,/HomeFinancialMap/);
  assert.match(home,/HomeFinancialMap/);
});
