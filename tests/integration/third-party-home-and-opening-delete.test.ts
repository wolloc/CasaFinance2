import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const migration=fs.readFileSync(path.join(root,'supabase/migrations/202610040004_fix_opening_card_delete_invoice_link.sql'),'utf8');
const home=fs.readFileSync(path.join(root,'src/components/app/HomeFinancialMap.tsx'),'utf8');
const settlements=fs.readFileSync(path.join(root,'src/components/app/SettlementHub.tsx'),'utf8');
const setup=fs.readFileSync(path.join(root,'src/components/auth/HouseholdTransactionsSetup.tsx'),'utf8');

test('exclusão da posição inicial não exige invoice_id no lançamento de origem',()=>{
  assert.match(migration,/transaction_payment_instruments/);
  assert.doesNotMatch(migration,/if tx\.invoice_id is null or not exists/);
  assert.match(migration,/installment_plans/);
});

test('Casa apresenta responsabilidades e acertos no mapa de pessoas',()=>{
  assert.doesNotMatch(home,/Responsabilidade por compromissos/);
  assert.match(home,/Valores com terceiros/);
  assert.match(home,/includeThirdParties/);
  assert.match(settlements,/listOpenThirdPartyObligations/);
  assert.match(settlements,/Registrar recebimento/);
  assert.match(settlements,/Registrar pagamento/);
});

test('fluxo atual de exclusão e cancelamento é explícito',()=>{
  assert.match(setup,/Excluir lançamento/);
  assert.match(setup,/Nenhum estorno será criado/);
});
