import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('expense detail exposes responsibility correction outside special actions',async()=>{
 const screen=await readFile(new URL('../../src/components/app/TransactionsScreen.tsx',import.meta.url),'utf8');
 const action=await readFile(new URL('../../src/components/app/ExpenseRoleCorrectionAction.tsx',import.meta.url),'utf8');
 assert.match(screen,/ExpenseRoleCorrectionAction initialTransactionId=\{detailTransactionId\} onCompleted=/);
 assert.match(action,/defaultOpen=false/);
 assert.match(action,/Quem fica com este compromisso\?/);
 assert.match(action,/correctExpenseRoles/);
 assert.match(action,/effectiveBuyer=compact/);
 assert.doesNotMatch(screen,/PostPaymentCardRefundAction initialTransactionId=\{detailTransactionId\}.*ExpenseRoleCorrectionAction/s);
});

test('responsibility correction keeps canonical 100 percent split contract',async()=>{
 const migration=await readFile(new URL('../../supabase/migrations/202609060059_expense_role_corrections.sql',import.meta.url),'utf8');
 assert.match(migration,/pct_total<>100/);
 assert.match(migration,/economic_allocations/);
 assert.match(migration,/reconcile_member_settlements/);
 assert.match(migration,/Funding and cash are historical facts/);
});
