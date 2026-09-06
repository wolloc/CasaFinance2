import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const appSource = await readFile(new URL('./CasaFinanceApp.tsx', import.meta.url), 'utf8');
const transactionScreenSource = await readFile(new URL('./TransactionsScreen.tsx', import.meta.url), 'utf8');
const transactionSetupSource = await readFile(new URL('../auth/HouseholdTransactionsSetup.tsx', import.meta.url), 'utf8');
const productSpec = await readFile(new URL('../../../docs/product-spec-v2.md', import.meta.url), 'utf8');

test('bottom navigation follows the Product Spec v2 canonical tabs', () => {
  const tabsBlock = appSource.slice(appSource.indexOf('const tabs ='), appSource.indexOf('export function CasaFinanceApp'));
  for (const label of ['Casa', 'Gastos', 'Entradas', 'Ajustes']) {
    assert.ok(tabsBlock.includes(`'${label}'`));
    assert.ok(productSpec.includes(`**${label}**`));
  }
  assert.doesNotMatch(tabsBlock, /'Lançamentos'|'Faturas'/);
  const indexes = ['Casa', 'Gastos', 'Entradas', 'Ajustes'].map((label) => tabsBlock.indexOf(`'${label}'`));
  assert.deepEqual([...indexes].sort((a, b) => a - b), indexes);
});

test('Faturas is contextual to Casa instead of a bottom tab', () => {
  assert.match(appSource, /setScreen\('invoices'\)/);
  assert.match(appSource, />Faturas</);
  assert.match(appSource, /screen === 'invoices' \? 'home' : screen/);
  assert.match(appSource, /Voltar para Casa/);
});

test('Gastos and Entradas use independent fixed transaction modes', () => {
  assert.match(appSource, /TransactionsScreen mode="expense"/);
  assert.match(appSource, /TransactionsScreen mode="income"/);
  assert.match(transactionScreenSource, /mode: TransactionKind/);
  assert.match(transactionScreenSource, /HouseholdTransactionsSetup embedded mode=\{mode\}/);
  assert.match(transactionSetupSource, /visibleTransactions = mode \? transactions\.filter\(\(transaction\) => transaction\.type === mode\)/);
  assert.match(transactionSetupSource, /!mode && <label[^>]*>Tipo/);
});

test('separated screens preserve buyer and responsibility semantics for expenses', () => {
  assert.match(transactionSetupSource, /Quem realizou esta compra\?/);
  assert.match(transactionSetupSource, /Responsabilidade econômica/);
  assert.match(transactionSetupSource, /buyerMemberId: kind === 'expense'/);
  assert.match(transactionSetupSource, /instrumentKind: kind === 'expense'/);
});
