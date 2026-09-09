import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../../supabase/migrations/202609090069_external_repayment_schedule.sql', import.meta.url), 'utf8');
const service = await readFile(new URL('../../src/finance/externallyPaidExpense.ts', import.meta.url), 'utf8');
const wizard = await readFile(new URL('../../src/components/app/NewExpenseWizard.tsx', import.meta.url), 'utf8');

test('repayment schedule keeps one obligation and creates cash projections instead of new expenses', () => {
  assert.match(migration, /obligation_repayment_schedule_items/);
  assert.match(migration, /create_externally_paid_expense\(/);
  assert.doesNotMatch(migration.slice(migration.indexOf('create_externally_paid_expense_with_repayment_plan')), /create_financial_transaction\([\s\S]*?'expense'/);
  assert.match(migration, /Schedule items are cash projections, never additional expenses/);
});

test('installment amounts close exact cents and dates are monthly from first repayment', () => {
  assert.match(migration, /total_cents:=round\(p_amount\*100\)/);
  assert.match(migration, /base_cents:=floor/);
  assert.match(migration, /n<=remainder/);
  assert.match(migration, /make_interval\(months => n-1\)/);
});

test('planned funding route is explicit but does not realize cash', () => {
  assert.match(migration, /set_commitment_funding_plan/);
  assert.doesNotMatch(migration, /insert into public\.money_movements/);
  assert.doesNotMatch(migration, /insert into public\.funding_events/);
});

test('commitment read model emits schedule items and suppresses duplicate parent payable', () => {
  assert.match(migration, /payable_schedule:/);
  assert.match(migration, /not exists\(select 1 from public\.obligation_repayment_schedule_items/);
  assert.match(migration, /schedule_realization/);
  assert.match(migration, /rows between unbounded preceding and 1 preceding/);
});

test('wizard asks repayment mode, first date and planned source only when repayment exists', () => {
  assert.match(wizard, /Como pretende devolver\?/);
  assert.match(wizard, /Uma vez/);
  assert.match(wizard, /Parcelado/);
  assert.match(wizard, /Primeira devolução/);
  assert.match(wizard, /De qual recurso pretende pagar\?/);
  assert.match(wizard, /createExternallyPaidExpenseWithRepaymentPlan/);
  assert.match(service, /create_externally_paid_expense_with_repayment_plan/);
});
