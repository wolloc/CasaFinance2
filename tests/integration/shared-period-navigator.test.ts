import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const shared=await readFile(new URL('../../src/components/app/FinancialPeriodNavigator.tsx',import.meta.url),'utf8');
const income=await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx',import.meta.url),'utf8');
const expense=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');

test('Casa Entradas and Gastos share the same period navigation component',()=>{
 for(const source of[income,expense,home])assert.match(source,/FinancialPeriodNavigator/);
 assert.match(shared,/Mês inteiro/);
 assert.match(shared,/Personalizado/);
 assert.match(shared,/Mês atual/);
 assert.match(shared,/aria-label="Mês anterior"/);
 assert.match(shared,/aria-label="Mês seguinte"/);
});

test('custom range stays exclusive to list screens while Casa remains canonical monthly',()=>{
 assert.match(income,/allowCustomRange/);
 assert.match(expense,/allowCustomRange/);
 assert.doesNotMatch(home,/allowCustomRange/);
 assert.match(home,/pickerDescription="A Home usa mês financeiro canônico/);
});
