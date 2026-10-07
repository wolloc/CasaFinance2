import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const screen=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
const role=await readFile(new URL('../../src/components/app/ExpenseRoleCorrectionAction.tsx',import.meta.url),'utf8');

test('detalhe do gasto prioriza lançamento e ações antes da responsabilidade',()=>{
  assert.match(screen,/Detalhe do gasto/);
  assert.match(screen,/HouseholdTransactionsSetup embedded mode="expense"/);
  assert.match(screen,/ExpenseRoleCorrectionAction initialTransactionId=\{detailTransactionId\} onCompleted=/);
  assert.match(role,/defaultOpen=false/);
  assert.match(role,/Quem fica com este compromisso\?/);
});

test('responsabilidade fica secundária e recolhida por padrão',()=>{
  assert.match(role,/Responsabilidade/);
  assert.match(role,/open=\{defaultOpen\}/);
});
