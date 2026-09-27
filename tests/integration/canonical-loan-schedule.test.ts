import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql=await readFile(new URL('../../supabase/migrations/20260927194000_canonical_loan_schedule.sql',import.meta.url),'utf8');

test('canonical loan schedule stays linked to financial_obligations and does not reactivate legacy loan tables',()=>{
 assert.match(sql,/create table if not exists public\.loan_schedule_items/);
 assert.match(sql,/principal_obligation_id uuid not null references public\.financial_obligations/);
 assert.match(sql,/create or replace view public\.financial_loan_schedule\s+with \(security_invoker=true\)/);
 assert.doesNotMatch(sql,/insert into public\.loan_installments/);
 assert.doesNotMatch(sql,/insert into public\.loan_payment_schedule/);
});

test('schedule preserves principal neutrality and projects contractual costs separately',()=>{
 assert.match(sql,/principal_amount numeric/);
 assert.match(sql,/projected_interest_amount numeric/);
 assert.match(sql,/projected_fee_amount numeric/);
 assert.match(sql,/cost_responsible_member_id/);
 assert.match(sql,/create_loan_principal_with_schedule_idempotent/);
 assert.match(sql,/financial_command_existing_or_lock/);
 assert.match(sql,/p_direction='granted'.*income-side contractual charges are not supported/s);
});

test('scheduled payments are partial, ordered and use one canonical cash payment',()=>{
 assert.match(sql,/record_scheduled_loan_payment/);
 assert.match(sql,/payments must follow the earliest open installment/);
 assert.match(sql,/scheduled payment exceeds installment remaining amount/);
 assert.match(sql,/public\.record_loan_payment/);
 assert.match(sql,/allocate_loan_payment_to_schedule_after_insert/);
 assert.match(sql,/paid_principal_amount/);
 assert.match(sql,/paid_interest_amount/);
 assert.match(sql,/paid_fee_amount/);
});

test('new schedule surface is read-only to clients and member-scoped',()=>{
 assert.match(sql,/enable row level security/);
 assert.match(sql,/for select to authenticated/);
 assert.match(sql,/public\.is_active_household_member\(household_id\)/);
 assert.match(sql,/revoke all on table public\.loan_schedule_items from public,anon/);
 assert.match(sql,/grant select on table public\.loan_schedule_items to authenticated/);
});
