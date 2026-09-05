begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('27000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','wallace-027@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace"}',now(),now()),
 ('27000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gui-027@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Gui"}',now(),now()),
 ('27000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outside-027@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Outside"}',now(),now());
insert into public.households(id,name) values
 ('27000000-0000-4000-8000-000000000010','Casa 027'),('27000000-0000-4000-8000-000000000011','Outside');
insert into public.household_members(id,household_id,profile_id,role) values
 ('27000000-0000-4000-8000-000000000021','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000001','owner'),
 ('27000000-0000-4000-8000-000000000022','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000002','member'),
 ('27000000-0000-4000-8000-000000000023','27000000-0000-4000-8000-000000000011','27000000-0000-4000-8000-000000000003','owner');
insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('27000000-0000-4000-8000-000000000031','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000021','Itau Wallace','checking'),
 ('27000000-0000-4000-8000-000000000032','27000000-0000-4000-8000-000000000010',null,'Joint','checking');
insert into public.account_ownerships(account_id,household_id,member_id) values
 ('27000000-0000-4000-8000-000000000031','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000021'),
 ('27000000-0000-4000-8000-000000000032','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000021'),
 ('27000000-0000-4000-8000-000000000032','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000022');
insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day,default_payment_account_id) values
 ('27000000-0000-4000-8000-000000000041','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000021','Empty',10000,2,9,null),
 ('27000000-0000-4000-8000-000000000042','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000021','Infinity',10000,2,9,'27000000-0000-4000-8000-000000000031'),
 ('27000000-0000-4000-8000-000000000043','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000021','Over',100,2,9,null);
select results_eq($$select total_exposure,available_limit,utilization_ratio from public.financial_card_exposure_positions where card_id='27000000-0000-4000-8000-000000000041'$$,$$values(0::numeric,10000::numeric,0::numeric)$$,'A/L: empty card has full available limit');

-- One economic TV expense; its monthly commitments are the only installment units.
insert into public.transactions(id,household_id,created_by_member_id,buyer_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date) values
 ('27000000-0000-4000-8000-000000000051','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000021','27000000-0000-4000-8000-000000000021','expense','pending','confirmed','TV',2400,2400,2400,0,current_date,date_trunc('month',current_date)::date);
insert into public.transaction_payment_instruments(id,household_id,transaction_id,kind,card_id) values
 ('27000000-0000-4000-8000-000000000052','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000051','card','27000000-0000-4000-8000-000000000042');
insert into public.economic_allocations(id,household_id,transaction_id,responsible_member_id,allocation_order,amount,percentage) values
 ('27000000-0000-4000-8000-000000000053','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000051','27000000-0000-4000-8000-000000000022',1,2400,100);
insert into public.installment_plans(id,household_id,purchase_transaction_id,installment_count,total_amount) values
 ('27000000-0000-4000-8000-000000000060','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000051',12,2400);
insert into public.installments(id,household_id,installment_plan_id,number,amount,competence_date,due_date)
select ('27000000-0000-4000-8000-'||lpad((60+n)::text,12,'0'))::uuid,'27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000060',n,200,
 (date_trunc('month',current_date)+((n-1)::text||' months')::interval)::date,(date_trunc('month',current_date)+((n-1)::text||' months')::interval+interval '8 days')::date from generate_series(1,12)n;
insert into public.card_invoices(id,household_id,card_id,competence_date,closing_date,due_date,total_amount) values
 ('27000000-0000-4000-8000-000000000080','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000042',date_trunc('month',current_date)::date,current_date,current_date+8,200);
update public.installments set invoice_id='27000000-0000-4000-8000-000000000080' where installment_plan_id='27000000-0000-4000-8000-000000000060' and number=1;

select results_eq($$select current_invoice_remaining,future_known_commitments,total_exposure,available_limit,utilization_ratio from public.financial_card_exposure_positions where card_id='27000000-0000-4000-8000-000000000042'$$,$$values(200::numeric,2200::numeric,2400::numeric,7600::numeric,.24::numeric)$$,'C/M: 12x200 exposes 2400 once, with 7600 available and 24 percent utilization');
select is((select count(*) from public.financial_card_commitment_positions where source_transaction_id='27000000-0000-4000-8000-000000000051'),12::bigint,'C: purchase, invoices and installments are not multiplied');
select results_eq($$select exposure_bucket,count(*),sum(remaining_amount) from public.financial_card_commitment_positions where source_transaction_id='27000000-0000-4000-8000-000000000051' group by exposure_bucket order by exposure_bucket$$,$$values ('current_invoice'::text,1::bigint,200::numeric),('future_uninvoiced'::text,11::bigint,2200::numeric)$$,'D: current and future installments are distinct buckets');
select is((select count(*) from public.financial_card_future_commitments where source_installment_id='27000000-0000-4000-8000-000000000061'),0::bigint,'E: materialized current invoice installment is not future');
select is((select financial_month from public.financial_card_commitment_positions where source_installment_id='27000000-0000-4000-8000-000000000062'),(date_trunc('month',current_date)+interval '1 month')::date,'T: financial month is inherited from canonical commitment');
select results_eq($$select owner_member_id,member_responsibility_exposure from public.financial_member_card_positions where card_id='27000000-0000-4000-8000-000000000042' and member_id='27000000-0000-4000-8000-000000000022'$$,$$values('27000000-0000-4000-8000-000000000021'::uuid,2400::numeric)$$,'H: Wallace owns instrument while Gui bears 2400 responsibility');
select is((select member_responsibility_exposure from public.financial_member_card_positions where card_id='27000000-0000-4000-8000-000000000042' and member_id='27000000-0000-4000-8000-000000000021'),0::numeric,'H: owner has zero invented economic responsibility');
select is((select credit_limit from public.financial_member_card_positions where card_id='27000000-0000-4000-8000-000000000042' and member_id='27000000-0000-4000-8000-000000000022'),10000::numeric,'H: member perspective reports, but does not divide, instrument limit');
select is((select default_payment_account_id from public.financial_card_exposure_positions where card_id='27000000-0000-4000-8000-000000000042'),'27000000-0000-4000-8000-000000000031'::uuid,'I: default account remains visible projection metadata');
select is((select count(*) from public.card_invoice_payments where invoice_id='27000000-0000-4000-8000-000000000080'),0::bigint,'I: default account is not payment evidence');
update public.cards set default_payment_account_id='27000000-0000-4000-8000-000000000032' where id='27000000-0000-4000-8000-000000000042';
select is((select total_exposure from public.financial_card_exposure_positions where card_id='27000000-0000-4000-8000-000000000042'),2400::numeric,'J/K: changing default to joint account does not change exposure');
select is((select member_responsibility_exposure from public.financial_member_card_positions where card_id='27000000-0000-4000-8000-000000000042' and member_id='27000000-0000-4000-8000-000000000022'),2400::numeric,'J/K: funding account ownership does not change responsibility');
update public.cards set default_payment_account_id=null where id='27000000-0000-4000-8000-000000000042';
select is((select total_exposure from public.financial_card_exposure_positions where card_id='27000000-0000-4000-8000-000000000042'),2400::numeric,'L: card without default retains exposure');

-- Payments update the invoice position only; they create no expense/commitment.
select set_config('request.jwt.claim.sub','27000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.pay_card_invoice('27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000080','27000000-0000-4000-8000-000000000031','27000000-0000-4000-8000-000000000021',100,now())$$,'F: partial invoice payment uses canonical command');
select results_eq($$select paid_amount,remaining_amount from public.financial_card_invoice_positions where invoice_id='27000000-0000-4000-8000-000000000080'$$,$$values(100::numeric,100::numeric)$$,'F: partial payment reduces invoice remaining');
select is((select count(*) from public.financial_commitment_positions where economic_type='invoice_payment'),0::bigint,'F/S: invoice payment creates no second expense commitment');
select lives_ok($$select public.pay_card_invoice('27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000080','27000000-0000-4000-8000-000000000031','27000000-0000-4000-8000-000000000021',100,now())$$,'G: full invoice payment uses canonical command');
select is((select remaining_amount from public.financial_card_invoice_positions where invoice_id='27000000-0000-4000-8000-000000000080'),0::numeric,'G: full payment zeroes invoice remaining');
select is((select count(*) from public.transactions where id='27000000-0000-4000-8000-000000000051' and type='expense' and amount=2400),1::bigint,'G/S: original economic expense remains exactly once');
reset role;

insert into public.card_invoices(id,household_id,card_id,competence_date,closing_date,due_date,total_amount) values
 ('27000000-0000-4000-8000-000000000081','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000043',date_trunc('month',current_date)::date,current_date,current_date+8,240);
insert into public.transactions(id,household_id,created_by_member_id,invoice_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date) values
 ('27000000-0000-4000-8000-000000000091','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000021','27000000-0000-4000-8000-000000000081','expense','pending','confirmed','One-time card purchase',240,240,240,0,current_date,date_trunc('month',current_date)::date);
insert into public.transaction_payment_instruments(id,household_id,transaction_id,kind,card_id) values
 ('27000000-0000-4000-8000-000000000092','27000000-0000-4000-8000-000000000010','27000000-0000-4000-8000-000000000091','card','27000000-0000-4000-8000-000000000043');
select results_eq($$select count(*),sum(remaining_amount) from public.financial_card_commitment_positions where source_transaction_id='27000000-0000-4000-8000-000000000091'$$,$$values(1::bigint,240::numeric)$$,'B: one-time open-invoice purchase has one commitment representation');
select results_eq($$select total_exposure,available_limit,over_limit_amount from public.financial_card_exposure_positions where card_id='27000000-0000-4000-8000-000000000043'$$,$$values(240::numeric,-140::numeric,140::numeric)$$,'N: over-limit exposure remains visible');

-- The current schema proves full installment reversal, not heuristic partial credit attribution.
update public.installments set status='refunded' where id='27000000-0000-4000-8000-000000000062';
select is((select total_exposure from public.financial_card_exposure_positions where card_id='27000000-0000-4000-8000-000000000042'),2000::numeric,'O: canonical refunded installment reduces exposure');
select is((select count(*) from public.financial_card_commitment_positions where source_installment_id='27000000-0000-4000-8000-000000000062'),0::bigint,'O: reversed unit is excluded without treating refund as income');
select is((select count(*) from public.financial_true_income_positions where description='TV'),0::bigint,'O: refund never becomes ordinary income');

select set_config('request.jwt.claim.sub','27000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select is((select count(*) from public.financial_card_exposure_positions where household_id='27000000-0000-4000-8000-000000000010'),0::bigint,'P: security-invoker view preserves household isolation');
select is((select count(*) from public.financial_member_card_positions where household_id='27000000-0000-4000-8000-000000000010'),0::bigint,'P: member card view preserves household isolation');
reset role;

select * from finish();
rollback;
