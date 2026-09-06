import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ui=await readFile(new URL('./RecurringExpenseCommitmentCenter.tsx',import.meta.url),'utf8');
const screen=await readFile(new URL('./TransactionsScreen.tsx',import.meta.url),'utf8');
const service=await readFile(new URL('../../finance/recurringExpenseCommitments.ts',import.meta.url),'utf8');
const constitution=await readFile(new URL('../../../docs/casa-finance-constitution.md',import.meta.url),'utf8');

test('Gastos surfaces actionable recurring commitments before generic payment tools',()=>{
  assert.match(screen,/RecurringExpenseCommitmentCenter/);
  assert.ok(screen.indexOf('<RecurringExpenseCommitmentCenter')<screen.indexOf('<DirectExpensePaymentAction'));
  assert.match(ui,/Contas previstas para pagar/);
  assert.match(ui,/já reduzem o que o Casa considera livre na projeção/i);
});

test('forecast route is context and payment can use another real account',()=>{
  assert.match(ui,/rota planejada, não uma saída de caixa/i);
  assert.match(ui,/De onde o dinheiro realmente saiu\?/);
  assert.match(ui,/Quem efetivamente bancou\?/);
  assert.match(ui,/pagar de outra forma/i);
  assert.match(constitution,/Previsto não é realizado/);
});

test('occurrence value edit is separate from future series edit',()=>{
  assert.match(ui,/Editar\/confirmar valor/);
  assert.match(ui,/altera somente esta ocorrência, não a série futura/i);
  assert.match(service,/rpc\('confirm_recurring_expense_occurrence'/);
});

test('payment uses dedicated canonical occurrence settlement command',()=>{
  assert.match(service,/rpc\('settle_recurring_expense_occurrence'/);
  assert.doesNotMatch(service,/from\('money_movements'\)\.insert/);
  assert.doesNotMatch(service,/from\('funding_events'\)\.insert/);
});
