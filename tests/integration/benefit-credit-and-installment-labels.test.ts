import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('benefit credits use Nova Entrada without monthly value configuration',async()=>{
  const ui=await readFile(new URL('../src/components/app/IncomeCreationAction.tsx',import.meta.url),'utf8');
  const migration=await readFile(new URL('../supabase/migrations/20261003163400_benefit_credit_destination_and_settlement.sql',import.meta.url),'utf8');
  assert.match(ui,/resource\.type==='meal_benefit'/);
  assert.match(ui,/benefit_credit/);
  assert.match(ui,/Crédito de benefício/);
  assert.match(ui,/!benefitDestination&&<section/);
  assert.match(migration,/type='meal_benefit'/);
  assert.match(migration,/benefit_credit/);
});

test('card installment presentation reads canonical installment number and total',async()=>{
  const items=await readFile(new URL('../src/finance/cardInvoiceItems.ts',import.meta.url),'utf8');
  const expenses=await readFile(new URL('../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');
  const contextual=await readFile(new URL('../src/components/app/ContextualCardInvoices.tsx',import.meta.url),'utf8');
  assert.match(items,/installment_number/);
  assert.match(items,/total_installments/);
  assert.match(expenses,/Parcela \$\{row\.installment_number\}\/\$\{row\.total_installments\}/);
  assert.match(contextual,/Parcela \$\{item\.installment_number\}\/\$\{item\.total_installments\}/);
});

test('payment payer is derived from the account used',async()=>{
  const invoice=await readFile(new URL('../src/components/app/InvoicePaymentAdjustment.tsx',import.meta.url),'utf8');
  const direct=await readFile(new URL('../src/components/app/DirectExpensePaymentAction.tsx',import.meta.url),'utf8');
  assert.match(invoice,/owner_member_ids/);
  assert.doesNotMatch(invoice,/Quem pagou com o próprio dinheiro/);
  assert.match(direct,/owner_member_ids/);
  assert.doesNotMatch(direct,/Quem pagou com o próprio dinheiro/);
});
