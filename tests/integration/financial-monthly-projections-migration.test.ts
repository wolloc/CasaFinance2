import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrations = new URL('../../supabase/migrations/', import.meta.url);
const migration = (name: string) => readFile(new URL(name, migrations), 'utf8');

describe('Etapa 10H.7 cumulative monthly projections migration', () => {
  it('keeps every applied Financial Engine migration immutable', async () => {
    const hashes: Record<string, string> = {
      '202609040018_financial_engine_v1_model.sql': 'c61cb452173ea51425f607034afb43dc44f3bec43e1c7cb136b9fc46b58fcfb0',
      '202609040019_financial_engine_v1_security.sql': '6ab3b2f2f043c03222f43c48aee97c73ab742d151655964434890b97b8579802',
      '202609040020_financial_engine_v1_rpcs.sql': 'a1bb7f686c11cc6ee9dd4a6e6709e57f3b16e1578459d0f7be60deae2405b951',
      '202609040021_financial_engine_v1_read_models.sql': '21012439b565789c94c59f912e80b386a3aa2a4956e4c457aa510d85e89c574c',
      '202609050022_financial_engine_v2_foundation.sql': '6f604d7ad64f1bcf5dae9b4ce6cb392454df0c46f7b3282cb82fb0b1c9134a84',
      '202609050023_member_settlements.sql': '1c0fba14bf51507f4b95c3c196911f93b0d4039c1d80cdd0397be3af7d0f3f36',
      '202609050024_financial_commitments.sql': '0f8a77f4656e2e671b548fddaad9c3c1382f8af72dbe3607465db55ee186a83d',
    };
    for (const [name, expected] of Object.entries(hashes)) {
      assert.equal(createHash('sha256').update(await migration(name)).digest('hex'), expected, `${name} is immutable`);
    }
  });

  it('adds only derived, security-invoker read models and a bounded function', async () => {
    const sql = await migration('202609050025_financial_monthly_projections.sql');
    assert.match(sql, /financial_available_cash_positions[\s\S]*security_invoker=true/);
    assert.match(sql, /financial_true_income_positions[\s\S]*security_invoker=true/);
    assert.match(sql, /financial_monthly_projection\([\s\S]*security invoker/);
    assert.match(sql, /is_active_household_member\(p_household_id\)/);
    assert.match(sql, /p_horizon_months>120/);
    assert.doesNotMatch(sql, /create table/i, 'projection is not a mutable snapshot');
    assert.doesNotMatch(sql, /grant (?:select|execute)[^;]* to anon/i);
  });

  it('uses canonical balances and exact available-cash classifications', async () => {
    const sql = await migration('202609050025_financial_monthly_projections.sql');
    assert.match(sql, /from public\.financial_account_balances b/);
    assert.match(sql, /b\.type in \('cash','checking','savings','digital_wallet','meal_benefit'\)/);
    assert.match(sql, /b\.resource_restriction is null or b\.resource_restriction='meal_benefit'/);
    assert.doesNotMatch(sql, /opening_balance\s*[+)]/i);
    assert.doesNotMatch(sql, /current_balance\s*\+\s*[^\n;]*overdraft_limit/i);
  });

  it('requires structural confirmation instead of treating every projection as reliable', async () => {
    const sql = await migration('202609050025_financial_monthly_projections.sql');
    assert.match(sql, /from public\.money_movements m[\s\S]*m\.kind='income'/);
    assert.match(sql, /filter\(where i\.state='projected'\)/);
    assert.match(sql, /t\.economic_state='confirmed'/);
    assert.match(sql, /t\.confirmed_amount is not null/);
    assert.match(sql, /candidate\.related_transaction_id=m\.related_transaction_id/);
    assert.match(sql, /sum\(i\.reliable_remaining_amount\)/);
    assert.doesNotMatch(sql, /financial_obligations[\s\S]*receivable/);
    assert.doesNotMatch(sql, /member_settlement_(?:events|schedules|positions)/);
  });

  it('reuses commitment positions, remaining values, and occurrence precedence', async () => {
    const sql = await migration('202609050025_financial_monthly_projections.sql');
    assert.match(sql, /from public\.financial_commitment_positions c/);
    assert.match(sql, /sum\(c\.remaining_amount\)/);
    assert.doesNotMatch(sql, /from public\.(?:installments|card_invoices|financial_obligations)/);
    assert.match(sql, /not exists \([\s\S]*from public\.recurring_occurrences o/);
    assert.match(sql, /r\.amount_mode='estimated'[\s\S]*r\.estimated_amount/);
  });

  it('carries prior pending once and chains cumulative month balances', async () => {
    const sql = await migration('202609050025_financial_monthly_projections.sql');
    assert.match(sql, /c\.financial_month<v_current_month/);
    assert.match(sql, /case when m\.chain_month_index=0 then p\.amount else 0::numeric end/);
    assert.match(sql, /generate_series\(0,v_reference_offset\+p_horizon_months-1\)/);
    assert.match(sql, /where p\.chain_month_index>=v_reference_offset/);
    assert.match(sql, /rows between unbounded preceding and 1 preceding/);
    assert.match(sql, /rows between unbounded preceding and current row/);
    assert.match(sql, /expected_income-m\.remaining_commitments-m\.recurring_commitments-m\.prior_pending/);
    assert.doesNotMatch(sql, /realized_income-m\.remaining_commitments/);
  });

  it('rejects retrospective projections without historical cash snapshots', async () => {
    const sql = await migration('202609050025_financial_monthly_projections.sql');
    assert.match(sql, /v_reference_month<v_current_month/);
    assert.match(sql, /reference month cannot precede the current month without a historical cash snapshot/);
  });

  it('does not add financial_month to transactions in migration 025', async () => {
    const sql = await migration('202609050025_financial_monthly_projections.sql');
    assert.doesNotMatch(sql, /alter table public\.transactions/i);
  });
});
