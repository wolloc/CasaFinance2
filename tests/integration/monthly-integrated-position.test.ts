import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const home=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');
const statement=await readFile(new URL('../../src/components/app/MonthlyPositionStatement.tsx',import.meta.url),'utf8');
const engine=await readFile(new URL('../../docs/financial-engine-v2.md',import.meta.url),'utf8');

test('Casa current month uses an integrated monthly statement from opening to projected ending',()=>{
  assert.match(home,/MonthlyPositionStatement/);
  assert.match(home,/opening=\{Number\(currentMonth\.opening_cash\)\}/);
  assert.match(home,/realizedIncome=\{Number\(currentMonth\.realized_true_income_in_month\)\}/);
  assert.match(home,/expectedIncome=\{Number\(currentMonth\.expected_reliable_income_remaining\)\}/);
  assert.match(home,/remainingOutflow=\{Number\(currentMonth\.remaining_commitments_in_month\)\+Number\(currentMonth\.projected_recurring_commitments\)\+Number\(currentMonth\.prior_pending_outflow\)\}/);
  assert.match(home,/ending=\{Number\(currentMonth\.projected_ending_cash\)\}/);
  assert.match(home,/subjectLabel="Casa"/);
});

test('monthly statement keeps liquidity coverage separate from reserves and investments',()=>{
  for(const copy of [
    'pode terminar o mês com',
    'Recursos para usar hoje',
    'Caixa hoje',
    'Ainda entra',
    'Ainda sai',
    'Fim do mês',
    'Estamos tranquilos neste mês',
    'O mês fecha, contando com o que ainda entra',
    'Vamos precisar mexer em outros recursos',
    'Precisamos nos organizar neste mês',
    'Fim do mês',
  ]) assert.match(statement,new RegExp(copy.replace(/[?]/g,'\\?')));
  assert.match(statement,/reserva \+ investimentos/i);
  assert.match(engine,/Investimentos e reservas[\s\S]*classes patrimoniais separadas do caixa transacional/);
});

test('member perspective gets the same statement without inventing household coverage guidance',()=>{
  assert.match(home,/opening=\{Number\(current\.opening_liquidity\)\}/);
  assert.match(home,/expectedIncome=\{Number\(current\.expected_reliable_income_remaining\)\+Number\(current\.scheduled_settlement_inflow\)\}/);
  assert.match(home,/remainingOutflow=\{Number\(current\.projected_funding_remaining\)\+Number\(current\.scheduled_settlement_outflow\)\}/);
  assert.match(home,/ending=\{Number\(current\.projected_ending_liquidity\)\}/);
  assert.match(home,/subjectLabel=\{memberName\(perspective\)\}/);
});
