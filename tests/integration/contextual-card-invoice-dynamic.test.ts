import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const source=fs.readFileSync(path.join(root,'src/components/app/ContextualCardInvoices.tsx'),'utf8');
const finance=fs.readFileSync(path.join(root,'src/finance/financialInvoices.ts'),'utf8');

test('abertura contextual da fatura consulta a fatura dinamicamente pelo invoice_id selecionado',()=>{
  assert.match(source,/getFinancialInvoice\(supabase,household\.id,selectedInvoiceId\)/);
  assert.doesNotMatch(source,/listFinancialInvoices\(supabase,household\.id\)/);
  assert.match(source,/getCardInvoiceExposure\(supabase,household\.id,cardId\)\.catch/);
  assert.match(finance,/\.eq\('invoice_id', invoiceId\)\.maybeSingle\(\)/);
  assert.match(finance,/financial_invoice_positions/);
});
