import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const journey=fs.readFileSync(path.join(root,'src/finance/cardFinancialJourney.ts'),'utf8');
const role=fs.readFileSync(path.join(root,'src/components/app/ExpenseRoleCorrectionAction.tsx'),'utf8');
const invoice=fs.readFileSync(path.join(root,'src/finance/financialInvoices.ts'),'utf8');

test('fatura tem fallback seguro para a posição materializada',()=>{
  assert.match(journey,/financial_card_invoice_positions/);
  assert.match(journey,/\.neq\(['"]state['"], ['"]cancelled['"]\)/);
  assert.match(journey,/card_name/);
});

test('responsabilidade oferece terceiro como opção explícita',()=>{
  assert.match(role,/setPreset\(mode:'single'\|['"]equal['"]\|['"]thirdParty['"]/);
  assert.match(role,/100% de um terceiro/);
  assert.match(role,/Adicionar terceiro/);
});

test('fatura selecionada é consultada dinamicamente',()=>{
  assert.match(invoice,/financial_invoice_positions/);
  assert.match(invoice,/\.eq\('invoice_id', invoiceId\)\.maybeSingle\(\)/);
});
