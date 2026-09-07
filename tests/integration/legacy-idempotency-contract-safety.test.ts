import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql=await readFile(new URL('../../supabase/migrations/202609070064_retry_idempotency_legacy_financial_commands.sql',import.meta.url),'utf8');

test('legacy idempotency ledger is household scoped and inaccessible for direct writes',()=>{
  assert.match(sql,/unique\(household_id,operation,request_key\)/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/revoke all on public\.financial_command_requests from public,anon,authenticated/);
  assert.match(sql,/grant select on public\.financial_command_requests to authenticated/);
});

test('request lock and store are private security-definer helpers with fixed search path',()=>{
  for(const fn of ['financial_command_existing_or_lock','financial_command_store']){
    const start=sql.indexOf(`function public.${fn}`);
    assert.ok(start>=0);
    const block=sql.slice(start,start+1800);
    assert.match(block,/security definer/);
    assert.match(block,/set search_path=public,pg_temp/);
  }
  assert.match(sql,/pg_advisory_xact_lock/);
});

test('all public wrappers check existing request before invoking legacy command',()=>{
  const wrappers=['pay_card_invoice','settle_income','settle_direct_expense','create_transfer','settle_member_position','settle_financial_obligation','write_off_receivable','create_loan_principal','record_investment_performance','create_and_settle_direct_expense','create_and_settle_shared_expense','settle_recurring_expense_occurrence'];
  for(const name of wrappers){
    const start=sql.indexOf(`function public.${name}_idempotent`);
    assert.ok(start>=0,`${name} wrapper missing`);
    const block=sql.slice(start,start+1800);
    const lookup=block.indexOf('financial_command_existing_or_lock');
    const call=block.indexOf(`public.${name}(`);
    const store=block.indexOf('financial_command_store');
    assert.ok(lookup>=0&&call>lookup&&store>call,`${name} must lookup, execute, then store`);
  }
});
