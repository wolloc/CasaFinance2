import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('posição inicial de cartão permite categoria, divisão e lote atômico', () => {
  const modal = read('src/components/auth/OpeningCardCommitmentsModal.tsx');
  const service = read('src/finance/householdFinancialAccounts.ts');
  const migration = read('supabase/migrations/20261003203000_opening_card_purchase_batch.sql');

  assert.match(modal, /listHouseholdCategories/);
  assert.match(modal, /Selecione uma categoria para este lançamento/);
  assert.match(modal, /Dividir igualmente/);
  assert.match(modal, /Personalizar divisão/);
  assert.match(modal, /Adicionar lançamento/);
  assert.match(modal, /Mantém o contexto do último lançamento/);
  assert.match(modal, /originalPurchaseDate: ''/);
  assert.match(modal, /Salvar \$\{queued\\.length\\}/);
  assert.match(modal, /recordOpeningCardPurchasesBatch/);

  assert.match(service, /recordOpeningCardPurchasesBatch/);
  assert.match(service, /record_opening_card_purchases_batch_idempotent/);
  assert.match(service, /p_category_id/);
  assert.match(service, /p_splits/);

  assert.match(migration, /create or replace function public\.record_opening_card_purchases_batch_idempotent/);
  assert.match(migration, /between 1 and 50 items/);
  assert.match(migration, /category_id is null/);
  assert.match(migration, /public\.record_opening_card_purchase/);
  assert.match(migration, /financial_command_store/);
});
