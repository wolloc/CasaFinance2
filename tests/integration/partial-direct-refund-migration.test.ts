import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import test from'node:test';
const sql=await readFile(new URL('../../supabase/migrations/202609060056_partial_direct_refunds.sql',import.meta.url),'utf8');
test('partial refunds accumulate and cannot exceed original realized expense',()=>{assert.match(sql,/refunded_before/);assert.match(sql,/refunded_after:=refunded_before\+p_amount/);assert.match(sql,/refund exceeds remaining refundable amount/);});
test('refund returns one cash movement to the actual funding account',()=>{assert.match(sql,/count\(distinct f\.source_account_id\)/);assert.match(sql,/destination_account_id/);assert.match(sql,/'refund','realized'/);});
test('partial refund keeps original expense open until fully reversed',()=>{assert.match(sql,/if refunded_after=tx\.realized_amount then/);assert.match(sql,/economic_state='reversed',status='refunded'/);});
test('refund is linked history, not true income',()=>{assert.match(sql,/transaction_links/);assert.match(sql,/'refund'/);assert.doesNotMatch(sql,/type='income'|,'income'/);});
test('card, obligation and external payer routes stay blocked',()=>{assert.match(sql,/linked card, obligation or external-payer refund requires a dedicated route/);assert.match(sql,/installment_plans/);assert.match(sql,/external_payment_events/);});
