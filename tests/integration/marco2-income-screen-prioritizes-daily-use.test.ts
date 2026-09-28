import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx', import.meta.url), 'utf8');
const creation = await readFile(new URL('../../src/components/app/IncomeCreationAction.tsx', import.meta.url), 'utf8');
const period = await readFile(new URL('../../src/components/app/FinancialPeriodNavigator.tsx', import.meta.url), 'utf8');
const categories = await readFile(new URL('../../src/components/app/FinancialCategoryBreakdown.tsx', import.meta.url), 'utf8');

test('Entradas abre como lista e a criação só aparece quando a ação global solicita', () => {
  assert.match(source, /<IncomeCreationAction onCreated=\{\(\)=>\{refresh\(\);setIncomeSaved\(true\);\}\} openRequestId=\{createRequestId\}\/>/);
  assert.match(creation,/if\(!open\)return null/);
  assert.match(creation,/openRequestId>0/);
  assert.match(creation,/aria-label="Nova entrada"/);
});

test('criação recorrente pertence à Nova Entrada e gestão continua na ocorrência', () => {
  assert.match(creation,/Repetir esta entrada/);
  assert.match(creation,/createRecurringIncomeRule/);
  assert.doesNotMatch(source,/<RecurringIncomeAction/);
  assert.match(source, /Gerenciar esta recorrência/);
  assert.match(source, /recurringRuleByTransaction/);
  assert.match(source, /focusRuleId=\{activeRecurringRuleId\}/);
});

test('receipt is contextual to Home intent or the selected income detail', () => {
  assert.match(source, /initialMoneyMovementId&&<IncomeReceiptAction initialMoneyMovementId=\{initialMoneyMovementId\}/);
  assert.match(source, /<IncomeReceiptAction initialTransactionId=\{detailTransaction\.id\}/);
  assert.doesNotMatch(source, />Outras ações</);
});

test('empty state keeps the selected period explicit', () => {
  assert.match(source, /Nenhuma entrada neste período/);
  assert.match(source, /Altere o mês ou o período/);
});


test('Entradas exposes monthly navigation custom range and listed total',()=>{
  assert.match(source,/FinancialPeriodNavigator/);
  assert.match(source,/monthAriaLabel="Escolher mês das entradas"/);
  assert.match(period,/Mês anterior/);
  assert.match(period,/Mês seguinte/);
  assert.match(period,/Mês inteiro/);
  assert.match(period,/Personalizado/);
  assert.match(source,/periodPickerOpen/);
  assert.match(source,/<IncomeSummary total=\{total\} count=\{visibleRows\.length\} categories=\{categorySummary\}\/>/);
  assert.match(source,/rangeStart/);
  assert.match(source,/rangeEnd/);
});

test('Entradas turns category beneficiary date and state into scannable visual tags',()=>{
  assert.match(source,/getCategoryVisual/);
  assert.match(source,/beneficiariesByTransaction/);
  assert.match(source,/formatDate\(row\.transaction_date\)/);
  assert.match(source,/role="button"/);
  assert.match(source,/Detalhe da entrada/);
});


test('Entradas derives its initial month from the household financial clock',()=>{
  assert.match(source,/monthInTimeZone=\(timeZone:string\)=>dateInTimeZone\(timeZone\)\.slice\(0,7\)/);
  assert.match(source,/monthInTimeZone\(household\?\.timezone\?\?'America\/Sao_Paulo'\)/);
  assert.match(source,/monthInTimeZone\(household\.timezone\)/);
});

test('income visual tag remains deterministic when canonical movements involve more than one beneficiary',()=>{
  assert.match(source,/new Map<string,string\[\]>\(\)/);
  assert.match(source,/current\.includes\(item\.beneficiary_member_id\)/);
  assert.match(source,/names\.join\(' \+ '\)/);
});


test('Entradas follows Gastos hierarchy: period, perspective, total and categories',()=>{
  const periodPosition=source.indexOf('<FinancialPeriodNavigator');
  const perspective=source.indexOf('<FinancialPerspectiveSelector');
  const total=source.indexOf('<IncomeSummary');
  assert.ok(periodPosition>=0&&perspective>periodPosition&&total>perspective);
  assert.match(source,/FinancialCategoryBreakdown/);
  assert.match(categories,/Ver categorias/);
  assert.match(source,/categorySummary/);
});

test('income item opens contextual detail instead of exposing maintenance in every row',()=>{
  assert.match(source,/setDetailTransaction\(row\)/);
  assert.match(source,/aria-label="Detalhe da entrada"/);
  assert.match(source,/IncomeFactManagement transaction=\{detailTransaction\}/);
  assert.doesNotMatch(source,/<summary className="cursor-pointer list-none text-xs font-semibold text-slate-500 hover:text-slate-300">Detalhes e ações<\/summary>/);
});
