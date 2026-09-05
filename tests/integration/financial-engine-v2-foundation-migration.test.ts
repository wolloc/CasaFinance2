import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrations = new URL('../../supabase/migrations/', import.meta.url);
const migration = (name: string) => readFile(new URL(name, migrations), 'utf8');

describe('Etapa 10H.4 financial engine v2 foundation migration', () => {
  it('keeps every applied financial-engine migration immutable', async () => {
    const hashes: Record<string, string> = {
      '202609040018_financial_engine_v1_model.sql': 'c61cb452173ea51425f607034afb43dc44f3bec43e1c7cb136b9fc46b58fcfb0',
      '202609040019_financial_engine_v1_security.sql': '6ab3b2f2f043c03222f43c48aee97c73ab742d151655964434890b97b8579802',
      '202609040020_financial_engine_v1_rpcs.sql': 'a1bb7f686c11cc6ee9dd4a6e6709e57f3b16e1578459d0f7be60deae2405b951',
      '202609040021_financial_engine_v1_read_models.sql': '21012439b565789c94c59f912e80b386a3aa2a4956e4c457aa510d85e89c574c',
    };

    for (const [name, expected] of Object.entries(hashes)) {
      const actual = createHash('sha256').update(await migration(name)).digest('hex');
      assert.equal(actual, expected, `${name} is immutable`);
    }
  });

  it('keeps a partially settled expense confirmed and realizes it only at the applicable total', async () => {
    const sql = await migration('202609050022_financial_engine_v2_foundation.sql');
    assert.match(sql, /new_realized_amount:=already\+p_amount/);
    assert.match(sql, /when new_realized_amount=applicable_amount then 'realized'/);
    assert.match(sql, /else 'confirmed'/);
    assert.match(sql, /if new_realized_amount>applicable_amount then raise exception 'expense funding exceeds economic amount'/);
    assert.match(sql, /insert into public\.funding_events/);
    assert.match(sql, /insert into public\.money_movements/);
    assert.match(sql, /security definer set search_path=public,pg_temp/);
  });

  it('defines canonical effective-total and nonnegative-remaining helpers', async () => {
    const sql = await migration('202609050022_financial_engine_v2_foundation.sql');
    assert.match(sql, /function public\.financial_effective_total_amount/);
    assert.match(sql, /p_economic_state in \('cancelled', 'reversed'\) then 0/);
    assert.match(sql, /p_confirmed_amount,[\s\S]+p_estimated_amount,[\s\S]+p_fallback_amount/);
    assert.match(sql, /function public\.financial_remaining_amount/);
    assert.match(sql, /greatest\([\s\S]+financial_effective_total_amount[\s\S]+- coalesce\(p_realized_amount, 0\),[\s\S]+0::numeric/);
    assert.match(sql, /immutable/g);
  });

  it('persists overdraft metadata without changing account balances', async () => {
    const sql = await migration('202609050022_financial_engine_v2_foundation.sql');
    assert.match(sql, /overdraft_enabled boolean not null default false/);
    assert.match(sql, /overdraft_limit numeric\(19,2\) not null default 0/);
    assert.match(sql, /check \(overdraft_limit >= 0\)/);
    assert.doesNotMatch(sql, /update public\.accounts/);
    assert.doesNotMatch(sql, /opening_balance\s*=/);
  });
});
