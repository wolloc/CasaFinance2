import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration=await readFile(new URL('../../supabase/migrations/20261001093000_member_planned_payer_responsibility.sql',import.meta.url),'utf8');
const loan=await readFile(new URL('../../src/components/app/LoanAdjustment.tsx',import.meta.url),'utf8');
const detail=await readFile(new URL('../../src/components/app/LoanPayerPlanEditor.tsx',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');

test('planned member payer model does not invent a payment account',()=>{
  assert.match(migration,/create table public\.obligation_member_payer_plans/);
  assert.match(migration,/set_obligation_member_payer_plan/);
  assert.match(migration,/financial_member_payer_plan_funding_positions/);
  assert.match(migration,/without inventing a source account/i);
});

test('taken loan asks who will pay and supports shared responsibility',()=>{
  assert.match(loan,/Quem ficará responsável pelo pagamento\?/);
  assert.match(loan,/Dividido/);
  assert.match(loan,/setLoanPayerPlan/);
  assert.match(loan,/A conta usada no pagamento continua sendo escolhida quando a parcela for realmente paga/);
});

test('existing loan can define payer responsibility later',()=>{
  assert.match(detail,/Quem paga as parcelas\?/);
  assert.match(detail,/Salvar responsável/);
  assert.match(detail,/setLoanPayerPlan/);
});

test('Home explains residual unattributed commitments with composition and action',()=>{
  assert.match(home,/compromissos da Casa ainda sem responsável definido/);
  assert.match(home,/unattributedDetails\.map/);
  assert.match(home,/Definir responsável do empréstimo/);
});
