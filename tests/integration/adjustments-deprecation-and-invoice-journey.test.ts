import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const adjustment=await readFile(new URL('../../src/components/app/NewAdjustmentScreen.tsx',import.meta.url),'utf8');
const invoice=await readFile(new URL('../../src/components/app/InvoicePaymentAdjustment.tsx',import.meta.url),'utf8');

test('valor manual com pessoa fica fora da UX genérica, preservando compatibilidade contextual',()=>{
  assert.match(adjustment,/visibleIntentions=intentions\.filter\(\(\{id\}\)=>id!=='third-party-create'\)/);
  assert.match(adjustment,/selected==='third-party-create'/);
});

test('pagamento iniciado pela fatura não volta para ajustes',()=>{
  assert.match(adjustment,/showBack=\{!invoiceIntent\}/);
  assert.doesNotMatch(invoice,/Voltar aos ajustes/);
  assert.match(invoice,/showBack&&<button/);
});

test('pagamento usa conta planejada como sugestão editável e permite outra conta',()=>{
  assert.match(invoice,/setSourceAccountId\(current\.planned_payment_account_id\?\?''\)/);
  assert.match(invoice,/Pagar com<select/);
  assert.match(invoice,/accounts\.map\(account=>/);
});
