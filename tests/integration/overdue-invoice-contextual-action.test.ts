import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const prioritySource=await readFile(new URL('../../src/components/app/FinancialPriorityCenter.tsx',import.meta.url),'utf8');
const appSource=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const adjustmentSource=await readFile(new URL('../../src/components/app/InvoicePaymentAdjustment.tsx',import.meta.url),'utf8');

const compact=(value:string)=>value.replace(/\s+/g,'');

test('overdue invoice targets the exact invoice instead of falling back to the invoice list',()=>{
  const source=compact(prioritySource);
  assert.match(source,/item\.attention_type==='overdue_invoice'&&item\.entity_type==='invoice'/);
  assert.match(source,/kind:'invoice-payment',invoiceId:item\.entity_id,amount:Number\(item\.amount\)/);
  assert.match(prioritySource,/Registrar pagamento desta fatura/);
});

test('invoice attention becomes transient payment intent only',()=>{
  const source=compact(appSource);
  assert.match(source,/if\(action\.kind==='invoice-payment'\)\{openInvoicePaymentIntent\(action\.invoiceId,action\.amount\);return;\}/);
  assert.match(source,/setInvoicePaymentIntent\(\{invoiceId,suggestedAmount\}\)/);
  assert.doesNotMatch(appSource,/action\.kind==='invoice-payment'[^\n]*supabase/);
});

test('canonical payment flow rereads and settles the current invoice state',()=>{
  assert.match(adjustmentSource,/listFinancialInvoices/);
  assert.match(adjustmentSource,/payFinancialInvoice/);
  assert.match(adjustmentSource,/outstanding_amount/);
});
