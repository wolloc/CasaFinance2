import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app=await readFile(new URL('../../src/components/app/InvoicesScreen.tsx',import.meta.url),'utf8');
const contextual=await readFile(new URL('../../src/components/app/ContextualCardInvoices.tsx',import.meta.url),'utf8');
const items=await readFile(new URL('../../src/finance/cardInvoiceItems.ts',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');

test('card click routes to a card-scoped invoice journey',()=>{
 assert.match(app,/cardReviewIntent.*ContextualCardInvoices/s);
 assert.match(contextual,/Fatura anterior/);
 assert.match(contextual,/Próxima fatura/);
 assert.match(contextual,/Pagar fatura/);
 assert.match(contextual,/Lançamentos da fatura/);
 assert.doesNotMatch(contextual,/FinancialPerspectiveSelector/);
});

test('contextual invoice items reuse the canonical financial commitment read model',()=>{
 assert.match(items,/financial_commitment_positions/);
 assert.match(items,/source_invoice_id/);
 assert.match(items,/economic_type.*expense/s);
 assert.doesNotMatch(items,/\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test('Home makes each card the primary entry point without redundant all-invoices CTA',()=>{
 assert.match(home,/onOpenCard\?\.\(card\.card_id\)/);
 assert.doesNotMatch(home,/Todas as faturas/);
});

test('contextual card invoice does not create a second payment command',()=>{
 assert.doesNotMatch(contextual,/payHouseholdInvoice|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
 assert.match(contextual,/onPay\?\.\(paymentInvoice\)/);
});
