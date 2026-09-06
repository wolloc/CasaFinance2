import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('./RecurringIncomeAction.tsx', import.meta.url), 'utf8');
const ledger = await readFile(new URL('./IncomeLedgerScreen.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../finance/recurringIncome.ts', import.meta.url), 'utf8');

test('recurring income uses dedicated canonical RPCs', () => {
  assert.match(service, /rpc\('create_recurring_income_rule'/);
  assert.match(service, /rpc\('ensure_household_recurring_income_horizon'/);
  assert.doesNotMatch(service, /create_financial_transaction|createHouseholdTransaction/);
});

test('series UX keeps each occurrence independent and explicit', () => {
  assert.match(ui, /Renda recorrente/);
  assert.match(ui, /Mensal/);
  assert.match(ui, /Anual/);
  assert.match(ui, /De quem é esta renda\?/);
  assert.match(ui, /Onde espera receber\?/);
  assert.match(ui, /Cada competência vira uma renda separada/);
  assert.match(ui, /receber um mês não altera os próximos/);
});

test('Entradas extends the recurring horizon before listing income facts', () => {
  assert.match(ledger, /ensureRecurringIncomeHorizon/);
  assert.match(ledger, /<RecurringIncomeAction onCreated=\{refresh\}\/>/);
});
