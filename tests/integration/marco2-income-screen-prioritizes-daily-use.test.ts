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

test('recorrências ficam depois da lista principal e sob demanda', () => {
  const ledger = source.indexOf('<section className="space-y-3">');
  const advanced = source.indexOf('<details');
  assert.ok(ledger >= 0 && advanced > ledger);
  assert.match(source, /Recorrências e outras ações/);
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
  assert.match(source,/Escolher período personalizado/);
  assert.match(source,/Total listado/);
  assert.match(source,/rangeStart/);
  assert.match(source,/rangeEnd/);
});

test('Entradas turns category beneficiary date and state into scannable visual tags',()=>{
  assert.match(source,/getCategoryVisual/);
  assert.match(source,/beneficiaryByTransaction/);
  assert.match(source,/formatDate\(row\.transaction_date\)/);
  assert.match(source,/Detalhes e ações/);
});
