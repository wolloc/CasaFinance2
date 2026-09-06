import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../../supabase/migrations/202609060063_shared_post_payment_card_refunds.sql', import.meta.url), 'utf8');

test('shared refund stores explicit benefit recovery without rewriting original funding', () => {
  assert.match(sql, /create table if not exists public\.funding_recovery_events/);
  assert.match(sql, /beneficiary_member_id/);
  assert.match(sql, /Original funding\/history is immutable/);
  assert.doesNotMatch(sql, /update public\.funding_events/);
  assert.doesNotMatch(sql, /delete from public\.funding_events/);
});

test('cash location and refund beneficiary are independent', () => {
  assert.match(sql, /p_destination_account_id/);
  assert.match(sql, /p_benefit_allocations/);
  assert.match(sql, /beneficiary_member_id/);
  assert.match(sql, /active household account/);
});

test('refund redistribution appends settlement adjustment instead of mutating realized history', () => {
  assert.match(sql, /insert into public\.member_settlement_events/);
  assert.match(sql, /'realized','adjustment'/);
  assert.match(sql, /before_amount-after_amount/);
  assert.doesNotMatch(sql, /delete from public\.member_settlement_events/);
});

test('shared and legacy card refund routes share one cumulative cap', () => {
  assert.match(sql, /enforce_card_refund_cumulative_cap/);
  assert.match(sql, /public\.card_refund_events/);
  assert.match(sql, /public\.card_post_payment_refund_events/);
  assert.match(sql, /public\.card_shared_post_payment_refund_events/);
  assert.match(sql, /refund exceeds remaining refundable amount/);
});

test('external responsibility remains blocked instead of being guessed', () => {
  assert.match(sql, /responsible_party_id is not null/);
  assert.match(sql, /external responsibility requires a separate recovery route/);
});
