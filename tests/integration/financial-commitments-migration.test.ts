import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrations = new URL('../../supabase/migrations/', import.meta.url);
const migration = (name: string) => readFile(new URL(name, migrations), 'utf8');

describe('Etapa 10H.6 canonical financial commitments migration', () => {
  it('keeps applied migrations 018 through 023 immutable', async () => {
    const hashes: Record<string, string> = {
      '202609040018_financial_engine_v1_model.sql': 'c61cb452173ea51425f607034afb43dc44f3bec43e1c7cb136b9fc46b58fcfb0',
      '202609040019_financial_engine_v1_security.sql': '6ab3b2f2f043c03222f43c48aee97c73ab742d151655964434890b97b8579802',
      '202609040020_financial_engine_v1_rpcs.sql': 'a1bb7f686c11cc6ee9dd4a6e6709e57f3b16e1578459d0f7be60deae2405b951',
      '202609040021_financial_engine_v1_read_models.sql': '21012439b565789c94c59f912e80b386a3aa2a4956e4c457aa510d85e89c574c',
      '202609050022_financial_engine_v2_foundation.sql': '6f604d7ad64f1bcf5dae9b4ce6cb392454df0c46f7b3282cb82fb0b1c9134a84',
      '202609050023_member_settlements.sql': '1c0fba14bf51507f4b95c3c196911f93b0d4039c1d80cdd0397be3af7d0f3f36',
    };
    for (const [name, expected] of Object.entries(hashes)) {
      assert.equal(createHash('sha256').update(await migration(name)).digest('hex'), expected, `${name} is immutable`);
    }
  });

  it('defines a security-invoker canonical read model using the v2 amount helpers', async () => {
    const sql = await migration('202609050024_financial_commitments.sql');
    assert.match(sql, /view public\.financial_commitment_positions\s+with \(security_invoker=true\)/);
    assert.match(sql, /public\.financial_effective_total_amount\(/);
    assert.match(sql, /public\.financial_remaining_amount\(/);
    assert.match(sql, /grant select on public\.financial_commitment_positions to authenticated/);
    assert.match(sql, /revoke all on public\.financial_commitment_positions from public, anon/);
  });

  it('keeps financial month on positions and enforces source anti-duplication', async () => {
    const sql = await migration('202609050024_financial_commitments.sql');
    assert.doesNotMatch(sql, /alter table public\.transactions[\s\S]*add column[^;]*financial_month/i);
    assert.match(sql, /date_trunc\('month',financial_date\)::date as financial_month/);
    assert.match(sql, /not exists \(select 1 from public\.installment_plans p where p\.purchase_transaction_id=t\.id\)/);
    assert.match(sql, /not exists \(select 1 from public\.recurring_occurrences o where o\.transaction_id=t\.id\)/);
    assert.match(sql, /where o\.kind='payable'/);
    assert.doesNotMatch(sql, /where o\.kind\s*(?:=|in\s*\()[^\n;]*receivable/i);
  });

  it('does not turn invoices, invoice payments, or additive amount versions into commitments', async () => {
    const sql = await migration('202609050024_financial_commitments.sql');
    assert.doesNotMatch(sql, /from public\.card_invoices\s+(?:as\s+)?[a-z]+\s*(?:\n|$)/i);
    assert.doesNotMatch(sql, /from public\.card_invoice_payments/i);
    assert.doesNotMatch(sql, /from public\.money_movements/i);
    assert.doesNotMatch(sql, /estimated_amount\s*\+\s*confirmed_amount|confirmed_amount\s*\+\s*realized_amount/i);
    assert.doesNotMatch(sql, /'invoice_payment'\s*(?:::text)?\s+as\s+commitment_type/i);
  });
});
