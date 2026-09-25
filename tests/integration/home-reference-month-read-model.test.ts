import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrations = new URL('../../supabase/migrations/', import.meta.url);
const migration = () => readFile(new URL('20260925004500_home_reference_month_read_model.sql', migrations), 'utf8');

describe('Home reference month canonical read model', () => {
  it('adds read-only security-invoker functions without snapshot tables', async () => {
    const sql = await migration();
    assert.match(sql, /financial_available_cash_at_date\([\s\S]*security invoker/i);
    assert.match(sql, /financial_reference_month_context\([\s\S]*security invoker/i);
    assert.match(sql, /is_active_household_member\(p_household_id\)/);
    assert.doesNotMatch(sql, /create\s+table/i);
    assert.doesNotMatch(sql, /grant\s+execute[^;]*\bto\s+anon\b/i);
  });

  it('reconstructs history only from canonical dated ledger facts', async () => {
    const sql = await migration();
    assert.match(sql, /from public\.account_balance_events e/);
    assert.match(sql, /e\.reversed_at is null/);
    assert.match(sql, /e\.effective_date between v_tracking_start and p_as_of_date/);
    assert.match(sql, /from public\.money_movements m/);
    assert.match(sql, /m\.state='realized'/);
    assert.match(sql, /m\.movement_date between v_tracking_start and p_as_of_date/);
    assert.doesNotMatch(sql, /a\.opening_balance/i);
  });

  it('keeps available cash narrower than household assets or credit', async () => {
    const sql = await migration();
    assert.match(sql, /a\.type in \('cash','checking','savings','digital_wallet'\)/);
    assert.match(sql, /a\.resource_restriction is null/);
    assert.doesNotMatch(sql, /overdraft_limit\s*[+)]/i);
  });

  it('makes past current and future semantics explicit instead of reusing projections', async () => {
    const sql = await migration();
    assert.match(sql, /when v_reference_month<v_current_month then 'past'/);
    assert.match(sql, /when v_reference_month=v_current_month then 'current'/);
    assert.match(sql, /else 'future'/);
    assert.match(sql, /when v_period_end<v_tracking_start then 'unavailable'/);
    assert.match(sql, /when v_reference_month<v_tracking_start then 'partial'/);
    assert.match(sql, /v_period_kind='past' and v_can_navigate/);
    assert.doesNotMatch(sql, /financial_monthly_projection\s*\(/i);
  });

  it('never fabricates a pre-cutover opening balance', async () => {
    const sql = await migration();
    assert.match(sql, /p_as_of_date<v_tracking_start[\s\S]*return null/);
    assert.match(sql, /if v_reference_month=v_tracking_start then[\s\S]*e\.kind='opening'[\s\S]*e\.effective_date=v_tracking_start/);
    assert.match(sql, /elsif v_reference_month>v_tracking_start then[\s\S]*financial_available_cash_at_date/);
  });
});
