import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../../supabase/migrations/202610100001_defer_invoice_payment_settlement_reconcile.sql', import.meta.url), 'utf8');

test('invoice payment defers per-funding-row settlement trigger work', () => {
  const deferOn = migration.indexOf("'casa_finance.defer_member_settlement_reconcile',\n    'on'");
  const fundingInsert = migration.indexOf('insert into public.funding_events');
  const restore = migration.indexOf("coalesce(previous_defer_setting,'off')");
  assert.ok(deferOn >= 0 && fundingInsert > deferOn && restore > fundingInsert);
});

test('invoice payment reconciles each financed transaction once after allocation', () => {
  const restore = migration.indexOf("coalesce(previous_defer_setting,'off')");
  const reconcile = migration.indexOf('perform public.reconcile_member_settlements(funded.financed_transaction_id)');
  const remainingCheck = migration.indexOf("if remaining<>0 then");
  assert.ok(reconcile > restore && remainingCheck > reconcile);
  assert.match(migration, /select distinct f\.financed_transaction_id/);
});

test('invoice payment keeps cash, invoice and funding writes in one RPC transaction', () => {
  for (const table of ['public.transactions', 'public.money_movements', 'public.card_invoice_payments', 'public.funding_events', 'public.card_invoices']) {
    assert.ok(migration.includes(table), `missing canonical write to ${table}`);
  }
  assert.match(migration, /pay_card_invoice\(/);
  assert.match(migration, /security definer/i);
});
