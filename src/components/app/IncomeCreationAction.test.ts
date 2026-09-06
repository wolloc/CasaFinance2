import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const creationSource = await readFile(new URL('./IncomeCreationAction.tsx', import.meta.url), 'utf8');
const ledgerSource = await readFile(new URL('./IncomeLedgerScreen.tsx', import.meta.url), 'utf8');
const transactionsScreenSource = await readFile(new URL('./TransactionsScreen.tsx', import.meta.url), 'utf8');
const serviceSource = await readFile(new URL('../../finance/incomeFacts.ts', import.meta.url), 'utf8');
const productSpec = await readFile(new URL('../../../docs/product-spec-v2.md', import.meta.url), 'utf8');

test('income creation uses its dedicated canonical RPC instead of the generic transaction creator', () => {
  assert.match(serviceSource, /rpc\('create_income_fact'/);
  assert.doesNotMatch(serviceSource, /create_financial_transaction|createHouseholdTransaction/);
  assert.match(transactionsScreenSource, /if \(mode === 'income'\) return <IncomeLedgerScreen \/>/);
  assert.doesNotMatch(transactionsScreenSource, /mode === 'income'.*HouseholdTransactionsSetup/s);
});

test('new income explicitly captures nature, beneficiary, planned destination and confidence', () => {
  assert.match(creationSource, /Natureza da renda/);
  assert.match(creationSource, /De quem é esta renda\?/);
  assert.match(creationSource, /Onde espera receber\?/);
  assert.match(creationSource, /Quanto confia nesta entrada\?/);
  assert.match(creationSource, /Prevista — ainda pode mudar/);
  assert.match(creationSource, /Confirmada — posso contar com ela/);
  assert.match(serviceSource, /p_beneficiary_member_id/);
  assert.match(serviceSource, /p_planned_destination_account_id/);
  assert.match(serviceSource, /p_income_nature/);
});

test('income UX preserves forecast versus realized cash and excludes neutral inflows', () => {
  assert.match(creationSource, /O saldo só muda quando você confirmar o recebimento/);
  assert.match(creationSource, /Transferência, acerto, empréstimo tomado, recebível, refund e resgate de principal/);
  assert.match(creationSource, /Renda confirmada criada\. Ela entra na projeção, mas ainda não no saldo atual/);
  assert.match(productSpec, /Não são renda: transferência, refund, recebimento de recebível, empréstimo tomado, resgate de principal e acerto/);
});

test('dedicated income screen keeps creation, receipt and read list in one journey', () => {
  assert.match(ledgerSource, /<IncomeCreationAction onCreated=\{refresh\}\/>/);
  assert.match(ledgerSource, /<IncomeReceiptAction onCompleted=\{refresh\}\/>/);
  assert.match(ledgerSource, /Rendas cadastradas/);
  assert.match(ledgerSource, /row\.type === 'income'/);
});
