import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('contrato de RLS Supabase', () => {
  it('forca RLS e aplica isolamento nas tabelas financeiras', async () => {
    const sql = await readFile(new URL('../../supabase/migrations/202609030004_rls_release_readiness.sql', import.meta.url), 'utf8');
    assert.match(sql, /force row level security/i);
    assert.match(sql, /auth\.uid\(\)/i);
    for (const table of ['accounts', 'cards', 'transactions', 'funding_events', 'money_movements']) assert.match(sql, new RegExp(`'${table}'`));
    assert.match(sql, /with check \(public\.is_active_household_member\(household_id\)\)/i);
  });
});
