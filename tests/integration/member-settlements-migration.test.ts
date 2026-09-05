import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrations = new URL('../../supabase/migrations/', import.meta.url);
const migration = (name: string) => readFile(new URL(name, migrations), 'utf8');

describe('Etapa 10H.5 member settlements migration', () => {
  it('keeps applied migrations 018-022 immutable', async () => {
    const hashes: Record<string, string> = {
      '202609040018_financial_engine_v1_model.sql': 'c61cb452173ea51425f607034afb43dc44f3bec43e1c7cb136b9fc46b58fcfb0',
      '202609040019_financial_engine_v1_security.sql': '6ab3b2f2f043c03222f43c48aee97c73ab742d151655964434890b97b8579802',
      '202609040020_financial_engine_v1_rpcs.sql': 'a1bb7f686c11cc6ee9dd4a6e6709e57f3b16e1578459d0f7be60deae2405b951',
      '202609040021_financial_engine_v1_read_models.sql': '21012439b565789c94c59f912e80b386a3aa2a4956e4c457aa510d85e89c574c',
      '202609050022_financial_engine_v2_foundation.sql': '6f604d7ad64f1bcf5dae9b4ce6cb392454df0c46f7b3282cb82fb0b1c9134a84',
    };
    for (const [name, expected] of Object.entries(hashes)) {
      assert.equal(createHash('sha256').update(await migration(name)).digest('hex'), expected, `${name} is immutable`);
    }
  });

  it('defines an event ledger, separate schedules, and directional read model', async () => {
    const sql = await migration('202609050023_member_settlements.sql');
    assert.match(sql, /create table public\.member_settlement_events/);
    assert.match(sql, /create table public\.member_settlement_schedules/);
    assert.match(sql, /create or replace view public\.financial_member_settlement_positions with \(security_invoker=true\)/);
    assert.match(sql, /debtor_member_id <> creditor_member_id/);
    assert.match(sql, /where state in \('projected','realized'\)/);
    assert.match(sql, /net_position/);
  });

  it('reconciles responsibility against realized and projected funding without using buyer', async () => {
    const sql = await migration('202609050023_member_settlements.sql');
    const reconcile = sql.slice(sql.indexOf('function public.reconcile_member_settlements'), sql.indexOf('function public.trigger_reconcile_member_settlements'));
    assert.match(reconcile, /public\.economic_allocations/);
    assert.match(reconcile, /public\.funding_events/);
    assert.match(reconcile, /public\.account_ownerships/);
    assert.match(reconcile, /fe\.amount\/count\(\*\) over\(\)/);
    assert.match(reconcile, /public\.installments/);
    assert.doesNotMatch(reconcile, /buyer_member_id/);
  });

  it('concretizes installment projections and enforces source idempotency', async () => {
    const sql = await migration('202609050023_member_settlements.sql');
    assert.match(sql, /member_settlement_installment_origin_unique/);
    assert.match(sql, /member_settlement_funding_origin_unique/);
    assert.match(sql, /member_settlement_movement_origin_unique/);
    assert.match(sql, /update public\.member_settlement_events set state='realized'.*source_funding_event_id=fe\.id/);
    assert.doesNotMatch(sql, /source_invoice_id/);
  });

  it('settles through a neutral movement, supports partial amounts, and blocks excess', async () => {
    const sql = await migration('202609050023_member_settlements.sql');
    const settle = sql.slice(sql.indexOf('function public.settle_member_position'), sql.indexOf('alter table public.member_settlement_events enable'));
    assert.match(settle, /kind,state,amount,description/);
    assert.match(settle, /'member_settlement','realized'/);
    assert.match(settle, /'realized','explicit_settlement'/);
    assert.match(settle, /if p_amount>coalesce\(outstanding,0\)/);
    assert.doesNotMatch(settle, /insert into public\.transactions/);
  });

  it('exposes only authenticated RPC writes and household-scoped RLS reads', async () => {
    const sql = await migration('202609050023_member_settlements.sql');
    for (const rpc of ['create_member_settlement_schedule', 'cancel_member_settlement_schedule', 'settle_member_position']) {
      assert.match(sql, new RegExp(`function public\\.${rpc}\\([\\s\\S]+?security definer set search_path=public,pg_temp`));
      assert.match(sql, new RegExp(`grant execute on function public\\.${rpc}`));
    }
    assert.match(sql, /revoke insert,update,delete,truncate,references,trigger .* from authenticated/);
    assert.match(sql, /using\(public\.is_active_household_member\(household_id\)\)/g);
    assert.match(sql, /revoke all on function public\.reconcile_member_settlements\(uuid\) from public,anon,authenticated/);
  });
});
