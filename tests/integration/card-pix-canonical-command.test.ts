import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql=await readFile(new URL('../../supabase/migrations/202609070066_card_pix_canonical_command.sql',import.meta.url),'utf8');
const service=await readFile(new URL('../../src/finance/cardPixFinancing.ts',import.meta.url),'utf8');

test('card PIX principal is one expense financed by card_pix without cash movement',()=>{
  assert.match(sql,/principal_tx:=public\.create_financial_transaction\([\s\S]*?'expense'[\s\S]*?'card'/);
  assert.match(sql,/transaction_components[\s\S]*?'principal'/);
  assert.match(sql,/financing_allocations[\s\S]*?'card_pix'[\s\S]*?'principal'/);
  assert.doesNotMatch(sql,/insert into public\.money_movements/);
  assert.doesNotMatch(sql,/insert into public\.funding_events/);
});

test('fee and interest are separate economic transactions linked to principal',()=>{
  assert.match(sql,/fee_tx:=public\.create_financial_transaction/);
  assert.match(sql,/transaction_components[\s\S]*?fee_tx,'fee'/);
  assert.match(sql,/transaction_links[\s\S]*?principal_tx,fee_tx,'fee'/);
  assert.match(sql,/interest_tx:=public\.create_financial_transaction/);
  assert.match(sql,/transaction_components[\s\S]*?interest_tx,'interest'/);
  assert.match(sql,/transaction_links[\s\S]*?principal_tx,interest_tx,'interest'/);
});

test('charges require explicit category responsibility and installment route instead of inheriting silently',()=>{
  assert.match(sql,/fee category is required when fee exists/);
  assert.match(sql,/interest category is required when interest exists/);
  assert.match(sql,/p_fee_splits/);
  assert.match(sql,/p_interest_splits/);
  assert.match(sql,/p_fee_installment_count/);
  assert.match(sql,/p_interest_installment_count/);
});

test('card PIX command is household-scoped and retry idempotent',()=>{
  assert.match(sql,/caller:=public\.require_active_member\(p_household_id\)/);
  assert.match(sql,/financial_command_existing_or_lock/);
  assert.match(sql,/financial_command_store/);
  assert.match(sql,/active household card required/);
  assert.match(sql,/security definer set search_path=public,pg_temp/);
  assert.match(sql,/grant execute[\s\S]*to authenticated/);
});

test('frontend service preserves buyer responsibility and financing route as independent inputs',()=>{
  assert.match(service,/buyerMemberId/);
  assert.match(service,/responsibility/);
  assert.match(service,/cardId/);
  assert.match(service,/create_card_pix_expense/);
  assert.match(service,/runRetryStableRpc/);
  assert.doesNotMatch(service,/funderMemberId/);
});
