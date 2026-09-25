import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../../supabase/migrations/20260925204500_scope_recurring_settlement_reconciliation.sql', import.meta.url),
  'utf8',
);

test('settlement deferral is scoped to the recurring occurrence assembly flag', () => {
  assert.match(migration, /current_setting\('casa_finance\.defer_member_settlement_reconcile', true\)/);
  assert.match(migration, /set_config\([\s\S]*casa_finance\.defer_member_settlement_reconcile[\s\S]*'on'/);
  assert.match(migration, /perform public\.reconcile_member_settlements\(tx\)/);
});

test('normal allocation changes keep canonical immediate reconciliation', () => {
  const trigger = migration.slice(
    migration.indexOf('create or replace function public.trigger_reconcile_member_settlements'),
    migration.indexOf('create or replace function public.generate_recurring_occurrence'),
  );
  assert.match(trigger, /tx_id:=coalesce\(new\.transaction_id,old\.transaction_id\)/);
  assert.match(trigger, /perform public\.reconcile_member_settlements\(tx_id\)/);
  assert.doesNotMatch(trigger, /allocation_percentage<>100/);
  assert.doesNotMatch(trigger, /financial_effective_total_amount/);
});

test('recurring occurrence assembly restores the defer flag even on failure', () => {
  assert.match(migration, /previous_defer_setting:=current_setting/);
  assert.match(migration, /exception[\s\S]*when others then[\s\S]*set_config\([\s\S]*coalesce\(previous_defer_setting,'off'\)/);
  assert.match(migration, /perform set_config\([\s\S]*coalesce\(previous_defer_setting,'off'\)[\s\S]*perform public\.reconcile_member_settlements\(tx\)/);
});
