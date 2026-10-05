import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const setup = await readFile(new URL('../../src/components/auth/HouseholdTransactionsSetup.tsx', import.meta.url), 'utf8');
const finance = await readFile(new URL('../../src/finance/householdTransactions.ts', import.meta.url), 'utf8');

test('gastos expõe edição e exclusão segura para compras de cartão', () => {
  assert.match(finance, /correct_unrealized_card_purchase/);
  assert.match(finance, /delete_card_purchase/);
  assert.match(finance, /canDeleteCardPurchase/);
  assert.match(setup, /actions\.canDeleteCardPurchase/);
  assert.match(setup, /Excluir/);
});

test('edição de compra de cartão usa comando financeiro específico', () => {
  assert.match(setup, /correctUnrealizedCardPurchase\(supabase/);
  assert.match(finance, /card-purchase-correction/);
});
