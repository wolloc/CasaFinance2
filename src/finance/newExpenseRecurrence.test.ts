import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recurringExpenseEndDate } from './newExpenseRecurrence.js';

test('six months means six future occurrences including the first repetition', () => {
  assert.equal(recurringExpenseEndDate('2026-10-25', 6), '2027-03-25');
});

test('recurrence duration preserves the monthly anchor across short months', () => {
  assert.equal(recurringExpenseEndDate('2026-01-31', 2), '2026-02-28');
  assert.equal(recurringExpenseEndDate('2026-01-31', 3), '2026-03-31');
});

test('invalid occurrence count is rejected', () => {
  assert.throws(() => recurringExpenseEndDate('2026-10-25', 0), /Quantidade de ocorrências inválida/);
});
