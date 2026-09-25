import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrations = new URL('../../supabase/migrations/', import.meta.url);
const migration = (name: string) => readFile(new URL(name, migrations), 'utf8');

describe('P0 member-settlement reconciliation performance migration', () => {
  it('preserves the canonical reconciliation function and its security contract', async () => {
    const sql = await migration('20260925123000_optimize_member_settlement_reconciliation.sql');
    assert.match(sql, /create or replace function public\.reconcile_member_settlements\(p_transaction_id uuid\)/);
    assert.match(sql, /security definer set search_path=public,pg_temp/);
    assert.match(sql, /revoke all on function public\.reconcile_member_settlements\(uuid\) from public,anon,authenticated/);
    assert.match(sql, /public\.funding_events/);
    assert.match(sql, /public\.member_settlement_events/);
  });

  it('materializes settlement read models once instead of correlated rescans per member', async () => {
    const sql = await migration('20260925123000_optimize_member_settlement_reconciliation.sql');
    const projected = sql.slice(sql.indexOf('with responsibility_rows as materialized'));
    assert.match(projected, /responsibility_rows as materialized/);
    assert.match(projected, /funding as materialized/);
    assert.match(projected, /group by commitment_key,member_id/);
    assert.match(projected, /left join responsibility r/);
    assert.match(projected, /left join funding f/);
    assert.doesNotMatch(projected, /coalesce\(\(select sum\(f\.amount\) from public\.financial_member_funding_positions/);
    assert.doesNotMatch(projected, /coalesce\(\(select sum\(r\.remaining_responsibility_amount\) from public\.financial_member_commitment_responsibility_positions/);
  });

  it('keeps projected settlement semantics based on responsibility minus projected funding', async () => {
    const sql = await migration('20260925123000_optimize_member_settlement_reconciliation.sql');
    assert.match(sql, /coalesce\(f\.amount,0\)-coalesce\(r\.amount,0\) balance/);
    assert.match(sql, /filter\(where balance<0\)/);
    assert.match(sql, /filter\(where balance>0\)/);
    assert.match(sql, /'projected','responsibility_funding'/);
  });
});
