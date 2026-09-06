import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('./RecurringExpenseManagement.tsx', import.meta.url), 'utf8');
const screen = await readFile(new URL('./TransactionsScreen.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../finance/recurringExpenses.ts', import.meta.url), 'utf8');

test('Gastos exposes prospective recurring series management', () => {
  assert.match(screen, /RecurringExpenseManagement/);
  assert.match(ui, /Alterar futuro/);
  assert.match(ui, /Encerrar/);
  assert.match(ui, /Vale a partir de/);
  assert.match(ui, /Por que está mudando\?/);
});

test('expense series management uses dedicated audited RPCs', () => {
  assert.match(service, /rpc\('revise_recurring_expense_rule'/);
  assert.match(service, /rpc\('close_recurring_expense_rule'/);
  assert.doesNotMatch(service, /from\('transactions'\)\.update|from\('transactions'\)\.delete/);
});

test('UX explains that concrete downstream effects block retrospective change', () => {
  assert.match(ui, /já virou fatura/);
  assert.match(ui, /recebeu funding/);
  assert.match(ui, /o Casa bloqueia a mudança/);
  assert.match(ui, /O passado permaneceu intacto/);
});
