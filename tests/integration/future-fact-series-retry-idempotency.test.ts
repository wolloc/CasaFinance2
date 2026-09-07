import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration=await readFile(new URL('../../supabase/migrations/202609070065_retry_idempotency_future_facts_and_series.sql',import.meta.url),'utf8');

test('future fact and series wrappers reuse the shared transactional idempotency ledger',()=>{
  for(const name of ['create_income_fact','create_financial_transaction','create_recurring_income_rule','revise_recurring_income_rule','close_recurring_income_rule','create_recurring_expense_rule_from_transaction','revise_recurring_expense_rule','close_recurring_expense_rule']){
    const start=migration.indexOf(`function public.${name}_idempotent`);assert.ok(start>=0,`${name} wrapper missing`);
    const block=migration.slice(start,start+2300);
    const lookup=block.indexOf('financial_command_existing_or_lock');
    const call=block.indexOf(`public.${name}(`);
    const store=block.indexOf('financial_command_store');
    assert.ok(lookup>=0&&call>lookup&&store>call,`${name} must lookup, execute and store atomically`);
  }
});

test('frontend routes creation and recurring series mutations through stable wrappers',async()=>{
  const checks:Array<[string,string[]]>=[
    ['incomeFacts.ts',['create_income_fact_idempotent','getRetryStableRequestKey']],
    ['recurringIncome.ts',['create_recurring_income_rule_idempotent','revise_recurring_income_rule_idempotent','close_recurring_income_rule_idempotent']],
    ['recurringExpenses.ts',['create_recurring_expense_rule_from_transaction_idempotent','revise_recurring_expense_rule_idempotent','close_recurring_expense_rule_idempotent']],
    ['householdTransactions.ts',['create_financial_transaction_idempotent','getRetryStableIntentValue']],
  ];
  for(const [file,needles] of checks){const source=await readFile(new URL(`../../src/finance/${file}`,import.meta.url),'utf8');for(const needle of needles)assert.ok(source.includes(needle),`${file} missing ${needle}`);}
});

test('recurring horizon materialization remains naturally idempotent and is not wrapped as a user command',async()=>{
  const income=await readFile(new URL('../../src/finance/recurringIncome.ts',import.meta.url),'utf8');
  const expense=await readFile(new URL('../../src/finance/recurringExpenses.ts',import.meta.url),'utf8');
  assert.match(income,/ensure_household_recurring_income_horizon/);
  assert.match(expense,/ensure_household_recurring_expense_horizon/);
});

test('legacy transaction correction cancellation and full refund no longer use Date.now or Math.random request keys',async()=>{
  const source=await readFile(new URL('../../src/finance/householdTransactions.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Date\.now\(\)|Math\.random\(\)/);
  assert.match(source,/transaction-correction/);
  assert.match(source,/transaction-cancel/);
  assert.match(source,/transaction-full-refund/);
});
