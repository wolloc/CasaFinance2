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
  assert.match(ui,/já entram na previsão do mês/i);
});

test('planned account is context and payment can use another real account',()=>{
  assert.match(ui,/é a que você imaginava usar/i);
  assert.match(ui,/De qual conta o dinheiro saiu\?/);
  assert.match(ui,/Quem pagou com o próprio dinheiro\?/);
  assert.match(ui,/pagar por outra conta/i);
  assert.match(constitution,/Previsto não é realizado/);
});

test('this month value edit is separate from future months',()=>{
  assert.match(ui,/Conferir valor/);
  assert.match(ui,/vale só para esta conta deste mês; os próximos meses não mudam/i);
  assert.match(service,/rpc\('confirm_recurring_expense_occurrence'/);
});

test('payment uses dedicated canonical occurrence settlement command',()=>{
  assert.match(service,/rpc\('settle_recurring_expense_occurrence'/);
  assert.doesNotMatch(service,/from\('money_movements'\)\.insert/);
  assert.doesNotMatch(service,/from\('funding_events'\)\.insert/);
});
