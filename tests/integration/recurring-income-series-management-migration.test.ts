import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/202609060040_recurring_income_series_management.sql'), 'utf8');
const constitution = fs.readFileSync(path.join(process.cwd(), 'docs/casa-finance-constitution.md'), 'utf8');

describe('Migration 040 recurring income series management', () => {
  it('stores immutable series history with source and successor rules', () => {
    assert.match(sql, /create table if not exists public\.recurring_income_series_events/);
    assert.match(sql, /source_rule_id uuid not null/);
    assert.match(sql, /successor_rule_id uuid/);
    assert.match(sql, /before_snapshot jsonb not null/);
    assert.match(sql, /after_snapshot jsonb/);
  });

  it('blocks prospective changes across realized occurrences', () => {
    assert.match(sql, /future series change cannot cross an already realized occurrence/);
    assert.match(sql, /t\.realized_amount>0 or t\.economic_state='realized' or t\.status='received'/);
  });

  it('revises prospectively by closing old rule and creating a successor', () => {
    assert.match(sql, /function public\.revise_recurring_income_rule/);
    assert.match(sql, /perform public\.cancel_future_recurring_income_occurrences/);
    assert.match(sql, /deactivated_at=now\(\)/);
    assert.match(sql, /successor:=public\.create_recurring_income_rule/);
    assert.match(sql, /'revision'/);
  });

  it('closes only the future and preserves the constitutional past', () => {
    assert.match(sql, /function public\.close_recurring_income_rule/);
    assert.match(sql, /competence_date>=p_effective_from/);
    assert.match(sql, /t\.realized_amount=0/);
    assert.match(constitution, /O passado financeiro não é apagado/i);
  });
});
