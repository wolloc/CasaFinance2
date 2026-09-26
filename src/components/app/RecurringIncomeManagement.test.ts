import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('./RecurringIncomeManagement.tsx', import.meta.url), 'utf8');
const ledger = await readFile(new URL('./IncomeLedgerScreen.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../finance/recurringIncome.ts', import.meta.url), 'utf8');

test('recurring income management is exposed from the recurring entry', () => {
  assert.match(ledger, /RecurringIncomeManagement refreshKey=\{refreshKey\} focusRuleId=\{activeRecurringRuleId\}/);
  assert.match(ledger, /Gerenciar esta recorrência/);
  assert.match(ui, /focusRuleId/);
  assert.match(ui, /Entradas que se repetem/);
  assert.match(ui, /Mudar próximos meses/);
  assert.match(ui, /Parar recorrência/);
});

test('future revision and closure use dedicated canonical RPCs', () => {
  assert.match(service, /rpc\('revise_recurring_income_rule'/);
  assert.match(service, /rpc\('close_recurring_income_rule'/);
  assert.doesNotMatch(service, /update_basic_transaction|create_financial_transaction/);
});

test('UX makes future-only semantics explicit and requires a reason', () => {
  assert.match(ui, /podem mudar daqui para frente sem alterar os meses que já passaram nem valores que você já recebeu/);
  assert.match(ui, /Conte o motivo da mudança\. Assim você consegue entender depois o que aconteceu/);
  assert.match(ui, /Entradas anteriores e valores já recebidos continuam como estavam/);
});
