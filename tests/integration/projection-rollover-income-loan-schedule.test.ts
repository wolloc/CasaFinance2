import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration=await readFile(new URL('../../supabase/migrations/20260930043500_projection_rollover_income_loan_schedule.sql',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const statement=await readFile(new URL('../../src/components/app/MonthlyPositionStatement.tsx',import.meta.url),'utf8');
const overdue=await readFile(new URL('../../src/finance/overdueCommitments.ts',import.meta.url),'utf8');
const priority=await readFile(new URL('../../src/components/app/FinancialPriorityCenter.tsx',import.meta.url),'utf8');
const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');

test('explicit forecast income participates in projection without becoming realized cash',()=>{
  assert.match(migration,/m\.state='projected'[\s\S]*t\.economic_state in \('forecast','confirmed'\)/);
  assert.match(migration,/coalesce\(t\.confirmed_amount,t\.estimated_amount,t\.amount\)-t\.realized_amount/);
  assert.doesNotMatch(migration,/update public\.money_movements[\s\S]*state='realized'/);
  assert.match(home,/ensureRecurringIncomeHorizon/);
  assert.match(statement,/Entradas previstas ainda esperadas/);
});

test('canonical loan schedule replaces whole-loan payable in monthly commitments',()=>{
  assert.match(migration,/'loan_schedule:'::text \|\| s\.id::text/);
  assert.match(migration,/JOIN loan_schedule_items s ON s\.principal_obligation_id = o\.id/);
  assert.match(migration,/s\.principal_amount \+ s\.projected_interest_amount \+ s\.projected_fee_amount/);
  assert.match(migration,/NOT \(EXISTS \( SELECT 1[\s\S]*FROM loan_schedule_items ls[\s\S]*ls\.principal_obligation_id = o\.id/);
  assert.match(migration,/principal repayment remains cash\/liability settlement/);
});

test('overdue loan installment becomes actionable without being called a new expense',()=>{
  assert.match(migration,/c\.source_type='loan_schedule_item'/);
  assert.match(migration,/not exists\(select 1 from public\.loan_schedule_items ls[\s\S]*principal_obligation_id=b\.obligation_id/);
  assert.match(overdue,/kind: 'loan'; obligationId: string/);
  assert.match(overdue,/source_type === 'loan_schedule_item'/);
  assert.match(priority,/loan_schedule_item'\?'Ver empréstimo'/);
  assert.match(app,/context\?\.kind==='loan'[\s\S]*kind:'loan-detail'/);
});

test('individual projection never silently consumes unattributed household funding',()=>{
  assert.match(home,/unattributed_funding_remaining/);
  assert.match(home,/não foi descontado do seu saldo nem atribuído ao outro morador automaticamente/);
  assert.match(home,/sem rota individual definida/);
  assert.match(home,/não foi tirado automaticamente do seu saldo/);
});
