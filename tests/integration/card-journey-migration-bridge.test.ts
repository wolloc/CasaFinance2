import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bridge=await readFile(new URL('../../supabase/migrations/20260906005630_card_journey_credit_columns_bridge.sql',import.meta.url),'utf8');
const refund=await readFile(new URL('../../supabase/migrations/202609060057_card_invoice_credit_refunds.sql',import.meta.url),'utf8');

test('bridge keeps historical migrations immutable and prepares the card journey column order',()=>{
 assert.match(bridge,/drop view if exists public\.financial_card_journey_positions/);
 const selectBlock=bridge.slice(bridge.indexOf('select i.household_id'));
 const creditAmount=selectBlock.indexOf('as credit_amount');
 const creditEvents=selectBlock.indexOf('as credit_events');
 const funding=selectBlock.indexOf('as funding_events');
 const settlements=selectBlock.indexOf('as settlement_events');
 assert.ok(creditAmount>=0&&creditEvents>creditAmount&&funding>creditEvents&&settlements>funding);
});

test('refund migration can replace the bridged view without changing column ordinals',()=>{
 const marker='-- Add issuer credit evidence to the contextual card journey';
 const target=refund.slice(refund.indexOf(marker));
 const creditAmount=target.indexOf('credit_amount');
 const creditEvents=target.indexOf('credit_events');
 const funding=target.indexOf('funding_events');
 const settlements=target.indexOf('settlement_events');
 assert.ok(creditAmount>=0&&creditEvents>creditAmount&&funding>creditEvents&&settlements>funding);
});

test('bridge is read-model only and does not mutate financial facts',()=>{
 assert.doesNotMatch(bridge,/insert into|update public\.|delete from|\.rpc\(/i);
 assert.match(bridge,/security_invoker=true/);
 assert.match(bridge,/grant select on public\.financial_card_journey_positions to authenticated/);
});
