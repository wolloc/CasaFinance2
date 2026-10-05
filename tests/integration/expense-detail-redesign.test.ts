import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const screen=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const setup=await readFile(new URL('../../src/components/auth/HouseholdTransactionsSetup.tsx',import.meta.url),'utf8');
const migration=await readFile(new URL('../../supabase/migrations/202610050006_card_refund_runtime_sync.sql',import.meta.url),'utf8');

test('detalhe do gasto monta somente a ação especial escolhida',()=>{
  assert.match(screen,/detailSpecialAction/);
  assert.match(screen,/detailSpecialAction==='card_refund'/);
  assert.match(screen,/detailSpecialAction==='post_payment_refund'/);
  assert.match(screen,/detailSpecialAction==='direct_refund'/);
  assert.match(screen,/detailSpecialAction==='external_payment'/);
  assert.doesNotMatch(screen,/<ExternalExpensePaymentAction initialTransactionId=\{detailTransactionId\} onCompleted=\{onFinancialChange\}\/>([\s\S]*?)<PartialDirectRefundAction/);
});

test('ações especiais são contextuais ao instrumento financeiro',()=>{
  assert.match(screen,/payment_instrument\?\.kind==='card'/);
  assert.match(screen,/payment_instrument\?\.kind==='account'/);
});

test('exclusão de compra de cartão não depende da etiqueta de posição inicial',()=>{
  assert.match(setup,/Excluir lançamento/);
  assert.doesNotMatch(setup,/Compra anterior ao início do controle.*Excluir da posição inicial/);
  assert.match(setup,/!transaction\.mutation_dependencies\.has_funding_event/);
  assert.match(setup,/!transaction\.mutation_dependencies\.has_external_payment_event/);
  assert.match(setup,/!transaction\.mutation_dependencies\.has_financial_obligation/);
});

test('sync de produção contém a estrutura mínima da devolução no cartão',()=>{
  assert.match(migration,/create table if not exists public\.card_refund_events/);
  assert.match(migration,/create or replace function public\.record_card_invoice_credit_refund/);
  assert.match(migration,/create or replace view public\.financial_card_refund_positions/);
});

test('devolução no cartão só aparece quando existe uma fatura ou parcelamento para receber o crédito',()=>{
  assert.match(screen,/Boolean\(detailTransaction\.invoice_id\) \|\| detailTransaction\.mutation_dependencies\.has_installment_plan/);
});
