import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/TransactionsScreen.tsx', import.meta.url), 'utf8');

test('daily expense flow appears before advanced adjustment tools', () => {
  const daily = source.indexOf('<HouseholdTransactionsSetup');
  const advanced = source.indexOf('<details');
  assert.ok(daily >= 0, 'daily expense flow must be present');
  assert.ok(advanced > daily, 'advanced tools must come after the daily flow');
  assert.match(source, /Precisa ajustar algo\?/);
  assert.match(source, /Estornos, pagamentos por terceiros, correções e recorrências ficam aqui/);
});

test('contextual intents remain visible without opening advanced tools', () => {
  assert.match(source, /projectionExpenseIntent && <ForecastExpenseReviewCard/);
  assert.match(source, /recurringIntent && <RecurringExpenseCommitmentCenter/);
  assert.match(source, /directExpenseIntent && <DirectExpensePaymentAction/);
});

test('advanced tools are still reachable inside the secondary area', () => {
  const advanced = source.slice(source.indexOf('<details'));
  for (const component of ['ExternalExpensePaymentAction', 'PartialDirectRefundAction', 'CardRefundAction', 'PostPaymentCardRefundAction', 'ExpenseRoleCorrectionAction', 'RecurringExpenseAction', 'RecurringExpenseManagement']) {
    assert.ok(advanced.includes(`<${component}`), `${component} must remain reachable`);
  }
});
