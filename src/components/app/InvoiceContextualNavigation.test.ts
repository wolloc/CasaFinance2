import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const invoices=await readFile(new URL('./InvoicesScreen.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('./CasaFinanceApp.tsx',import.meta.url),'utf8');
const adjustment=await readFile(new URL('./InvoicePaymentAdjustment.tsx',import.meta.url),'utf8');
const intent=await readFile(new URL('../../finance/invoicePaymentIntent.ts',import.meta.url),'utf8');

test('open invoice offers a contextual payment action without settling directly',()=>{
  assert.match(invoices,/Registrar pagamento desta fatura/);
  assert.match(invoices,/onPay\?\.\(row\)/);
  assert.doesNotMatch(invoices,/payHouseholdInvoice|settle_invoice|rpc\(/);
});

test('context stores only navigation intent and routes to the canonical adjustment flow',()=>{
  assert.match(app,/setInvoicePaymentIntent/);
  assert.match(app,/setScreen\('new-adjustment'\)/);
  assert.match(intent,/sessionStorage/);
  assert.doesNotMatch(intent,/supabase|rpc\(|money_movements|funding_events/);
});

test('payment flow rereads current invoice balance and still requires explicit cash account and payer',()=>{
  assert.match(adjustment,/listFinancialInvoices/);
  assert.match(adjustment,/Esta fatura não tem mais valor para pagar/);
  assert.match(adjustment,/De qual conta o dinheiro saiu\?/);
  assert.match(adjustment,/Quem pagou com o próprio dinheiro\?/);
  assert.match(adjustment,/payHouseholdInvoice/);
  assert.match(adjustment,/valor pago não pode ser maior do que ainda falta pagar/i);
});
