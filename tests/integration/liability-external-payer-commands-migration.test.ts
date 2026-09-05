import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const migrationDir = new URL('../../supabase/migrations/', import.meta.url);
const readMigration = (name: string) => readFile(new URL(name, migrationDir), 'utf8');

describe('Migration 030 liability and external payer commands', () => {
  it('is forward-only after 029', async () => {
    const names = await readdir(migrationDir);
    assert.ok(names.includes('202609050029_health_coverage_corrections.sql'));
    assert.ok(names.includes('202609050030_liability_external_payer_commands.sql'));
  });

  it('models borrowed principal as cash plus payable and never income', async () => {
    const sql = await readMigration('202609050030_liability_external_payer_commands.sql');
    const borrowed = sql.slice(sql.indexOf('create or replace function public.create_borrowed_loan'), sql.indexOf('comment on function public.create_borrowed_loan'));
    assert.match(borrowed, /'payable','loan'/);
    assert.match(borrowed, /'loan_principal','realized'/);
    assert.match(borrowed, /destination_account_id/);
    assert.doesNotMatch(borrowed, /'income'/);
    assert.doesNotMatch(borrowed, /insert into public\.transactions/);
  });

  it('requires explicit gift versus reimbursement for external payers', async () => {
    const sql = await readMigration('202609050030_liability_external_payer_commands.sql');
    assert.match(sql, /external_payment_intent as enum \('gift','reimbursement'\)/);
    const external = sql.slice(sql.indexOf('create or replace function public.record_external_expense_payment'), sql.indexOf('comment on function public.record_external_expense_payment'));
    assert.match(external, /p_intent='reimbursement'/);
    assert.match(external, /'payable','reimbursement'/);
    assert.match(external, /p_intent='gift'/);
    assert.doesNotMatch(external, /insert into public\.money_movements/);
    assert.doesNotMatch(external, /'income'/);
  });

  it('does not infer unsupported card routes or member funding', async () => {
    const sql = await readMigration('202609050030_liability_external_payer_commands.sql');
    const external = sql.slice(sql.indexOf('create or replace function public.record_external_expense_payment'), sql.indexOf('comment on function public.record_external_expense_payment'));
    assert.match(external, /mechanism in \('card_purchase','card_pix'\)/);
    assert.match(external, /requires dedicated card route/);
    assert.doesNotMatch(external, /insert into public\.funding_events/);
  });

  it('makes new operational commands retry-safe', async () => {
    const sql = await readMigration('202609050030_liability_external_payer_commands.sql');
    assert.match(sql, /financial_obligations_household_command_key/);
    assert.match(sql, /unique \(household_id,request_key\)/);
    assert.match(sql, /idempotency key already used with different payload/);
    assert.match(sql, /return existing\.id/);
  });

  it('composes partial direct funding with external settlement without exceeding the expense', async () => {
    const sql = await readMigration('202609050030_liability_external_payer_commands.sql');
    const settle = sql.slice(sql.lastIndexOf('create or replace function public.settle_direct_expense'), sql.indexOf('revoke all on function public.create_borrowed_loan'));
    assert.match(settle, /member_already\+external_already\+p_amount/);
    assert.match(settle, /expense funding exceeds economic amount/);
    assert.match(settle, /financial_effective_total_amount/);
  });

  it('keeps write access behind authenticated RPCs and read-only RLS for external facts', async () => {
    const sql = await readMigration('202609050030_liability_external_payer_commands.sql');
    assert.match(sql, /alter table public\.external_payment_events enable row level security/);
    assert.match(sql, /for select[\s\S]*?is_active_household_member\(household_id\)/);
    assert.match(sql, /revoke all on public\.external_payment_events from public,anon/);
    assert.match(sql, /grant select on public\.external_payment_events to authenticated/);
    assert.match(sql, /grant execute on function public\.create_borrowed_loan[\s\S]*?to authenticated/);
    assert.match(sql, /grant execute on function public\.record_external_expense_payment[\s\S]*?to authenticated/);
  });
});
