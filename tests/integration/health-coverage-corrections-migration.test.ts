import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrationDir = new URL('../../supabase/migrations/', import.meta.url);
const migration = (name: string) => readFile(new URL(name, migrationDir), 'utf8');

describe('Migration 029 health coverage corrections', () => {
  it('is forward-only and leaves migration 028 as historical input', async () => {
    const prior = await migration('202609050028_health_attention_confidence.sql');
    const correction = await migration('202609050029_health_coverage_corrections.sql');
    assert.match(prior, /financial_household_health_position/);
    assert.match(correction, /Migration 028 remains immutable/);
    assert.match(correction, /create or replace function public\.financial_household_health_position/);
  });

  it('compares overdue commitments with pre-outflow capacity', async () => {
    const sql = await migration('202609050029_health_coverage_corrections.sql');
    const health = sql.slice(sql.indexOf('financial_household_health_position'), sql.indexOf('comment on function public.financial_household_health_position'));
    assert.match(health, /v_capacity:=greatest\([\s\S]*opening_cash[\s\S]*expected_reliable_income_remaining/);
    assert.match(health, /v_overdue>v_capacity/);
    assert.doesNotMatch(health, /v_overdue>greatest\(coalesce\(p\.projected_ending_cash/);
  });

  it('reconstructs pre-invoice coverage instead of subtracting the invoice twice', async () => {
    const sql = await migration('202609050029_health_coverage_corrections.sql');
    const attention = sql.slice(sql.indexOf('financial_attention_items'), sql.indexOf('comment on function public.financial_attention_items'));
    assert.match(attention, /coalesce\(v_projected_ending,0\)\+i\.remaining_amount/);
    assert.doesNotMatch(attention, /i\.remaining_amount>greatest\(coalesce\(v_projected_ending,0\),0\)/);
  });

  it('excludes cancelled invoices from all due-soon and coverage signals', async () => {
    const sql = await migration('202609050029_health_coverage_corrections.sql');
    const card = sql.slice(sql.indexOf('financial_card_health_positions'), sql.indexOf('comment on view public.financial_card_health_positions'));
    const attention = sql.slice(sql.indexOf('financial_attention_items'), sql.indexOf('comment on function public.financial_attention_items'));
    assert.match(card, /state<>'cancelled'[\s\S]*due_date between current_date and current_date\+7/);
    assert.match(attention, /i\.state<>'cancelled'[\s\S]*i\.due_date between current_date and current_date\+7/);
  });

  it('changes read interpretation only and preserves least privilege', async () => {
    const sql = await migration('202609050029_health_coverage_corrections.sql');
    assert.doesNotMatch(sql, /insert into|update public\.|delete from|alter table/);
    assert.match(sql, /security invoker/);
    assert.match(sql, /revoke all on public\.financial_card_health_positions from public,anon/);
    assert.match(sql, /grant select on public\.financial_card_health_positions to authenticated/);
    assert.match(sql, /grant execute on function public\.financial_household_health_position\(uuid\),[\s\S]*public\.financial_attention_items\(uuid\) to authenticated/);
  });
});
