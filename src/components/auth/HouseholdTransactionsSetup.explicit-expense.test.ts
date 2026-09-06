import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const screen = await readFile(new URL('./HouseholdTransactionsSetup.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../finance/explicitExpenseCreation.ts', import.meta.url), 'utf8');
const constitution = await readFile(new URL('../../../docs/casa-finance-constitution.md', import.meta.url), 'utf8');

test('new expense asks the four financial questions explicitly', () => {
  assert.match(screen, /1 · Quem comprou\?/);
  assert.match(screen, /2 · Quem assume o gasto\?/);
  assert.match(screen, /3 · Como foi pago\?/);
  assert.match(screen, /4 · Quem bancou e quando saiu\?/);
  assert.match(screen, /Confira antes de salvar/);
});

test('account or cash means immediate cash movement without inferring the funder', () => {
  assert.match(screen, /Conta \/ carteira \/ dinheiro/);
  assert.match(screen, /o Casa registra a saída agora e atualiza o saldo real desse recurso/i);
  assert.match(screen, /createAndSettleDirectExpense/);
  assert.match(screen, /Não é preenchido pelo comprador nem pelo titular da conta/);
  assert.doesNotMatch(screen, /Não, pagarei depois/);
  assert.match(constitution, /Comprador, titular do instrumento, responsável econômico e pagador\/funder são independentes/);
});

test('paid direct expense uses one atomic canonical command', () => {
  assert.match(service, /rpc\('create_and_settle_direct_expense'/);
  assert.doesNotMatch(service, /from\('funding_events'\)\.insert/);
  assert.doesNotMatch(service, /from\('money_movements'\)\.insert/);
});

test('card path defers cash and funder to invoice payment', () => {
  assert.match(screen, /O caixa só sai quando a fatura for paga/);
  assert.match(screen, /titular do cartão não é presumido como pagador/);
  assert.match(screen, /Sai na fatura · pagador ainda não definido/);
});

test('investment is not a direct spending source and liquidity pressure remains visible', () => {
  assert.match(screen, /account\.type !== 'investment'/);
  assert.match(screen, /zerar o recurso ou colocar uma conta no negativo\/LIS/);
  assert.match(screen, /Reserva\/investimento não é usado diretamente aqui/);
  assert.match(screen, /empréstimo entra como dívida, nunca como renda/);
});
