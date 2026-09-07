import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('./CardFinancialJourney.tsx', import.meta.url), 'utf8');
const home = await readFile(new URL('./CasaHomeScreen.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../finance/cardFinancialJourney.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../../supabase/migrations/202609060044_card_financial_journey.sql', import.meta.url), 'utf8');

test('card journey is contextual inside Casa card section', () => {
  assert.match(home, /<CardFinancialJourney cardId=\{c\.card_id\}/);
  assert.match(ui, /Ver jornada do cartão/);
});

test('journey reads canonical invoice funding and settlement sources', () => {
  assert.match(migration, /financial_card_invoice_positions/);
  assert.match(migration, /financial_card_commitment_positions/);
  assert.match(migration, /card_invoice_payments/);
  assert.match(migration, /funding_events/);
  assert.match(migration, /member_settlement_events/);
  assert.match(migration, /security_invoker=true/);
});

test('invoice payment remains cash plus who actually funded it, never a second expense', () => {
  assert.match(ui, /Pagar a fatura movimenta dinheiro e registra quem realmente bancou aquele pagamento/);
  assert.doesNotMatch(service, /insert\(/);
  assert.doesNotMatch(service, /rpc\(/);
});

test('journey translates internal funding language for the user', () => {
  for (const text of ['Compra → parcela/fatura', 'Pago da fatura', 'Falta pagar', 'De onde saiu o dinheiro', 'Quem bancou', 'Acertos das compras']) assert.match(ui, new RegExp(text));
  assert.doesNotMatch(ui, />Funding</);
  assert.match(ui, /funding_events/);
});
