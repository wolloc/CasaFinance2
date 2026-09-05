begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('24000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','commitments@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Member"}',now(),now()),
 ('24000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider-commitments@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Outsider"}',now(),now());
insert into public.households(id,name) values
 ('24000000-0000-4000-8000-000000000010','Commitment house'),
 ('24000000-0000-4000-8000-000000000011','Other house');
insert into public.household_members(id,household_id,profile_id,role) values
 ('24000000-0000-4000-8000-000000000021','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000001','owner'),
 ('24000000-0000-4000-8000-000000000022','24000000-0000-4000-8000-000000000011','24000000-0000-4000-8000-000000000002','owner');
insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('24000000-0000-4000-8000-000000000030','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','Checking','checking');
insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day) values
 ('24000000-0000-4000-8000-000000000040','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','Card',10000,2,9);

-- Economic purchase in September; only its twelve October-forward installments
-- become financial commitments.
insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date)
values ('24000000-0000-4000-8000-000000000050','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','expense','pending','confirmed','TV',2400,2400,2400,0,'2026-09-20','2026-09-01');
insert into public.installment_plans(id,household_id,purchase_transaction_id,installment_count,total_amount)
values ('24000000-0000-4000-8000-000000000060','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000050',12,2400);
insert into public.installments(id,household_id,installment_plan_id,number,amount,competence_date,due_date)
select ('24000000-0000-4000-8000-' || lpad((60+n)::text,12,'0'))::uuid,
 '24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000060',n,200,
 ('2026-10-01'::date + ((n-1)||' month')::interval)::date,
 ('2026-10-09'::date + ((n-1)||' month')::interval)::date
from generate_series(1,12) n;

select is((select coalesce(sum(effective_amount),0) from public.financial_commitment_positions where source_transaction_id='24000000-0000-4000-8000-000000000050' and financial_month='2026-09-01'),0::numeric,'purchase has no September commitment');
select is((select sum(effective_amount) from public.financial_commitment_positions where source_transaction_id='24000000-0000-4000-8000-000000000050' and financial_month='2026-10-01'),200::numeric,'October contains one 200 installment');
select is((select sum(effective_amount) from public.financial_commitment_positions where source_transaction_id='24000000-0000-4000-8000-000000000050' and financial_month='2026-11-01'),200::numeric,'November contains one 200 installment');
select results_eq($$select count(*),sum(effective_amount)::bigint from public.financial_commitment_positions where source_transaction_id='24000000-0000-4000-8000-000000000050'$$,$$values(12::bigint,2400::bigint)$$,'purchase amount is not duplicated with installments');

-- Invoice metadata and its neutral payment never add rows. Financing context
-- alone is not settlement evidence.
insert into public.card_invoices(id,household_id,card_id,competence_date,closing_date,due_date,total_amount)
values ('24000000-0000-4000-8000-000000000080','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000040','2026-10-01','2026-10-02','2026-10-09',200);
update public.installments set invoice_id='24000000-0000-4000-8000-000000000080' where installment_plan_id='24000000-0000-4000-8000-000000000060' and number=1;
insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at)
values ('24000000-0000-4000-8000-000000000081','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','invoice_payment','paid','realized','Partial invoice payment',100,100,100,100,'2026-10-09','2026-10-01',now());
insert into public.card_invoice_payments(household_id,invoice_id,payment_transaction_id,source_account_id,amount,paid_at)
values ('24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000080','24000000-0000-4000-8000-000000000081','24000000-0000-4000-8000-000000000030',100,now());
insert into public.financing_allocations(household_id,transaction_id,mechanism,amount,card_id,invoice_id,installment_id)
values ('24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000050','card_purchase',200,'24000000-0000-4000-8000-000000000040','24000000-0000-4000-8000-000000000080','24000000-0000-4000-8000-000000000061');
select results_eq($$select realized_amount,remaining_amount from public.financial_commitment_positions where source_installment_id='24000000-0000-4000-8000-000000000061'$$,$$values(0::numeric,200::numeric)$$,'financing context without allocated invoice-payment funding does not realize installment');

insert into public.funding_events(id,household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,invoice_id,installment_id,amount,funded_at)
values ('24000000-0000-4000-8000-000000000090','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000050','24000000-0000-4000-8000-000000000081','24000000-0000-4000-8000-000000000021','24000000-0000-4000-8000-000000000030','24000000-0000-4000-8000-000000000080','24000000-0000-4000-8000-000000000061',100,now());
select results_eq($$select realized_amount,remaining_amount,commitment_state::text from public.financial_commitment_positions where source_installment_id='24000000-0000-4000-8000-000000000061'$$,$$values(100::numeric,100::numeric,'confirmed'::text)$$,'partial real invoice payment realizes only 100 of installment');
select throws_ok($$insert into public.funding_events(household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,invoice_id,installment_id,amount,funded_at) values ('24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000050','24000000-0000-4000-8000-000000000081','24000000-0000-4000-8000-000000000021','24000000-0000-4000-8000-000000000030','24000000-0000-4000-8000-000000000080','24000000-0000-4000-8000-000000000061',100,now())$$,'23505',null,'duplicate funding for the same invoice payment is rejected');
select results_eq($$select realized_amount,remaining_amount from public.financial_commitment_positions where source_installment_id='24000000-0000-4000-8000-000000000061'$$,$$values(100::numeric,100::numeric)$$,'rejected funding retry cannot duplicate realization');

insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at)
values ('24000000-0000-4000-8000-000000000082','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','invoice_payment','paid','realized','Final invoice payment',100,100,100,100,'2026-10-09','2026-10-01',now());
insert into public.card_invoice_payments(household_id,invoice_id,payment_transaction_id,source_account_id,amount,paid_at)
values ('24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000080','24000000-0000-4000-8000-000000000082','24000000-0000-4000-8000-000000000030',100,now());
insert into public.funding_events(id,household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,invoice_id,installment_id,amount,funded_at)
values ('24000000-0000-4000-8000-000000000091','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000050','24000000-0000-4000-8000-000000000082','24000000-0000-4000-8000-000000000021','24000000-0000-4000-8000-000000000030','24000000-0000-4000-8000-000000000080','24000000-0000-4000-8000-000000000061',100,now());
update public.card_invoices set settled_amount=200,status='paid',settled_at=now() where id='24000000-0000-4000-8000-000000000080';
select results_eq($$select realized_amount,remaining_amount,commitment_state::text from public.financial_commitment_positions where source_installment_id='24000000-0000-4000-8000-000000000061'$$,$$values(200::numeric,0::numeric,'realized'::text)$$,'fully paid invoice realizes the complete installment');
select is((select count(*) from public.financial_commitment_positions where source_invoice_id='24000000-0000-4000-8000-000000000080'),1::bigint,'invoice does not duplicate its installment');
select is((select count(*) from public.financial_commitment_positions where source_transaction_id in ('24000000-0000-4000-8000-000000000081','24000000-0000-4000-8000-000000000082')),0::bigint,'invoice payments create no commitments');

-- Direct fallback amounts exercise forecast, confirmation, partial/full
-- realization, cancellation, reversal, due-date priority, and cents.
insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,due_date)
values
 ('24000000-0000-4000-8000-000000000101','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','expense','pending','forecast','Direct 300',300,300,null,0,'2026-08-10','2026-08-01','2026-09-15'),
 ('24000000-0000-4000-8000-000000000102','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','expense','pending','confirmed','Confirmed cents',287.43,250,287.43,0,'2026-09-01','2026-09-01',null),
 ('24000000-0000-4000-8000-000000000103','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','expense','pending','confirmed','Partial',1000,1000,1000,400,'2026-09-01','2026-09-01',null),
 ('24000000-0000-4000-8000-000000000104','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','expense','pending','realized','Full',1000,1000,1000,1000,'2026-09-01','2026-09-01',null),
 ('24000000-0000-4000-8000-000000000105','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','expense','cancelled','cancelled','Cancelled',100,100,100,0,'2026-09-01','2026-09-01',null),
 ('24000000-0000-4000-8000-000000000106','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','expense','refunded','reversed','Reversed',100,100,100,0,'2026-09-01','2026-09-01',null),
 ('24000000-0000-4000-8000-000000000107','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','expense','pending','forecast','Past due',300,300,null,0,(current_date-interval '2 month')::date,date_trunc('month',current_date-interval '2 month')::date,(current_date-interval '2 month')::date),
 ('24000000-0000-4000-8000-000000000108','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','expense','pending','forecast','Future',300,300,null,0,(current_date+interval '2 month')::date,date_trunc('month',current_date+interval '2 month')::date,(current_date+interval '2 month')::date);
select is((select financial_month from public.financial_commitment_positions where source_id='24000000-0000-4000-8000-000000000101'),'2026-09-01'::date,'direct expense prioritizes due date');
select results_eq($$select effective_amount,realized_amount,remaining_amount from public.financial_commitment_positions where source_id='24000000-0000-4000-8000-000000000101'$$,$$values(300::numeric,0::numeric,300::numeric)$$,'forecast keeps one effective version');
select results_eq($$select effective_amount,remaining_amount from public.financial_commitment_positions where source_id='24000000-0000-4000-8000-000000000102'$$,$$values(287.43::numeric,287.43::numeric)$$,'confirmation replaces estimate and preserves cents');
select results_eq($$select effective_amount,realized_amount,remaining_amount,commitment_state::text from public.financial_commitment_positions where source_id='24000000-0000-4000-8000-000000000103'$$,$$values(1000::numeric,400::numeric,600::numeric,'confirmed'::text)$$,'partial realization remains confirmed');
select results_eq($$select effective_amount,remaining_amount,commitment_state::text from public.financial_commitment_positions where source_id='24000000-0000-4000-8000-000000000104'$$,$$values(1000::numeric,0::numeric,'realized'::text)$$,'full realization has zero remaining');
select results_eq($$select effective_amount,remaining_amount from public.financial_commitment_positions where source_id='24000000-0000-4000-8000-000000000105'$$,$$values(0::numeric,0::numeric)$$,'cancelled commitment has no impact');
select results_eq($$select effective_amount,remaining_amount from public.financial_commitment_positions where source_id='24000000-0000-4000-8000-000000000106'$$,$$values(0::numeric,0::numeric)$$,'reversed commitment has no impact');
select ok((select is_prior_pending and financial_month=date_trunc('month',current_date-interval '2 month')::date from public.financial_commitment_positions where source_id='24000000-0000-4000-8000-000000000107'),'past forecast keeps original month and becomes prior pending');
select isnt((select is_prior_pending from public.financial_commitment_positions where source_id='24000000-0000-4000-8000-000000000108'),true,'future forecast is not prior pending');
select is((select count(*) from public.financial_commitment_positions where financial_month<>date_trunc('month',financial_month)::date),0::bigint,'every financial month is its first day');

-- Payable realization comes from obligation events. Receivables are excluded.
insert into public.financial_parties(id,household_id,created_by_member_id,name) values
 ('24000000-0000-4000-8000-000000000120','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','Third party');
insert into public.financial_obligations(id,household_id,created_by_member_id,kind,counterparty_id,original_amount,obligation_date,due_date,description)
values
 ('24000000-0000-4000-8000-000000000121','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','payable','24000000-0000-4000-8000-000000000120',500,current_date,current_date+10,'Payable'),
 ('24000000-0000-4000-8000-000000000122','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','receivable','24000000-0000-4000-8000-000000000120',500,current_date,current_date+10,'Receivable');
insert into public.money_movements(id,household_id,created_by_member_id,kind,state,amount,description,source_account_id,obligation_id,movement_date,competence_date,realized_at)
values ('24000000-0000-4000-8000-000000000123','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','payable_payment','realized',200,'Partial payable','24000000-0000-4000-8000-000000000030','24000000-0000-4000-8000-000000000121',current_date,date_trunc('month',current_date)::date,now());
insert into public.obligation_events(household_id,obligation_id,created_by_member_id,kind,amount,movement_id,occurred_at)
values ('24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000121','24000000-0000-4000-8000-000000000021','payment',200,'24000000-0000-4000-8000-000000000123',now());
update public.financial_obligations set state='partially_settled' where id='24000000-0000-4000-8000-000000000121';
select results_eq($$select effective_amount,realized_amount,remaining_amount from public.financial_commitment_positions where source_obligation_id='24000000-0000-4000-8000-000000000121'$$,$$values(500::numeric,200::numeric,300::numeric)$$,'payable exposes effective, partial realized, and remaining values');
select is((select count(*) from public.financial_commitment_positions where source_obligation_id='24000000-0000-4000-8000-000000000122'),0::bigint,'receivable is not an outgoing commitment');

-- Only the materialized occurrence is emitted, never the recurring rule/template.
insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,realized_amount,transaction_date,competence_date)
values ('24000000-0000-4000-8000-000000000130','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','expense','pending','forecast','Recurring occurrence',99.99,99.99,0,current_date,date_trunc('month',current_date)::date);
insert into public.recurring_rules(id,household_id,created_by_member_id,template_transaction_id,frequency,start_date)
values ('24000000-0000-4000-8000-000000000131','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000021','24000000-0000-4000-8000-000000000130','monthly',current_date);
insert into public.recurring_occurrences(id,household_id,recurring_rule_id,transaction_id,competence_date,due_date,estimated_amount)
values ('24000000-0000-4000-8000-000000000132','24000000-0000-4000-8000-000000000010','24000000-0000-4000-8000-000000000131','24000000-0000-4000-8000-000000000130',date_trunc('month',current_date)::date,current_date,99.99);
select results_eq($$select count(*),sum(effective_amount) from public.financial_commitment_positions where source_transaction_id='24000000-0000-4000-8000-000000000130'$$,$$values(1::bigint,99.99::numeric)$$,'recurring occurrence appears exactly once and rule does not duplicate it');

select set_config('request.jwt.claim.sub','24000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select is((select count(*) from public.financial_commitment_positions where household_id='24000000-0000-4000-8000-000000000010'),0::bigint,'security-invoker view preserves household RLS isolation');

reset role;
select * from finish();
rollback;
