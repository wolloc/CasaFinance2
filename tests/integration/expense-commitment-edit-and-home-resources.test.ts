import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const role=await readFile(new URL('../../src/components/app/ExpenseRoleCorrectionAction.tsx',import.meta.url),'utf8');
const fn=await readFile(new URL('../../supabase/migrations/20261003182000_fix_expense_commitment_correction.sql',import.meta.url),'utf8');
const finance=await readFile(new URL('../../src/finance/expenseRoleCorrections.ts',import.meta.url),'utf8');
const home=await readFile(new URL('../../src/components/app/HomeFinancialMap.tsx',import.meta.url),'utf8');
const casa=await readFile(new URL('../../src/components/app/CasaHomeScreen.tsx',import.meta.url),'utf8');

test('commitment editor does not ask or alter buyer',()=>{
  assert.match(role,/Altere somente quem assume este valor/);
  assert.match(role,/Compromisso atual/);
  assert.doesNotMatch(role,/Quem realmente comprou/);
  assert.doesNotMatch(role,/Motivo da correção/);
  assert.match(fn,/buyer_member_id/);
  assert.match(fn,/set updated_at=now\(\) where id=tx\.id/);
  assert.doesNotMatch(fn,/set buyer_member_id=p_buyer_member_id/);
  assert.match(finance,/input\.householdId,input\.transactionId,input\.responsibility/);
});

test('commitment correction qualifies allocation columns to avoid PL/pgSQL ambiguity',()=>{
  assert.match(fn,/economic_allocations ea/);
  assert.match(fn,/ea\.responsible_member_id/);
  assert.match(fn,/ea\.percentage/);
  assert.match(fn,/ea\.amount/);
  assert.match(fn,/ea\.allocation_order/);
});

test('money map has one heading and monthly summary surfaces resource categories',()=>{
  assert.match(home,/HomeFinancialMap/);
  assert.match(casa,/>Benefícios</);
  assert.match(home,/label:'Investimentos e reservas'/);
  assert.match(casa,/>Contas</);
});
