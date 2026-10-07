import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const migration=await readFile(new URL('../../supabase/migrations/202610070001_card_payment_instrument_correction.sql',import.meta.url),'utf8');
const service=await readFile(new URL('../../src/finance/cardPaymentInstrumentCorrection.ts',import.meta.url),'utf8');
const action=await readFile(new URL('../../src/components/app/CardPaymentInstrumentCorrectionAction.tsx',import.meta.url),'utf8');
const screen=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const thirdParty=await readFile(new URL('../../src/components/app/ThirdPartyContextModal.tsx',import.meta.url),'utf8');

test('card correction is an audited dedicated command',()=>{
  assert.match(migration,/create or replace function public\.correct_card_payment_instrument/);
  assert.match(migration,/transaction_adjustment_events/);
  assert.match(migration,/transaction_payment_instruments/);
  assert.match(migration,/card_invoices/);
  assert.match(migration,/financing_allocations/);
  assert.match(migration,/grant execute on function public\.correct_card_payment_instrument/);
  assert.match(service,/correct_card_payment_instrument/);
});

test('card correction is only exposed for a clean unpaid purchase',()=>{
  assert.match(action,/has_funding_event/);
  assert.match(action,/has_external_payment_event/);
  assert.match(action,/has_financial_obligation/);
  assert.match(action,/has_installment_plan/);
  assert.match(action,/has_recurring_occurrence/);
  assert.match(action,/Corrigir cartão e fatura/);
  assert.match(screen,/CardPaymentInstrumentCorrectionAction/);
});

test('third-party detail exposes financial action context without changing the ledger model',()=>{
  assert.match(thirdParty,/Ações financeiras/);
  assert.match(thirdParty,/Registrar recebimento/);
  assert.match(thirdParty,/Registrar pagamento/);
  assert.match(thirdParty,/não criar nova renda ou despesa/);
});
