import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const screen = await readFile(new URL('./HouseholdTransactionsSetup.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../finance/explicitExpenseCreation.ts', import.meta.url), 'utf8');
const constitution = await readFile(new URL('../../../docs/casa-finance-constitution.md', import.meta.url), 'utf8');

test('new expense asks the four financial questions explicitly', () => {
  assert.match(screen, /1 · Quem comprou\?/);
  assert.match(screen, /2 · Quem assume o gasto\?/);
  assert.match(screen, /3 · Como foi financiado\?/);
  assert.match(screen, /4 · O dinheiro já saiu\?/);
  assert.match(screen, /Confira antes de salvar/);
});

test('account instrument does not imply payment or funder', () => {
  assert.match(screen, /Sim, já saiu/);
  assert.match(screen, /Não, pagarei depois/);
  assert.match(screen, /não inventa pagador nem saída de caixa/i);
  assert.match(screen, /Não é preenchido pelo comprador nem pelo titular da conta/);
  assert.match(constitution, /Comprador, titular do instrumento, responsável econômico e pagador\/funder são independentes/);
});

test('paid-now direct expense uses one atomic canonical command', () => {
  assert.match(screen, /createAndSettleDirectExpense/);
  assert.match(service, /rpc\('create_and_settle_direct_expense'/);
  assert.doesNotMatch(service, /from\('funding_events'\)\.insert/);
  assert.doesNotMatch(service, /from\('money_movements'\)\.insert/);
});

test('card path defers cash and funder to invoice payment', () => {
  assert.match(screen, /O caixa só sai quando a fatura for paga/);
  assert.match(screen, /titular do cartão não é presumido como pagador/);
  assert.match(screen, /Sai na fatura · pagador ainda não definido/);
});
