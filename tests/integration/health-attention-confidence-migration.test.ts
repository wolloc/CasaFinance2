import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrationDir = new URL('../../supabase/migrations/', import.meta.url);
const migration = (name: string) => readFile(new URL(name, migrationDir), 'utf8');

describe('Migration 028 health, attention and confidence', () => {
  it('is forward-only after the existing 027 immutable-baseline test', async () => {
    const names = await readdir(migrationDir);
    assert.ok(names.includes('202609050027_card_exposure_future_invoices.sql'));
    assert.ok(names.includes('202609050028_health_attention_confidence.sql'));
    const baselineTest = await readFile(new URL('./card-exposure-future-invoices-migration.test.ts', import.meta.url), 'utf8');
    assert.match(baselineTest, /keeps every approved migration byte-for-byte immutable/);
    assert.match(baselineTest, /202609050026_financial_member_perspectives\.sql/);
  });

  it('keeps LIS separate from cash', async () => {
    const sql = await migration('202609050028_health_attention_confidence.sql');
    const overdraft = sql.slice(sql.indexOf('financial_overdraft_positions'), sql.indexOf('comment on view public.financial_overdraft_positions'));
    assert.match(overdraft, /greatest\(-b\.current_balance,0\)/);
    assert.match(overdraft, /overdraft_limit-greatest\(-b\.current_balance,0\)/);
    assert.doesNotMatch(overdraft, /current_balance\s*\+\s*a\.overdraft_limit/);
  });

  it('derives household health from canonical monthly projection and worsening aggravants', async () => {
    const sql = await migration('202609050028_health_attention_confidence.sql');
    const health = sql.slice(sql.indexOf('financial_household_health_position'), sql.indexOf('comment on function public.financial_household_health_position'));
    assert.match(health, /financial_monthly_projection/);
    assert.match(health, /v_ratio>=\.20/);
    assert.match(health, /v_ratio>=\.05/);
    assert.match(health, /negative_projection/);
    assert.match(health, /overdraft_in_use/);
    assert.doesNotMatch(health, /reserves|investments|overdraft_available/);
  });

  it('keeps projection confidence separate from health', async () => {
    const sql = await migration('202609050028_health_attention_confidence.sql');
    const confidence = sql.slice(sql.indexOf('financial_projection_confidence_positions'), sql.indexOf('comment on view public.financial_projection_confidence_positions'));
    assert.match(confidence, /well_updated/);
    assert.match(confidence, /needs_confirmation/);
    assert.match(confidence, /stale_important_information/);
    assert.doesNotMatch(confidence, /green|yellow|red/);
  });

  it('surfaces only canonical actionable attention causes', async () => {
    const sql = await migration('202609050028_health_attention_confidence.sql');
    const attention = sql.slice(sql.indexOf('financial_attention_items'), sql.indexOf('comment on function public.financial_attention_items'));
    for (const cause of ['overdue_commitment','overdue_invoice','overdue_payable','overdue_receivable','delayed_expected_income','overdue_member_settlement','overdraft_in_use','card_over_limit','card_coverage_risk','negative_projection']) {
      assert.match(attention, new RegExp(cause));
    }
    assert.doesNotMatch(attention, /insert into|update public\.|delete from/);
  });

  it('uses invoker security and least privilege', async () => {
    const sql = await migration('202609050028_health_attention_confidence.sql');
    for (const view of ['financial_overdraft_positions','financial_card_health_positions','financial_projection_confidence_positions']) {
      assert.match(sql, new RegExp(`view public\\.${view}[\\s\\S]*?security_invoker=true`));
    }
    assert.match(sql, /security invoker/);
    assert.match(sql, /revoke all on function public\.financial_household_health_position\(uuid\)/);
    assert.match(sql, /grant execute on function public\.financial_attention_items\(uuid\) to authenticated/);
  });
});
