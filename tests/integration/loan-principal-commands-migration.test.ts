import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();
const sql = fs.readFileSync(
  path.join(root, 'supabase/migrations/202609050037_loan_principal_commands.sql'),
  'utf8',
);

describe('Migration 037 loan principal commands', () => {
  it('creates principal atomically as obligation plus cash movement', () => {
    assert.match(sql, /create or replace function public\.create_loan_principal/);
    assert.match(sql, /public\.require_active_member\(p_household_id\)/);
    assert.match(sql, /insert into public\.financial_obligations/);
    assert.match(sql, /origin_kind.*'loan'/s);
    assert.match(sql, /insert into public\.money_movements/);
    assert.match(sql, /'loan_principal'/);
  });

  it('maps granted loans to receivables and cash out, and taken loans to payables and cash in', () => {
    assert.match(sql, /p_direction='granted'.*'receivable'/s);
    assert.match(sql, /p_direction='taken'.*'payable'/s);
    assert.match(sql, /source_account_id,destination_account_id/s);
    assert.match(sql, /case when p_direction='granted' then p_account_id end/);
    assert.match(sql, /case when p_direction='taken' then p_account_id end/);
  });

  it('does not create an economic income or expense transaction for principal', () => {
    assert.doesNotMatch(sql, /insert into public\.transactions/);
    assert.doesNotMatch(sql, /'income'::|type\s*=\s*'income'|'expense'::|type\s*=\s*'expense'/);
    assert.match(sql, /Principal is economically neutral/);
  });

  it('validates household party, account, amount, direction and dates', () => {
    assert.match(sql, /p_direction not in \('granted','taken'\)/);
    assert.match(sql, /p_amount<=0/);
    assert.match(sql, /p_due_date<p_occurred_at/);
    assert.match(sql, /financial_parties[\s\S]*household_id=p_household_id[\s\S]*deactivated_at is null/);
    assert.match(sql, /accounts[\s\S]*household_id=p_household_id[\s\S]*deactivated_at is null/);
  });
});
