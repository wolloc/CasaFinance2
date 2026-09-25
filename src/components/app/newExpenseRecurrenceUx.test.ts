import assert from 'node:assert/strict';
import test from 'node:test';
import { minimumRecurringStartDate, suggestRecurringStartDate } from './newExpenseRecurrenceUx.js';

test('sugere a próxima recorrência mensal depois de hoje sem inventar fato passado',()=>{
  assert.equal(suggestRecurringStartDate('2026-09-10','2026-09-25','monthly',1),'2026-10-10');
  assert.equal(minimumRecurringStartDate('2026-09-10','2026-09-25'),'2026-09-26');
});

test('preserva o dia âncora e ajusta meses curtos',()=>{
  assert.equal(suggestRecurringStartDate('2026-01-31','2026-02-02','monthly',1),'2026-02-28');
  assert.equal(suggestRecurringStartDate('2024-02-29','2026-01-01','yearly',1),'2026-02-28');
});

test('avança quantos ciclos forem necessários quando a despesa original é antiga',()=>{
  assert.equal(suggestRecurringStartDate('2026-07-01','2026-09-25','monthly',1),'2026-10-01');
  assert.equal(suggestRecurringStartDate('2026-09-01','2026-09-25','weekly',1),'2026-09-29');
});

test('respeita intervalos maiores que um período',()=>{
  assert.equal(suggestRecurringStartDate('2026-09-10','2026-09-25','monthly',2),'2026-11-10');
  assert.equal(suggestRecurringStartDate('2026-09-10','2026-09-25','weekly',2),'2026-10-08');
});
