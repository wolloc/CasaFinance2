import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migration = (name: string) => readFile(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

describe('Etapa 9 financial core database contract', () => {
  it('hardens every historical entity with household-scoped read-only RLS', async () => {
    const sql = await migration('202609030014_financial_core_integrity_rls.sql');
    for (const table of ['transaction_splits','installment_plans','installments','card_invoices','card_invoice_payments','funding_events','transfers','money_movements','recurring_rules','recurring_occurrences']) assert.match(sql, new RegExp(`'${table}'`));
    assert.match(sql, /for select to authenticated using \(public\.is_active_household_member\(household_id\)\)/i);
    assert.doesNotMatch(sql, /for delete to authenticated/i);
    assert.match(sql, /cross-household reference/i);
  });

  it('keeps creator, buyer, owner, funder, and responsibility independent', async () => {
    const sql = await migration('202609030015_financial_core_rpcs.sql');
    assert.match(sql, /created_by_member_id,buyer_member_id/);
    assert.match(sql, /responsible_member_id,percentage,amount/);
    assert.match(sql, /p_funder_member_id/);
    assert.doesNotMatch(sql, /funder_member_id[^\n]+owner_member_id/i);
    assert.doesNotMatch(sql, /responsible_member_id[^\n]+owner_member_id/i);
  });

  it('enforces exact split and installment totals and atomic operations', async () => {
    const integrity = await migration('202609030014_financial_core_integrity_rls.sql');
    const rpc = await migration('202609030015_financial_core_rpcs.sql');
    assert.match(rpc, /split_sum<>p_amount or pct_sum<>100/);
    assert.match(integrity, /actual<>expected or actual_count<>expected_count/);
    assert.match(integrity, /deferrable initially deferred/i);
    for (const fn of ['create_financial_transaction','pay_card_invoice','create_transfer','generate_recurring_occurrence']) assert.match(rpc, new RegExp(`function public\\.${fn}`));
  });

  it('models card settlement as movement/funding rather than another expense', async () => {
    const sql = await migration('202609030015_financial_core_rpcs.sql');
    assert.match(sql, /'invoice_payment','paid'/);
    assert.match(sql, /insert into public\.funding_events/);
    assert.match(sql, /update public\.card_invoices set settled_amount/);
    assert.doesNotMatch(sql, /Pagamento de fatura'[^;]+,'expense'/i);
  });

  it('makes recurrence idempotent and transfer two-legged', async () => {
    const integrity = await migration('202609030014_financial_core_integrity_rls.sql');
    const rpc = await migration('202609030015_financial_core_rpcs.sql');
    assert.match(integrity, /unique index[^;]+recurring_occurrences_idempotency/is);
    assert.match(rpc, /if existing is not null then return existing/);
    assert.match(rpc, /insert into public\.transfers/);
    assert.match(rpc, /insert into public\.money_movements/);
  });
});
