import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const appSource = await readFile(new URL('./CasaFinanceApp.tsx', import.meta.url), 'utf8');
const actionsSource = await readFile(new URL('./GlobalActions.tsx', import.meta.url), 'utf8');
const adjustmentSource = await readFile(new URL('./NewAdjustmentScreen.tsx', import.meta.url), 'utf8');
const invoicePaymentSource = await readFile(new URL('./InvoicePaymentAdjustment.tsx', import.meta.url), 'utf8');
const thirdPartySource = await readFile(new URL('./ThirdPartySettlementAdjustment.tsx', import.meta.url), 'utf8');
const settlementService = await readFile(new URL('../../finance/memberSettlements.ts', import.meta.url), 'utf8');
const transferService = await readFile(new URL('../../finance/resourceTransfers.ts', import.meta.url), 'utf8');
const invoicePaymentService = await readFile(new URL('../../finance/invoicePayments.ts', import.meta.url), 'utf8');
const thirdPartyService = await readFile(new URL('../../finance/thirdPartyObligations.ts', import.meta.url), 'utf8');
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

test('resource transfer uses canonical create_transfer and stays neutral', () => {
  assert.match(transferService, /rpc\('create_transfer'/);
  assert.doesNotMatch(transferService, /createHouseholdTransaction|type:\s*['"](?:income|expense)['"]/);
  assert.match(adjustmentSource, /selected === 'transfer'/);
  assert.match(adjustmentSource, /Receita e despesa continuam zero/);
  assert.match(adjustmentSource, /sourceAccount === destinationAccount/);
  assert.match(adjustmentSource, /Transferência registrada\. O dinheiro mudou de recurso, sem criar renda ou despesa/);
  assert.match(productSpec, /transferência patrimonial: receita zero e despesa zero/);
  assert.match(constitution, /Movimentação de caixa não é automaticamente receita ou despesa/);
});

test('invoice payment uses canonical pay_card_invoice without recognizing a second expense', () => {
  assert.match(invoicePaymentService, /rpc\('pay_card_invoice'/);
  assert.doesNotMatch(invoicePaymentService, /createHouseholdTransaction|type:\s*['"](?:income|expense)['"]/);
  assert.match(adjustmentSource, /selected === 'invoice'/);
  assert.match(invoicePaymentSource, /A despesa já nasceu nas compras do cartão/);
  assert.match(invoicePaymentSource, /não pode superar o valor em aberto da fatura/);
  assert.match(invoicePaymentSource, /quem efetivamente financiou/i);
  assert.match(invoicePaymentSource, /Conta prevista:.*só uma previsão/s);
  assert.match(invoicePaymentSource, /sem criar uma segunda despesa/);
  assert.match(productSpec, /pagamento da fatura.*não cria nova despesa/i);
  assert.match(constitution, /fatura.*não cria uma segunda despesa/i);
});

test('third-party settlement liquidates canonical obligations without creating income or expense', () => {
  assert.match(thirdPartyService, /financial_obligations/);
  assert.match(thirdPartyService, /obligation_events/);
  assert.match(thirdPartyService, /rpc\('settle_financial_obligation'/);
  assert.doesNotMatch(thirdPartyService, /from\('transactions'\).*insert|createHouseholdTransaction|type:\s*['"](?:income|expense)['"]/s);
  assert.match(adjustmentSource, /selected === 'third-party'/);
  assert.match(thirdPartySource, /Receber um valor a receber não vira renda/);
  assert.match(thirdPartySource, /pagar um valor a pagar não vira nova despesa/);
  assert.match(thirdPartySource, /numericAmount > outstanding/);
  assert.match(thirdPartySource, /quem efetivamente financiou/i);
  assert.match(constitution, /caixa aumenta e o recebível diminui, mas renda continua zero/i);
});
