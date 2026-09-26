import assert from 'node:assert/strict';
import { test } from 'node:test';
import { recurringIncomeEndDate } from './recurringIncome.js';

test('monthly recurring income counts the first informed entry as occurrence one', () => {
  assert.equal(recurringIncomeEndDate('2026-09-25','monthly',6),'2027-02-25');
});

test('monthly recurring income preserves the original monthly anchor across short months', () => {
  assert.equal(recurringIncomeEndDate('2026-01-31','monthly',2),'2026-02-28');
  assert.equal(recurringIncomeEndDate('2026-01-31','monthly',3),'2026-03-31');
});

test('yearly recurring income keeps the annual anchor when possible', () => {
  assert.equal(recurringIncomeEndDate('2028-02-29','yearly',2),'2029-02-28');
  assert.equal(recurringIncomeEndDate('2028-02-29','yearly',5),'2032-02-29');
});

test('invalid recurring income duration is rejected', () => {
  assert.throws(()=>recurringIncomeEndDate('2026-09-25','monthly',0),/Quantidade de ocorrências inválida/);
});
