begin;

create extension if not exists pgtap with schema extensions;
select plan(36);

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('25000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','projection@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Member"}',now(),now()),
 ('25000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider-projection@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Outsider"}',now(),now());
insert into public.households(id,name) values
 ('25000000-0000-4000-8000-000000000010','Projection house'),
 ('25000000-0000-4000-8000-000000000011','Other house');
insert into public.household_members(id,household_id,profile_id,role) values
 ('25000000-0000-4000-8000-000000000021','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000001','owner'),
 ('25000000-0000-4000-8000-000000000022','25000000-0000-4000-8000-000000000011','25000000-0000-4000-8000-000000000002','owner');
insert into public.categories(id,household_id,name,type) values
 ('25000000-0000-4000-8000-000000000025','25000000-0000-4000-8000-000000000010','Salary','income'),
 ('25000000-0000-4000-8000-000000000026','25000000-0000-4000-8000-000000000011','Salary','income');
insert into public.accounts(id,household_id,owner_member_id,name,type,resource_restriction,overdraft_enabled,overdraft_limit) values
 ('25000000-0000-4000-8000-000000000030','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','Positive checking','checking',null,true,2000),
 ('25000000-0000-4000-8000-000000000031','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','Negative wallet','digital_wallet',null,false,0),
 ('25000000-0000-4000-8000-000000000032','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','Investment','investment',null,false,0),
 ('25000000-0000-4000-8000-000000000033','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','Reserve','savings','reserve',false,0),
 ('25000000-0000-4000-8000-000000000034','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','Benefit','meal_benefit','meal_benefit',false,0);
insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('25000000-0000-4000-8000-000000000035','25000000-0000-4000-8000-000000000011','25000000-0000-4000-8000-000000000022','Example checking','checking');
insert into public.account_balance_events(household_id,account_id,created_by_member_id,kind,amount,effective_date,description) values
 ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000030','25000000-0000-4000-8000-000000000021','opening',1000,'2026-09-01','Canonical opening'),
 ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000031','25000000-0000-4000-8000-000000000021','opening',-350,'2026-09-01','Negative position'),
 ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000032','25000000-0000-4000-8000-000000000021','opening',20000,'2026-09-01','Investment position'),
 ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000033','25000000-0000-4000-8000-000000000021','opening',5000,'2026-09-01','Reserve position'),
 ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000034','25000000-0000-4000-8000-000000000021','opening',500,'2026-09-01','Benefit position');
insert into public.account_balance_events(household_id,account_id,created_by_member_id,kind,amount,effective_date,description) values
 ('25000000-0000-4000-8000-000000000011','25000000-0000-4000-8000-000000000035','25000000-0000-4000-8000-000000000022','opening',1000,'2026-09-01','Example opening');

-- Real income is already in current cash; projected income is the only income
-- added by the formula. Every other projected cash kind remains non-income.
insert into public.money_movements(id,household_id,created_by_member_id,kind,state,amount,description,beneficiary_member_id,destination_account_id,category_id,movement_date,competence_date,realized_at) values
 ('25000000-0000-4000-8000-000000000040','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','income','realized',500,'Received salary','25000000-0000-4000-8000-000000000021','25000000-0000-4000-8000-000000000030','25000000-0000-4000-8000-000000000025','2026-09-02','2026-09-01',now()),
 ('25000000-0000-4000-8000-000000000041','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','income','projected',1000,'Expected salary','25000000-0000-4000-8000-000000000021','25000000-0000-4000-8000-000000000030','25000000-0000-4000-8000-000000000025','2026-09-25','2026-09-01',null),
 ('25000000-0000-4000-8000-000000000042','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','income','projected',2000,'October salary','25000000-0000-4000-8000-000000000021','25000000-0000-4000-8000-000000000030','25000000-0000-4000-8000-000000000025','2026-10-25','2026-10-01',null);
insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,source_account_id,destination_account_id,movement_date,competence_date) values
 ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','transfer','projected',800,'Own transfer','25000000-0000-4000-8000-000000000030','25000000-0000-4000-8000-000000000031','2026-09-20','2026-09-01');
insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,destination_account_id,movement_date,competence_date) values
 ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','loan_disbursement','projected',700,'Borrowed principal','25000000-0000-4000-8000-000000000030','2026-09-20','2026-09-01'),
 ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','refund','projected',50,'Refund','25000000-0000-4000-8000-000000000030','2026-09-20','2026-09-01'),
 ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','receivable_collection','projected',100,'Receivable','25000000-0000-4000-8000-000000000030','2026-09-20','2026-09-01');

-- Prior, payable, partially realized and fully realized commitment facts.
insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,due_date) values
 ('25000000-0000-4000-8000-000000000050','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','expense','pending','forecast','Prior pending',300,300,null,0,'2026-08-01','2026-08-01','2026-08-10'),
 ('25000000-0000-4000-8000-000000000051','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','expense','pending','confirmed','Partial expense',1000,1000,1000,400,'2026-09-01','2026-09-01','2026-09-15'),
 ('25000000-0000-4000-8000-000000000052','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','expense','paid','realized','Paid expense',200,200,200,200,'2026-09-01','2026-09-01','2026-09-10'),
 ('25000000-0000-4000-8000-000000000053','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','expense','paid','realized','Recurring template',250,250,250,250,'2026-09-01','2026-09-01','2026-09-01');
insert into public.transactions(id,household_id,created_by_member_id,category_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date) values
 ('25000000-0000-4000-8000-000000000043','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','25000000-0000-4000-8000-000000000025','income','pending','confirmed','Confirmed October salary',2000,2000,2000,0,'2026-10-25','2026-10-01');
update public.money_movements set related_transaction_id='25000000-0000-4000-8000-000000000043' where id='25000000-0000-4000-8000-000000000042';
insert into public.financial_parties(id,household_id,created_by_member_id,name) values
 ('25000000-0000-4000-8000-000000000055','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','Third party');
insert into public.financial_obligations(id,household_id,created_by_member_id,kind,counterparty_id,original_amount,obligation_date,due_date,description) values
 ('25000000-0000-4000-8000-000000000056','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','payable','25000000-0000-4000-8000-000000000055',500,'2026-09-01','2026-09-20','Payable'),
 ('25000000-0000-4000-8000-000000000057','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','receivable','25000000-0000-4000-8000-000000000055',900,'2026-09-01','2026-09-20','Receivable');

-- Installments prove the purchase itself, invoices and their payments are not
-- independently reconstructed by projection 025.
insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date) values
 ('25000000-0000-4000-8000-000000000060','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','expense','pending','confirmed','TV',2400,2400,2400,0,'2026-09-20','2026-09-01');
insert into public.installment_plans(id,household_id,purchase_transaction_id,installment_count,total_amount) values
 ('25000000-0000-4000-8000-000000000061','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000060',12,2400);
insert into public.installments(household_id,installment_plan_id,number,amount,competence_date,due_date)
select '25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000061',n,200,
       ('2026-10-01'::date+((n-1)||' months')::interval)::date,
       ('2026-10-09'::date+((n-1)||' months')::interval)::date
  from generate_series(1,12) n;

-- A materialized November estimate of 287.43 replaces that date's rule estimate;
-- the unmaterialized October/December occurrences retain the rule's 250.
insert into public.recurring_rules(id,household_id,created_by_member_id,template_transaction_id,frequency,interval_count,start_date,amount_mode,estimated_amount) values
 ('25000000-0000-4000-8000-000000000070','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','25000000-0000-4000-8000-000000000053','monthly',1,'2026-10-05','estimated',250);
insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,due_date) values
 ('25000000-0000-4000-8000-000000000071','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','expense','pending','confirmed','Confirmed energy',287.43,250,287.43,0,'2026-11-05','2026-11-01','2026-11-05');
insert into public.recurring_occurrences(id,household_id,recurring_rule_id,transaction_id,competence_date,due_date,status,idempotency_key,estimated_amount,confirmed_amount,confirmed_at) values
 ('25000000-0000-4000-8000-000000000072','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000070','25000000-0000-4000-8000-000000000071','2026-11-05','2026-11-05','pending','2026-11-05',250,287.43,now());

-- Isolated Sep -> Oct -> Nov chain requested by the projection contract.
insert into public.transactions(id,household_id,created_by_member_id,category_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date) values
 ('25000000-0000-4000-8000-000000000073','25000000-0000-4000-8000-000000000011','25000000-0000-4000-8000-000000000022','25000000-0000-4000-8000-000000000026','income','pending','confirmed','Reliable October income',2000,2000,2000,0,'2026-10-10','2026-10-01'),
 ('25000000-0000-4000-8000-000000000074','25000000-0000-4000-8000-000000000011','25000000-0000-4000-8000-000000000022',null,'expense','pending','confirmed','October commitment',500,500,500,0,'2026-10-10','2026-10-01'),
 ('25000000-0000-4000-8000-000000000075','25000000-0000-4000-8000-000000000011','25000000-0000-4000-8000-000000000022',null,'expense','pending','confirmed','November commitment',300,300,300,0,'2026-11-10','2026-11-01');
insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,beneficiary_member_id,destination_account_id,category_id,related_transaction_id,movement_date,competence_date) values
 ('25000000-0000-4000-8000-000000000011','25000000-0000-4000-8000-000000000022','income','projected',2000,'Reliable October income','25000000-0000-4000-8000-000000000022','25000000-0000-4000-8000-000000000035','25000000-0000-4000-8000-000000000026','25000000-0000-4000-8000-000000000073','2026-10-10','2026-10-01');

select set_config('request.jwt.claim.sub','25000000-0000-4000-8000-000000000001',true);
set local role authenticated;

select is((select current_balance from public.financial_available_cash_positions where account_id='25000000-0000-4000-8000-000000000030'),1500::numeric,'1 positive cash includes canonical realized movement');
select is((select current_balance from public.financial_available_cash_positions where account_id='25000000-0000-4000-8000-000000000031'),-350::numeric,'2 negative account reduces cash');
select is((select sum(current_balance) from public.financial_available_cash_positions where household_id='25000000-0000-4000-8000-000000000010'),1150::numeric,'3 overdraft limit is not cash');
select is((select count(*) from public.financial_available_cash_positions where account_id='25000000-0000-4000-8000-000000000032'),0::bigint,'4 investment excluded');
select is((select count(*) from public.financial_available_cash_positions where account_id='25000000-0000-4000-8000-000000000033'),0::bigint,'5 reserve excluded');
select is((select current_balance from public.financial_available_cash_positions where account_id='25000000-0000-4000-8000-000000000034'),500::numeric,'6 benefit is available usable resource');
select is((select sum(current_balance) from public.financial_available_cash_positions where household_id='25000000-0000-4000-8000-000000000010'),1650::numeric,'7 benefit participates in available household resources');
select is((select count(*) from public.financial_true_income_positions where money_movement_id is null),0::bigint,'8 receivable is absent from income positions');
select is((select remaining_commitments_in_month from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) where month_index=0),1100::numeric,'9 payable is included with direct remaining commitment');
select results_eq($$select opening_cash,realized_true_income_in_month from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) where month_index=0$$,$$values(1150::numeric,500::numeric)$$,'9 realized salary is explanatory and already in cash');
select is((select expected_reliable_income_remaining from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) where month_index=0),0::numeric,'36 unlinked projected income is not reliable');
select is((select projected_ending_cash from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',1)),-250::numeric,'uncertain income does not improve ending cash');
select is((select expected_reliable_income_remaining from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) where financial_month='2026-10-01'),2000::numeric,'confirmed linked income enters once');
select is((select count(*) from public.financial_true_income_positions where household_id='25000000-0000-4000-8000-000000000010'),2::bigint,'36 own transfer is not income');
select is((select count(*) from public.financial_true_income_positions where household_id='25000000-0000-4000-8000-000000000010' and amount=700),0::bigint,'36 borrowed principal is not income');
select is((select count(*) from public.financial_true_income_positions where household_id='25000000-0000-4000-8000-000000000010' and amount=50),0::bigint,'36 refund is not income');
select is((select remaining_amount from public.financial_commitment_positions where source_id='25000000-0000-4000-8000-000000000052'),0::numeric,'36 realized commitment is not subtracted');
select is((select remaining_amount from public.financial_commitment_positions where source_id='25000000-0000-4000-8000-000000000051'),600::numeric,'36 partial commitment uses remaining only');
select is((select remaining_commitments_in_month from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) where financial_month='2026-10-01'),200::numeric,'36 TV contributes 200 in October');
select is((select sum(remaining_amount) from public.financial_commitment_positions where source_transaction_id='25000000-0000-4000-8000-000000000060'),2400::numeric,'36 purchase is not added over its installments');
select is((select count(*) from public.financial_commitment_positions where commitment_type='invoice_payment'),0::bigint,'36 invoice payment is not a commitment');
select results_eq($$select month_index,prior_pending_outflow from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) order by month_index$$,$$values (0,300::numeric),(1,0::numeric),(2,0::numeric),(3,0::numeric)$$,'36 prior pending is charged once');
select is((select financial_month from public.financial_commitment_positions where source_id='25000000-0000-4000-8000-000000000050'),'2026-08-01'::date,'36 prior pending preserves original month');
select ok((select n.opening_cash=o.projected_ending_cash from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) o join public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) n on n.month_index=o.month_index+1 where o.month_index=1),'36 October ending feeds November opening');
select ok((select n.opening_cash=o.projected_ending_cash from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) o join public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) n on n.month_index=o.month_index+1 where o.month_index=2),'36 November ending feeds December opening');
select is((select projected_recurring_commitments from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) where financial_month='2026-11-01'),0::numeric,'36 occurrence suppresses rule on its date');
select is((select projected_recurring_commitments from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) where financial_month='2026-10-01'),250::numeric,'36 future recurring estimate is projected');
select results_eq($$select remaining_commitments_in_month,projected_recurring_commitments from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) where financial_month='2026-11-01'$$,$$values(487.43::numeric,0::numeric)$$,'36 confirmed occurrence replaces its 250 estimate and preserves cents');
select is((select count(*) from public.financial_true_income_positions where household_id='25000000-0000-4000-8000-000000000010' and financial_month='2026-09-01'),2::bigint,'36 member settlements never become household income');
select is((select projected_ending_cash from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) where financial_month='2026-11-01'),812.57::numeric,'36 projection preserves cents');
select set_config('request.jwt.claim.sub','25000000-0000-4000-8000-000000000002',true);
select results_eq($$select opening_cash,projected_ending_cash from public.financial_monthly_projection('25000000-0000-4000-8000-000000000011','2026-11-01',1)$$,$$values(2500::numeric,2200::numeric)$$,'future reference carries intermediate October');
select throws_ok($$select * from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4)$$,'42501',null,'36 RLS/membership blocks another household');
select throws_ok($$select * from public.financial_monthly_projection('25000000-0000-4000-8000-000000000011','2026-08-01',1)$$,'22023',null,'historical reference is rejected');
reset role;
select set_config('request.jwt.claim.sub','25000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select is((select count(*) from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4)),4::bigint,'36 function returns at least four requested months');
select is((select count(*) from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-09-01',4) where projected_ending_cash<>opening_cash+expected_reliable_income_remaining-remaining_commitments_in_month-projected_recurring_commitments-prior_pending_outflow),0::bigint,'36 every projected ending closes mathematically without realized-flow duplication');

select is((select prior_pending_outflow from public.financial_monthly_projection('25000000-0000-4000-8000-000000000010','2026-10-01',2) where month_index=0),0::numeric,'prior pending is not charged again at future reference');

select * from finish();
rollback;
