import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app=await readFile(new URL('../../src/components/app/CasaFinanceApp.tsx',import.meta.url),'utf8');
const priority=await readFile(new URL('../../src/components/app/FinancialPriorityCenter.tsx',import.meta.url),'utf8');
const center=await readFile(new URL('../../src/components/app/RecurringExpenseCommitmentCenter.tsx',import.meta.url),'utf8');
const intent=await readFile(new URL('../../src/finance/recurringExpenseIntent.ts',import.meta.url),'utf8');

test('recurring attention carries the exact occurrence instead of only opening Gastos',()=>{
  assert.match(priority,/recurring_expense_due/);
  assert.match(priority,/occurrenceId:item\.entity_id/);
  assert.match(priority,/Resolver esta conta/);
  assert.match(app,/setRecurringExpenseActionIntent/);
  assert.match(app,/occurrenceId:action\.occurrenceId/);
});

test('opening the contextual action is navigation-only and revalidates current read model',()=>{
  assert.doesNotMatch(intent,/supabase|rpc|insert|update|delete/i);
  assert.match(center,/items\.find\(\(item\)=>item\.occurrence_id===initialIntent\.occurrenceId\)/);
  assert.match(center,/Essa conta mudou ou já foi resolvida/);
});

test('payment still requires explicit cash resource and funder',()=>{
  assert.match(center,/De onde o dinheiro realmente saiu\?/);
  assert.match(center,/Quem efetivamente bancou\?/);
  assert.match(center,/settleRecurringExpenseOccurrence/);
  assert.match(center,/parsed>Number\(selected\.remaining_amount\)/);
});
