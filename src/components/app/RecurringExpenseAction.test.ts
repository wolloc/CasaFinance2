import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui = await readFile(new URL('./RecurringExpenseAction.tsx', import.meta.url), 'utf8');
const service = await readFile(new URL('../../finance/recurringExpenses.ts', import.meta.url), 'utf8');
const screen = await readFile(new URL('./TransactionsScreen.tsx', import.meta.url), 'utf8');

test('recurring expenses use dedicated canonical RPCs', () => {
  assert.match(service, /create_recurring_expense_rule_from_transaction/);
  assert.match(service, /ensure_household_recurring_expense_horizon/);
  assert.doesNotMatch(service, /create_financial_transaction/);
});

test('Gastos exposes recurring expense flow with independent financial roles', () => {
  assert.match(screen, /<RecurringExpenseAction/);
  assert.match(ui, /preserva quem comprou, quem assume economicamente e o instrumento/);
  assert.match(ui, /nunca presume quem vai efetivamente pagar/);
  assert.match(ui, /responsabilidade econômica é copiada do ledger, não do titular do instrumento/);
});

test('complex downstream facts are not offered as simple recurring templates', () => {
  assert.match(ui, /!row\.mutation_dependencies\.has_installment_plan/);
  assert.match(ui, /!row\.mutation_dependencies\.has_financial_obligation/);
  assert.match(ui, /!row\.mutation_dependencies\.has_external_payment_event/);
  assert.match(ui, /!row\.mutation_dependencies\.has_recurring_occurrence/);
});
