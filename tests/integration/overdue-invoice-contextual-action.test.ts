import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const prioritySource=fs.readFileSync('src/components/app/FinancialPriorityCenter.tsx','utf8');
const appSource=fs.readFileSync('src/components/app/CasaFinanceApp.tsx','utf8');
const adjustmentSource=fs.readFileSync('src/components/app/InvoicePaymentAdjustment.tsx','utf8');

const compact=(value:string)=>value.replace(/\s+/g,'');

describe('overdue invoice contextual action',()=>{
  it('targets the exact overdue invoice instead of falling back to the invoice list',()=>{
    const source=compact(prioritySource);
    expect(source).toContain("item.attention_type==='overdue_invoice'&&item.entity_type==='invoice'");
    expect(source).toContain("kind:'invoice-payment',invoiceId:item.entity_id,amount:Number(item.amount)");
    expect(prioritySource).toContain('Registrar pagamento desta fatura');
  });

  it('turns navigation into transient invoice-payment intent only',()=>{
    const source=compact(appSource);
    expect(source).toContain("if(action.kind==='invoice-payment'){openInvoicePaymentIntent(action.invoiceId,action.amount);return;}");
    expect(source).toContain('setInvoicePaymentIntent({invoiceId,suggestedAmount})');
    expect(appSource).not.toContain("action.kind==='invoice-payment'&&supabase");
  });

  it('keeps the canonical payment flow responsible for rereading and settling the invoice',()=>{
    expect(adjustmentSource).toContain('listFinancialInvoices');
    expect(adjustmentSource).toContain('payFinancialInvoice');
    expect(adjustmentSource).toContain('outstanding_amount');
  });
});
