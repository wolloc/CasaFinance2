import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const expense=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');

test('Entradas ganha busca na mesma posição lógica de Gastos',()=>{
  const summary=income.indexOf('IncomeSummary');
  const search=income.indexOf('Buscar entradas deste período');
  const list=income.indexOf('<section className="space-y-3">');
  assert.ok(summary>=0&&search>summary&&list>search);
  assert.match(income,/Buscar entrada, categoria ou pessoa/);
  assert.match(income,/filteredVisibleRows/);
  assert.match(income,/Nenhuma entrada corresponde à busca/);
});

test('busca não muda o total do período',()=>{
  assert.match(income,/IncomeSummary total=\{total\} count=\{visibleRows\.length\}/);
  assert.match(income,/filteredVisibleRows\.length/);
});

test('linhas de Entrada e Gasto compartilham escala visual',()=>{
  for(const source of [income,expense]){
    assert.match(source,/h-10 w-10 shrink-0/);
    assert.match(source,/text-sm font-bold/);
    assert.match(source,/text-base font-black/);
    assert.match(source,/text-\[11px\]/);
  }
});


test('Entradas e Gastos usam timeline visual sem agrupar os cards',()=>{
  assert.match(income,/sortedVisibleRows/);
  assert.match(expense,/sortedFinancialRows/);
  assert.match(expense,/sortedEconomicRows/);
  for(const source of [income,expense]){
    assert.match(source,/left-3 top-0 w-px/);
    assert.match(source,/rounded-full ring-4 ring-slate-900/);
    assert.match(source,/localeCompare/);
  }
  assert.doesNotMatch(income,/groupByDate|groupedVisibleRows/);
  assert.doesNotMatch(expense,/groupByDate|groupedFinancialRows|groupedEconomicRows/);
});
