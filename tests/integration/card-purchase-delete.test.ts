import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql=await readFile(new URL('../../supabase/migrations/202610050004_delete_unrealized_card_purchase.sql',import.meta.url),'utf8');
const service=await readFile(new URL('../../src/finance/householdTransactions.ts',import.meta.url),'utf8');
const ui=await readFile(new URL('../../src/components/auth/HouseholdTransactionsSetup.tsx',import.meta.url),'utf8');

test('exclusão de cartão não liquidado recalcula a fatura e preserva caixa',()=>{
  assert.match(sql,/create or replace function public\.delete_card_purchase/);
  assert.match(sql,/update public\.card_invoices/);
  assert.match(sql,/update public\.installments/);
  assert.match(sql,/funding_events/);
  assert.match(sql,/external_payment_events/);
  assert.match(sql,/financial_obligations/);
  assert.match(sql,/status='closed'::public\.invoice_state/);
  assert.match(sql,/update public\.transactions[\s\S]*deleted_at=now/);
  assert.doesNotMatch(sql,/insert into public\.money_movements/);
});

test('cliente usa comando canônico de exclusão de compra de cartão',()=>{
  assert.match(service,/export async function deleteCardPurchase/);
  assert.match(service,/rpc\('delete_card_purchase'/);
});

test('Gastos mostra exclusão para compra de cartão não liquidada',()=>{
  assert.match(ui,/Excluir lançamento/);
  assert.match(ui,/transaction\.payment_instrument\?\.kind === 'card'/);
  assert.match(ui,/!transaction\.mutation_dependencies\.has_funding_event/);
  assert.match(ui,/!transaction\.mutation_dependencies\.has_external_payment_event/);
  assert.match(ui,/!transaction\.mutation_dependencies\.has_financial_obligation/);
});
