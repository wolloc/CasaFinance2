import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql=await readFile(new URL('../../supabase/migrations/202609060062_manual_obligation_management.sql',import.meta.url),'utf8');

test('manual obligation management keeps immutable before and after history',()=>{
  assert.match(sql,/create table if not exists public\.manual_obligation_adjustment_events/);
  assert.match(sql,/before_payload jsonb not null/);
  assert.match(sql,/after_payload jsonb not null/);
  assert.match(sql,/unique \(household_id, request_key\)/);
  assert.match(sql,/action text not null check \(action in \('correction','cancellation'\)\)/);
});

test('only untouched open manual obligations can be administratively changed',()=>{
  assert.match(sql,/obligation\.origin_kind::text<>'manual'/);
  assert.match(sql,/obligation\.state::text<>'open'/);
  assert.match(sql,/exists\(select 1 from public\.obligation_events where obligation_id=p_obligation_id\)/);
  assert.match(sql,/only untouched open manual obligations can be corrected/);
  assert.match(sql,/only untouched open manual obligations can be cancelled administratively/);
});

test('correction is commitment and history only',()=>{
  const correction=sql.split('create or replace function public.correct_manual_third_party_obligation')[1].split('create or replace function public.cancel_manual_third_party_obligation')[0];
  assert.match(correction,/update public\.financial_obligations/);
  assert.match(correction,/insert into public\.manual_obligation_adjustment_events/);
  assert.doesNotMatch(correction,/insert into public\.transactions\s*\(/i);
  assert.doesNotMatch(correction,/insert into public\.money_movements\s*\(/i);
  assert.doesNotMatch(correction,/insert into public\.funding_events\s*\(/i);
  assert.doesNotMatch(correction,/insert into public\.obligation_events\s*\(/i);
});

test('administrative cancellation records cancellation but invents no economic or cash fact',()=>{
  const cancellation=sql.split('create or replace function public.cancel_manual_third_party_obligation')[1];
  assert.match(cancellation,/insert into public\.obligation_events/);
  assert.match(cancellation,/'cancellation',obligation\.original_amount/);
  assert.match(cancellation,/set state='cancelled',closed_at=now\(\)/);
  assert.doesNotMatch(cancellation,/insert into public\.transactions\s*\(/i);
  assert.doesNotMatch(cancellation,/insert into public\.money_movements\s*\(/i);
  assert.doesNotMatch(cancellation,/insert into public\.funding_events\s*\(/i);
});

test('new counterparty and idempotency key are protected',()=>{
  assert.match(sql,/active household counterparty required/);
  assert.match(sql,/existing\.action<>'correction' or existing\.obligation_id<>p_obligation_id/);
  assert.match(sql,/existing\.action<>'cancellation' or existing\.obligation_id<>p_obligation_id/);
  assert.match(sql,/idempotency key already used with different command/);
});
