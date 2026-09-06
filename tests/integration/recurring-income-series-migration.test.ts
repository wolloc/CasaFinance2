import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202609060039_recurring_income_series.sql'), 'utf8');
const constitution = fs.readFileSync(path.join(root, 'docs/casa-finance-constitution.md'), 'utf8');

describe('Migration 039 recurring income series', () => {
  it('stores recurring income semantics on the rule instead of inferring from a later occurrence', () => {
    assert.match(sql, /income_beneficiary_member_id/);
    assert.match(sql, /income_destination_account_id/);
    assert.match(sql, /income_nature public\.income_nature/);
    assert.match(sql, /income_economic_state public\.economic_state/);
    assert.match(sql, /independent from the state later reached by any materialized occurrence/i);
  });

  it('materializes separate income facts and projected cash legs without realized cash', () => {
    assert.match(sql, /insert into public\.transactions/);
    assert.match(sql, /insert into public\.money_movements/);
    assert.match(sql, /insert into public\.recurring_occurrences/);
    assert.match(sql, /'income','projected'/);
    assert.doesNotMatch(sql, /'income','realized'/);
  });

  it('is idempotent by recurring rule and occurrence date', () => {
    assert.match(sql, /exists\([\s\S]*recurring_rule_id=r\.id[\s\S]*competence_date=occurrence_date/);
    assert.match(sql, /ensure_household_recurring_income_horizon/);
  });

  it('keeps forecast distinct from realized cash and validates household routing', () => {
    assert.match(sql, /income_economic_state not in \('forecast','confirmed'\)/);
    assert.match(sql, /type in \('cash','checking','savings','digital_wallet'\)/);
    assert.match(sql, /resource_restriction is null/);
    assert.match(constitution, /Previsto não é realizado/i);
    assert.match(constitution, /Toda entrada de dinheiro precisa ter natureza explícita/i);
  });
});
