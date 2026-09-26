import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../../src/components/app/IncomeLedgerScreen.tsx', import.meta.url), 'utf8');
const creation = await readFile(new URL('../../src/components/app/IncomeCreationAction.tsx', import.meta.url), 'utf8');

test('Entradas abre como lista e a criação só aparece quando a ação global solicita', () => {
  assert.match(source, /<IncomeCreationAction onCreated=\{refresh\} openRequestId=\{createRequestId\}\/>/);
  assert.match(creation,/if\(!open\)return null/);
  assert.match(creation,/openRequestId>0/);
  assert.match(creation,/aria-label="Nova entrada"/);
});

test('criação recorrente fica sob demanda e gestão pertence à ocorrência', () => {
  const ledger = source.indexOf('<section className="space-y-3">');
  const advanced = source.indexOf('Outras ações');
  assert.ok(ledger >= 0 && advanced > ledger);
  assert.match(source, /Gerenciar esta recorrência/);
  assert.match(source, /recurringRuleByTransaction/);
  assert.match(source, /focusRuleId=\{activeRecurringRuleId\}/);
});

test('contextual receipt stays visible when Home opens a delayed income', () => {
  assert.match(source, /initialMoneyMovementId&&<IncomeReceiptAction initialMoneyMovementId=\{initialMoneyMovementId\}/);
});

test('empty state keeps the selected period explicit', () => {
  assert.match(source, /Nenhuma entrada neste período/);
  assert.match(source, /Altere o mês ou o período/);
});


test('Entradas exposes monthly navigation custom range and listed total',()=>{
  assert.match(source,/Mês anterior/);
  assert.match(source,/Mês seguinte/);
  assert.match(source,/Escolher mês das entradas/);
  assert.match(source,/Toque para escolher o período/);
  assert.match(source,/Mês inteiro/);
  assert.match(source,/Personalizado/);
  assert.match(source,/periodPickerOpen/);
  assert.match(source,/Total listado/);
  assert.match(source,/rangeStart/);
  assert.match(source,/rangeEnd/);
});

test('Entradas turns category beneficiary date and state into scannable visual tags',()=>{
  assert.match(source,/getCategoryVisual/);
  assert.match(source,/beneficiariesByTransaction/);
  assert.match(source,/formatDate\(row\.transaction_date\)/);
  assert.match(source,/Detalhes e ações/);
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
