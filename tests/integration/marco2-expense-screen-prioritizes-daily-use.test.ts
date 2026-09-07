import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/TransactionsScreen.tsx', import.meta.url), 'utf8');

test('daily expense flow appears before secondary actions', () => {
  const daily = source.indexOf('<HouseholdTransactionsSetup');
  const advanced = source.indexOf('<details');
  assert.ok(daily >= 0, 'daily expense flow must be present');
  assert.ok(advanced > daily, 'secondary tools must come after the daily flow');
  assert.match(source, /Precisa fazer algo diferente\?/);
});

test('contextual intents remain visible without opening secondary tools', () => {
  assert.match(source, /projectionExpenseIntent && <ForecastExpenseReviewCard/);
  assert.match(source, /recurringIntent && <RecurringExpenseCommitmentCenter/);
  assert.match(source, /directExpenseIntent && <DirectExpensePaymentAction/);
});

test('secondary actions are grouped by human intent without losing any canonical component', () => {
  const advanced = source.slice(source.indexOf('<details'));
  for (const group of ['Formas especiais de pagar', 'Recebeu dinheiro de volta?', 'Corrigir quem participou do gasto', 'Gastos que se repetem']) assert.ok(advanced.includes(group), `${group} must be visible`);
  for (const component of ['CardPixExpenseAction','DirectExpensePaymentAction','ExternalExpensePaymentAction','PartialDirectRefundAction','CardRefundAction','PostPaymentCardRefundAction','ExpenseRoleCorrectionAction','RecurringExpenseCommitmentCenter','RecurringExpenseAction','RecurringExpenseManagement']) {
    assert.ok(advanced.includes(`<${component}`), `${component} must remain reachable`);
  }
});

test('grouping only changes navigation and does not add a financial write',()=>{
  assert.doesNotMatch(source,/\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
});
