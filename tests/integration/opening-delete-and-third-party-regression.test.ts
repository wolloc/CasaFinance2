import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const migration=fs.readFileSync(path.join(root,'supabase/migrations/202610040003_stabilize_third_party_and_opening_card_delete.sql'),'utf8');
const setup=fs.readFileSync(path.join(root,'src/components/auth/HouseholdTransactionsSetup.tsx'),'utf8');
const finance=fs.readFileSync(path.join(root,'src/finance/householdTransactions.ts'),'utf8');

test('responsabilidade de terceiro é validada pelas alocações econômicas',()=>{
  assert.match(migration,/economic_allocations/);
  assert.match(migration,/transaction % economic allocations must total 100%/);
  assert.match(migration,/member_allocation_total/);
  assert.match(migration,/responsible_party_id/);
});

test('exclusão da posição inicial recalcula faturas e cancela parcelas históricas',()=>{
  assert.match(migration,/delete_opening_card_purchase/);
  assert.match(migration,/total_amount=greatest\(ci\.total_amount-r\.amount,0\)/);
  assert.match(migration,/opening_settled_amount=greatest\(ci\.opening_settled_amount-r\.opening_amount,0\)/);
  assert.match(migration,/status='cancelled'::public\.installment_state/);
  assert.match(migration,/deleted_at=now\(\)/);
});

test('UI oferece exclusão para compra de cartão sem fatos financeiros vinculados',()=>{
  assert.match(setup,/Excluir lançamento/);
  assert.match(setup,/transaction\.payment_instrument\?\.kind === 'card'/);
  assert.match(setup,/!transaction\.mutation_dependencies\.has_funding_event/);
  assert.match(setup,/!transaction\.mutation_dependencies\.has_external_payment_event/);
  assert.match(setup,/!transaction\.mutation_dependencies\.has_financial_obligation/);
});

test('cliente usa RPC idempotente para excluir posição inicial',()=>{
  assert.match(finance,/delete_opening_card_purchase/);
  assert.match(finance,/opening-card-delete/);
});
