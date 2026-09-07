import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const appSource = await readFile(new URL('./CasaFinanceApp.tsx', import.meta.url), 'utf8');
const actionsSource = await readFile(new URL('./GlobalActions.tsx', import.meta.url), 'utf8');
const adjustmentSource = await readFile(new URL('./NewAdjustmentScreen.tsx', import.meta.url), 'utf8');
const invoicePaymentSource = await readFile(new URL('./InvoicePaymentAdjustment.tsx', import.meta.url), 'utf8');
const thirdPartySource = await readFile(new URL('./ThirdPartySettlementAdjustment.tsx', import.meta.url), 'utf8');
const investmentReserveSource = await readFile(new URL('./InvestmentReserveAdjustment.tsx', import.meta.url), 'utf8');
const loanSource = await readFile(new URL('./LoanAdjustment.tsx', import.meta.url), 'utf8');
const settlementService = await readFile(new URL('../../finance/memberSettlements.ts', import.meta.url), 'utf8');
const transferService = await readFile(new URL('../../finance/resourceTransfers.ts', import.meta.url), 'utf8');
const invoicePaymentService = await readFile(new URL('../../finance/invoicePayments.ts', import.meta.url), 'utf8');
const thirdPartyService = await readFile(new URL('../../finance/thirdPartyObligations.ts', import.meta.url), 'utf8');
const investmentReserveService = await readFile(new URL('../../finance/investmentReserveAdjustments.ts', import.meta.url), 'utf8');
const loanService = await readFile(new URL('../../finance/loanPrincipals.ts', import.meta.url), 'utf8');
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

test('Novo acerto keeps the operational flows reachable with human labels', () => {
  for (const label of ['Mover dinheiro entre contas', 'Acerto entre nós', 'Acerto com outra pessoa', 'Pagamento de fatura', 'Investimento / reserva', 'Empréstimos']) {
    assert.match(adjustmentSource, new RegExp(label.replace('/', '\\/')));
  }
  assert.doesNotMatch(adjustmentSource, /ready: false/);
});

test('member settlement uses the canonical neutral RPC and never writes an income or expense', () => {
  assert.match(settlementService, /rpc\('settle_member_position'/);
  assert.match(settlementService, /financial_member_settlement_positions/);
  assert.doesNotMatch(settlementService, /from\('transactions'\).*insert|createHouseholdTransaction|type:\s*['"](?:income|expense)['"]/s);
  assert.match(constitution, /Movimentação de caixa não é automaticamente receita ou despesa/);
});

test('resource transfer uses canonical create_transfer and stays neutral', () => {
  assert.match(transferService, /rpc\('create_transfer'/);
  assert.doesNotMatch(transferService, /createHouseholdTransaction|type:\s*['"](?:income|expense)['"]/);
  assert.match(adjustmentSource, /selected==='transfer'/);
  assert.match(adjustmentSource, /De qual conta o dinheiro saiu/);
  assert.match(adjustmentSource, /Para qual conta o dinheiro entrou/);
  assert.match(adjustmentSource, /O dinheiro só mudou de conta dentro da Casa; isso não virou renda nem gasto/);
  assert.match(adjustmentSource, /sourceAccount===destinationAccount/);
  assert.match(productSpec, /transferência patrimonial: receita zero e despesa zero/);
  assert.match(constitution, /Movimentação de caixa não é automaticamente receita ou despesa/);
});

test('invoice payment uses canonical pay_card_invoice without recognizing a second expense', () => {
  assert.match(invoicePaymentService, /rpc\('pay_card_invoice'/);
  assert.doesNotMatch(invoicePaymentService, /createHouseholdTransaction|type:\s*['"](?:income|expense)['"]/);
  assert.match(adjustmentSource, /selected==='invoice'/);
  assert.match(invoicePaymentSource, /As compras já foram registradas como gastos/);
  assert.match(invoicePaymentSource, /não pode ser maior do que ainda falta pagar na fatura/);
  assert.match(invoicePaymentSource, /Quem pagou com o próprio dinheiro/);
  assert.match(invoicePaymentSource, /Conta que estava planejada:.*conta realmente usada/s);
  assert.match(invoicePaymentSource, /As compras não viraram despesa de novo/);
  assert.match(productSpec, /pagamento da fatura.*não cria nova despesa/i);
  assert.match(constitution, /fatura.*não cria uma segunda despesa/i);
});

test('third-party settlement liquidates canonical obligations without creating income or expense', () => {
  assert.match(thirdPartyService, /financial_obligations/);
  assert.match(thirdPartyService, /obligation_events/);
  assert.match(thirdPartyService, /rpc\('settle_financial_obligation'/);
  assert.doesNotMatch(thirdPartyService, /from\('transactions'\).*insert|createHouseholdTransaction|type:\s*['"](?:income|expense)['"]/s);
  assert.match(adjustmentSource, /selected==='third-party'/);
  assert.match(thirdPartySource, /não cria uma nova renda nem um novo gasto/);
  assert.match(thirdPartySource, /numericAmount > outstanding/);
  assert.match(thirdPartySource, /Quem pagou com o próprio dinheiro/);
  assert.match(constitution, /caixa aumenta e o recebível diminui, mas renda continua zero/i);
});

test('investment and reserve principal movement stays economically neutral', () => {
  assert.match(investmentReserveService, /financial_account_balances/);
  assert.match(investmentReserveService, /rpc\('create_transfer'/);
  assert.match(investmentReserveService, /resource_restriction === 'reserve'/);
  assert.doesNotMatch(investmentReserveService, /createHouseholdTransaction|type:\s*['"](?:income|expense)['"]/);
  assert.match(adjustmentSource, /selected==='reserve'/);
  assert.match(investmentReserveSource, /movimenta apenas o principal/);
  assert.match(investmentReserveSource, /Aporte e resgate não são despesa nem renda/);
  assert.match(investmentReserveSource, /rendimento e perda são fatos econômicos separados/);
  assert.match(investmentReserveSource, /Nenhuma despesa foi criada/);
  assert.match(investmentReserveSource, /Nenhuma renda foi criada/);
  assert.match(productSpec, /aporte\/resgate de principal neutros, rendimento\/perda separados/i);
  assert.match(constitution, /resgate de principal/i);
});

test('loan principal creates obligation and cash without becoming income or expense', () => {
  assert.match(loanService, /rpc\('create_loan_principal'/);
  assert.match(loanService, /rpc\('create_financial_party'/);
  assert.doesNotMatch(loanService, /createHouseholdTransaction|type:\s*['"](?:income|expense)['"]/);
  assert.match(adjustmentSource, /selected==='loan'/);
  assert.match(loanSource, /Emprestei dinheiro/);
  assert.match(loanSource, /Peguei emprestado/);
  assert.match(loanSource, /Emprestar dinheiro não é despesa/);
  assert.match(loanSource, /pegar dinheiro emprestado não é renda/i);
  assert.match(loanSource, /Juros, tarifas e perdas são fatos econômicos separados/);
  assert.match(loanSource, /caixa diminuiu e nasceu um valor a receber/);
  assert.match(loanSource, /caixa aumentou e nasceu um valor a pagar/);
  assert.match(productSpec, /empréstimo tomado/i);
  assert.match(constitution, /empréstimo/i);
});
