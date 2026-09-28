import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const expenses=await readFile(new URL('../../src/components/app/ExpenseMonthBrowser.tsx',import.meta.url),'utf8');
const expenseViews=await readFile(new URL('../../src/finance/expenseMonthViews.ts',import.meta.url),'utf8');
const settings=await readFile(new URL('../../src/components/app/SettingsScreen.tsx',import.meta.url),'utf8');
const actions=await readFile(new URL('../../src/components/app/GlobalActions.tsx',import.meta.url),'utf8');
const adjustment=await readFile(new URL('../../src/components/app/NewAdjustmentScreen.tsx',import.meta.url),'utf8');

test('expense list prioritizes purchase date and hides technical states',()=>{
  assert.match(expenses,/formatDate\(row\.economic_date\)/);
  assert.doesNotMatch(expenses,/Pago\/realizado|stateLabel\(/);
  assert.match(expenses,/row\.instrument_label\?\?instrumentLabel/);
  assert.match(expenses,/>Valor<\/span>/);
  assert.match(expenseViews,/instrument_label/);
  assert.match(expenseViews,/account:accounts\(name,institution\)/);
  assert.match(expenseViews,/card:cards\(name,institution,last_four\)/);
});

test('settings root uses one navigation pattern for the four configuration resources',()=>{
  for(const title of ['Casa e membros','Pessoas','Contas e cartões','Categorias']){
    assert.match(settings,new RegExp('title="'+title+'"'));
  }
  assert.match(settings,/area==='household'/);
  assert.match(settings,/area==='people'/);
});

test('global creation control is joined and draggable',()=>{
  assert.match(actions,/GripVertical/);
  assert.match(actions,/onPointerMove/);
  assert.match(actions,/>Gasto<\/button>/);
  assert.match(actions,/>Entrada<\/button>/);
});

test('resource transfer keeps source context and renders compatible destinations as cards',()=>{
  assert.match(adjustment,/transferSource\.name/);
  assert.match(adjustment,/transferDestinations/);
  assert.match(adjustment,/FinancialResourceChoice/);
});
