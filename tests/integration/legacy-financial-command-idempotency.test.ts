import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../../supabase/migrations/202609070064_retry_idempotency_legacy_financial_commands.sql', import.meta.url), 'utf8');

test('legacy command retry registry is household-scoped and transactionally locked', () => {
  assert.match(migration, /unique\(household_id,operation,request_key\)/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended/);
  assert.match(migration, /public\.require_active_member\(p_household_id\)/);
});

test('cash and patrimonial wrappers check an existing result before canonical mutation', () => {
  for (const name of [
    'pay_card_invoice_idempotent','settle_income_idempotent','settle_direct_expense_idempotent','create_transfer_idempotent',
    'settle_member_position_idempotent','settle_financial_obligation_idempotent','write_off_receivable_idempotent',
    'create_loan_principal_idempotent','record_investment_performance_idempotent','create_and_settle_direct_expense_idempotent',
    'create_and_settle_shared_expense_idempotent','settle_recurring_expense_occurrence_idempotent',
  ]) {
    const start = migration.indexOf(`function public.${name}`);
    assert.ok(start >= 0, `${name} must exist`);
    const body = migration.slice(start, migration.indexOf('end $$;', start) + 7);
    assert.match(body, /financial_command_existing_or_lock/);
    assert.match(body, /financial_command_store/);
  }
});

test('frontend cash services route through idempotent wrappers', async () => {
  const checks: Array<[string,string]> = [
    ['invoicePayments.ts','pay_card_invoice_idempotent'],
    ['incomeReceipts.ts','settle_income_idempotent'],
    ['directExpensePayments.ts','settle_direct_expense_idempotent'],
    ['resourceTransfers.ts','create_transfer_idempotent'],
    ['memberSettlements.ts','settle_member_position_idempotent'],
    ['loanPrincipals.ts','create_loan_principal_idempotent'],
    ['investmentReserveAdjustments.ts','record_investment_performance_idempotent'],
    ['explicitExpenseCreation.ts','create_and_settle_direct_expense_idempotent'],
    ['recurringExpenseCommitments.ts','settle_recurring_expense_occurrence_idempotent'],
  ];
  for (const [file,rpc] of checks) {
    const source = await readFile(new URL(`../../src/finance/${file}`, import.meta.url), 'utf8');
    assert.ok(source.includes(rpc), `${file} must call ${rpc}`);
    assert.match(source, /runRetryStableRpc/);
  }
  const thirdParty = await readFile(new URL('../../src/finance/thirdPartyObligations.ts', import.meta.url), 'utf8');
  assert.ok(thirdParty.includes('write_off_receivable_idempotent'));
  assert.ok(thirdParty.includes('settle_financial_obligation_idempotent'));
});

test('retry registry cannot be written directly by authenticated clients', () => {
  assert.match(migration, /revoke all on public\.financial_command_requests from public,anon,authenticated/);
  assert.match(migration, /grant select on public\.financial_command_requests to authenticated/);
});
