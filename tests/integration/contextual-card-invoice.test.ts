import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app=await readFile(new URL('../../src/components/app/InvoicesScreen.tsx',import.meta.url),'utf8');
const contextual=await readFile(new URL('../../src/components/app/ContextualCardInvoices.tsx',import.meta.url),'utf8');
const items=await readFile(new URL('../../src/finance/cardInvoiceItems.ts',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const shell=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');

test('card click routes to a card-scoped invoice journey',()=>{
 assert.match(app,/cardReviewIntent.*ContextualCardInvoices/s);
 assert.match(contextual,/Fatura anterior/);
 assert.match(contextual,/Próxima fatura/);
 assert.match(contextual,/Pagar tudo ou parte/);
 assert.match(contextual,/Adiantar pagamento/);
 assert.match(contextual,/Lançamentos/);
 assert.match(contextual,/timelineDateLabel/);
 assert.match(contextual,/groupedItems/);
 assert.doesNotMatch(contextual,/FinancialPerspectiveSelector/);
});

test('contextual invoice items reuse the canonical financial commitment read model',()=>{
 assert.match(items,/financial_card_commitment_positions/);
 assert.match(items,/source_invoice_id/);
 assert.match(contextual,/Estornado/);
 assert.match(contextual,/Cancelado/);
 assert.match(contextual,/Saldo inicial do cartão/);
 assert.match(items,/transaction_date/);
 assert.match(contextual,/purchase_date/);
 assert.doesNotMatch(items,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test('Home makes each card the primary entry point without redundant all-invoices CTA',()=>{
 assert.match(home,/onOpenCard\?\.\(card\.card_id\)/);
 assert.doesNotMatch(home,/Todas as faturas/);
});

test('contextual card invoice does not create a second payment command',()=>{
 assert.doesNotMatch(contextual,/payHouseholdInvoice|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
 assert.match(contextual,/onPay\?\.\(paymentInvoice\)/);
 assert.doesNotMatch(contextual,/Você entrou pelo cartão/);
 assert.doesNotMatch(contextual,/Ainda compõe/);
});

test('contextual invoice exposes card limit and future commitment from canonical card health read model',()=>{
 assert.match(items,/financial_card_health_positions/);
 assert.match(items,/available_limit/);
 assert.match(items,/future_known_commitments/);
 assert.match(contextual,/Limite disponível/);
 assert.match(contextual,/Futuro/);
 assert.match(contextual,/utilization_ratio/);
 assert.match(contextual,/purchase_commitment_count/);
 assert.match(contextual,/installment_count/);
});

test('invoice payment remains delegated and can be partial without creating a new expense',()=>{
 assert.match(contextual,/Pagar tudo ou parte/);
 assert.doesNotMatch(contextual,/você confirma quanto realmente pagou/);
 assert.match(contextual,/onPay\?\.\(paymentInvoice\)/);
 assert.doesNotMatch(contextual,/payHouseholdInvoice|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});


test('Home card modal opens the selected card directly and keeps contextual payment visible',()=>{
 assert.match(shell,/selectedCardId\?<ContextualCardInvoices cardId=\{selectedCardId\} onPay=\{openInvoicePayment\}/);
 assert.match(shell,/selectedCardId\?'Faturas':'Cartões e faturas'/);
});
