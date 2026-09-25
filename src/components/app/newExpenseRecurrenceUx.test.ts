import assert from 'node:assert/strict';
import test from 'node:test';
import { minimumRecurringStartDate, suggestRecurringStartDate } from './newExpenseRecurrenceUx.js';

test('sugere a próxima recorrência mensal depois de hoje sem inventar fato passado',()=>{
  assert.equal(suggestRecurringStartDate('2026-09-10','2026-09-25'),'2026-10-10');
  assert.equal(minimumRecurringStartDate('2026-09-10','2026-09-25'),'2026-09-26');
});

test('preserva o dia âncora e ajusta meses curtos',()=>{
  assert.equal(suggestRecurringStartDate('2026-01-31','2026-02-02'),'2026-02-28');
  assert.equal(suggestRecurringStartDate('2024-01-31','2024-02-29'),'2024-03-31');
});

test('avança quantos meses forem necessários quando a despesa original é antiga',()=>{
  assert.equal(suggestRecurringStartDate('2026-07-01','2026-09-25'),'2026-10-01');
  assert.equal(suggestRecurringStartDate('2000-01-01','2026-09-25'),'2026-10-01');
});

test('a primeira repetição continua estritamente depois do gasto e de hoje',()=>{
  assert.equal(suggestRecurringStartDate('2026-09-25','2026-09-25'),'2026-10-25');
  assert.equal(suggestRecurringStartDate('2026-08-31','2026-09-30'),'2026-10-31');
});
