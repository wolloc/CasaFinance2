import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('./DirectExpensePaymentAction.tsx', import.meta.url), 'utf8');
const screen = await readFile(new URL('./TransactionsScreen.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../finance/directExpensePayments.ts', import.meta.url), 'utf8');
const constitution = await readFile(new URL('../../../docs/casa-finance-constitution.md', import.meta.url), 'utf8');
const spec = await readFile(new URL('../../../docs/product-spec-v2.md', import.meta.url), 'utf8');

test('Gastos asks explicitly where the money came from and who paid', () => {
  assert.match(screen, /DirectExpensePaymentAction/);
  assert.match(ui, /De qual conta o dinheiro saiu\?/);
  assert.match(ui, /Quem pagou com o próprio dinheiro\?/);
  assert.match(ui, /não cria um novo gasto/i);
});

test('direct expense settlement uses the canonical atomic RPC', () => {
  assert.match(service, /rpc\('settle_direct_expense'/);
  assert.doesNotMatch(service, /from\('funding_events'\)\.insert/);
  assert.doesNotMatch(service, /from\('money_movements'\)\.insert/);
});

test('card purchases are excluded because invoice payment owns their cash event', () => {
  assert.match(service, /instrument\?\.kind === 'card'/);
  assert.match(service, /installmentIds\.has/);
  assert.match(ui, /Compra no cartão não aparece aqui/);
  assert.match(spec, /O pagamento posterior da fatura realiza funding/);
});

test('buyer, instrument holder, responsibility and payer stay independent', () => {
  assert.match(ui, /Quem comprou, quem é responsável pelo gasto e quem pagou podem ser pessoas diferentes/);
  assert.match(ui, /Não é preenchido automaticamente pelo comprador nem pelo titular da conta/);
  assert.match(constitution, /Comprador, titular do instrumento, responsável econômico e pagador\/funder são independentes/);
});
