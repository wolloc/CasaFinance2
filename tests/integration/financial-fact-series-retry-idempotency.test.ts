import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../../supabase/migrations/202609070065_retry_idempotency_financial_facts_and_series.sql', import.meta.url), 'utf8');

test('fact and recurring wrappers reuse the transactional request registry', () => {
  for (const name of [
    'create_income_fact_idempotent','create_financial_transaction_idempotent','create_recurring_income_rule_idempotent',
    'revise_recurring_income_rule_idempotent','close_recurring_income_rule_idempotent',
    'create_recurring_expense_rule_from_transaction_idempotent','revise_recurring_expense_rule_idempotent',
    'close_recurring_expense_rule_idempotent','confirm_recurring_expense_occurrence_idempotent',
  ]) {
    const start = migration.indexOf(`function public.${name}`);
    assert.ok(start >= 0, `${name} must exist`);
    const body = migration.slice(start, migration.indexOf('end $$;', start) + 7);
    assert.match(body, /financial_command_existing_or_lock/);
    assert.match(body, /financial_command_store/);
  }
});

test('frontend routes new facts and recurring commands through idempotent wrappers', async () => {
  const checks: Array<[string,string[]]> = [
    ['incomeFacts.ts',['create_income_fact_idempotent']],
    ['householdTransactions.ts',['create_financial_transaction_idempotent','create_and_settle_shared_expense_idempotent']],
    ['recurringIncome.ts',['create_recurring_income_rule_idempotent','revise_recurring_income_rule_idempotent','close_recurring_income_rule_idempotent']],
    ['recurringExpenses.ts',['create_recurring_expense_rule_from_transaction_idempotent','revise_recurring_expense_rule_idempotent','close_recurring_expense_rule_idempotent']],
    ['recurringExpenseCommitments.ts',['confirm_recurring_expense_occurrence_idempotent']],
  ];
  for (const [file,rpcs] of checks) {
    const source = await readFile(new URL(`../../src/finance/${file}`, import.meta.url), 'utf8');
    for (const rpc of rpcs) assert.ok(source.includes(rpc), `${file} must use ${rpc}`);
  }
});

test('income and transaction corrections no longer generate retry keys from wall clock randomness', async () => {
  for (const file of ['incomeFacts.ts','householdTransactions.ts']) {
    const source = await readFile(new URL(`../../src/finance/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /Date\.now\(\).*Math\.random\(\)|Math\.random\(\).*Date\.now\(\)/);
    assert.match(source, /getRetryStableRequestKey/);
    assert.match(source, /releaseRetryStableRequestKey/);
  }
});

test('series horizon functions remain naturally deduplicated and are not wrapped as user commands', async () => {
  const income = await readFile(new URL('../../src/finance/recurringIncome.ts', import.meta.url), 'utf8');
  const expense = await readFile(new URL('../../src/finance/recurringExpenses.ts', import.meta.url), 'utf8');
  assert.match(income, /ensure_household_recurring_income_horizon/);
  assert.match(expense, /ensure_household_recurring_expense_horizon/);
});
