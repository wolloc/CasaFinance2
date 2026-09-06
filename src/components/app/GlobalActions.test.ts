import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const appSource = await readFile(new URL('./CasaFinanceApp.tsx', import.meta.url), 'utf8');
const actionsSource = await readFile(new URL('./GlobalActions.tsx', import.meta.url), 'utf8');
const adjustmentSource = await readFile(new URL('./NewAdjustmentScreen.tsx', import.meta.url), 'utf8');
const settlementService = await readFile(new URL('../../finance/memberSettlements.ts', import.meta.url), 'utf8');
const productSpec = await readFile(new URL('../../../docs/product-spec-v2.md', import.meta.url), 'utf8');
const constitution = await readFile(new URL('../../../docs/casa-finance-constitution.md', import.meta.url), 'utf8');

test('all three Product Spec global actions are present independently', () => {
  for (const label of ['Nova despesa', 'Nova entrada', 'Novo acerto']) {
    assert.match(actionsSource, new RegExp(label));
    assert.match(productSpec, new RegExp(label));
  }
  assert.match(appSource, /<GlobalActions/);
  assert.match(appSource, /onExpense=\{\(\) => setScreen\('expenses'\)\}/);
  assert.match(appSource, /onIncome=\{\(\) => setScreen\('income'\)\}/);
  assert.match(appSource, /onAdjustment=\{openAdjustment\}/);
});

test('Novo acerto exposes explicit intentions without pretending unfinished flows are operational', () => {
  for (const label of ['Transferência entre recursos', 'Acerto entre nós', 'Acerto com outra pessoa', 'Pagamento de fatura', 'Investimento / reserva', 'Empréstimos']) {
    assert.match(adjustmentSource, new RegExp(label.replace('/', '\\/')));
    assert.match(productSpec, new RegExp(label.replace('/', '\\/')));
  }
  assert.match(adjustmentSource, /ready: true/);
  assert.match(adjustmentSource, /Em preparação/);
});

test('member settlement uses the canonical neutral RPC and never writes an income or expense', () => {
  assert.match(settlementService, /rpc\('settle_member_position'/);
  assert.match(settlementService, /financial_member_settlement_positions/);
  assert.doesNotMatch(settlementService, /from\('transactions'\).*insert|createHouseholdTransaction|type:\s*['"](?:income|expense)['"]/s);
  assert.match(adjustmentSource, /Nenhuma renda ou despesa nova foi criada/);
  assert.match(constitution, /Movimentação de caixa não é automaticamente receita ou despesa/);
});

test('member settlement refuses silent inverse debt and excess settlement in the UI', () => {
  assert.match(adjustmentSource, /numericAmount > realizedOutstanding/);
  assert.match(adjustmentSource, /não pode superar a dívida realizada em aberto/);
  assert.match(adjustmentSource, /Não cria dívida inversa silenciosamente/);
  assert.match(productSpec, /não cria dívida inversa silenciosamente/i);
});
