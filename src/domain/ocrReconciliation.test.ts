import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOcrResult } from './ocrReconciliation.js';

test('invoice total is derived from items instead of creating a second expense', () => {
  const result = validateOcrResult({ document_type: 'INVOICE', total_amount: 999, items: [
    { description: 'Compra A', amount: 10, transaction_date: '2026-09-01' },
    { description: 'Compra B', amount: 20, transaction_date: '2026-09-02' }
  ] }, '2026-09-03');
  assert.equal(result.total_amount, 30);
  assert.equal(result.items.length, 2);
});

test('invalid and uncertain AI fields are normalized and flagged', () => {
  const result = validateOcrResult({ document_type: 'RECEIPT', items: [{ amount: -2 }] }, '2026-09-03');
  assert.equal(result.items[0].amount, 0);
  assert.deepEqual(result.items[0].review_reasons, ['Valor ausente ou inválido', 'Descrição não identificada', 'Data inferida']);
});
