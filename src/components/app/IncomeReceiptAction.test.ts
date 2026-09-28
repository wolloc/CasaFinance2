import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const service = await readFile(new URL('../../finance/incomeReceipts.ts', import.meta.url), 'utf8');
const action = await readFile(new URL('./IncomeReceiptAction.tsx', import.meta.url), 'utf8');
const screen = await readFile(new URL('./TransactionsScreen.tsx', import.meta.url), 'utf8');
const spec = await readFile(new URL('../../../docs/product-spec-v2.md', import.meta.url), 'utf8');
const constitution = await readFile(new URL('../../../docs/casa-finance-constitution.md', import.meta.url), 'utf8');

test('income realization uses canonical settle_income and never generic income creation', () => {
  assert.match(service, /rpc\('settle_income'/);
  assert.doesNotMatch(service, /create_financial_transaction|from\('transactions'\).*insert/s);
  assert.match(service, /p_destination_account_id: input\.destinationAccountId/);
  assert.match(service, /p_beneficiary_member_id: input\.beneficiaryMemberId/);
});

test('revisão de entrada prioriza confirmação rápida e mantém edição completa', () => {
  assert.match(screen, /mode === 'income' && <IncomeReceiptAction/);
  assert.match(action, /Essa entrada aconteceu\?/);
  assert.match(action, /Sim, entrou como previsto/);
  assert.match(action, /Ainda não entrou/);
  assert.match(action, /Entrou diferente/);
  assert.match(action, /setBeneficiaryMemberId\(movementData\?\.beneficiary_member_id/);
  assert.match(action, /setDestinationAccountId\(movementData\?\.destination_account_id/);
  assert.match(action, /Confirmar entrada/);
  assert.match(action, /settleHouseholdIncome/);
});

test('income receipt contract remains aligned with Product Spec and Constitution', () => {
  assert.match(spec, /Entrou[^\n]*somente renda verdadeira recebida/s);
  assert.match(spec, /Não são renda: transferência, refund, recebimento de recebível, empréstimo tomado, resgate de principal e acerto/);
  assert.match(constitution, /Previsão não é realizado|previsão não é realizado/i);
  assert.match(constitution, /Toda entrada de caixa precisa declarar sua natureza|entrada.*natureza/i);
});
