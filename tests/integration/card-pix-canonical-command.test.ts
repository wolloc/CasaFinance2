import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql=await readFile(new URL('../../supabase/migrations/202609090067_simple_card_pix_expense.sql',import.meta.url),'utf8');
const service=await readFile(new URL('../../src/finance/simpleCardPixExpense.ts',import.meta.url),'utf8');

test('product-facing card PIX principal is one expense financed by card_pix without cash movement',()=>{
  assert.match(sql,/principal_tx:=public\.create_financial_transaction\([\s\S]*?'expense'[\s\S]*?'card'/);
  assert.match(sql,/transaction_components[\s\S]*?'principal'/);
  assert.match(sql,/financing_allocations[\s\S]*?'card_pix'[\s\S]*?'principal'/);
  assert.doesNotMatch(sql,/insert into public\.money_movements/);
  assert.doesNotMatch(sql,/insert into public\.funding_events/);
});

test('one financial-charge field becomes a linked economic charge on the same card route',()=>{
  assert.match(sql,/p_financial_charge_amount/);
  assert.match(sql,/charge_tx:=public\.create_financial_transaction/);
  assert.match(sql,/transaction_components[\s\S]*?charge_tx,'fee'/);
  assert.match(sql,/transaction_links[\s\S]*?principal_tx,charge_tx,'fee'/);
  assert.match(sql,/financing_allocations[\s\S]*?charge_tx,'card_pix','fee'/);
  assert.doesNotMatch(sql,/p_interest_amount/);
});

test('product service keeps buyer, responsibility and card route independent while reusing one installment route',()=>{
  assert.match(service,/buyerMemberId/);
  assert.match(service,/principalResponsibility/);
  assert.match(service,/chargeResponsibility/);
  assert.match(service,/cardId/);
  assert.match(service,/installmentCount/);
  assert.match(service,/create_simple_card_pix_expense/);
  assert.match(service,/runRetryStableRpc/);
  assert.doesNotMatch(service,/funderMemberId/);
});

test('product-facing card PIX is retry idempotent and household scoped',()=>{
  assert.match(sql,/caller:=public\.require_active_member\(p_household_id\)/);
  assert.match(sql,/financial_command_existing_or_lock/);
  assert.match(sql,/financial_command_store/);
  assert.match(sql,/active household card required/);
  assert.match(sql,/security definer set search_path=public,pg_temp/);
  assert.match(sql,/grant execute[\s\S]*to authenticated/);
});
