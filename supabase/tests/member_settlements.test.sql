begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('23000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-a@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Member A"}',now(),now()),
 ('23000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-b@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Member B"}',now(),now()),
 ('23000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Outsider"}',now(),now());
insert into public.households(id,name) values
 ('23000000-0000-4000-8000-000000000010','Settlement house'),
 ('23000000-0000-4000-8000-000000000011','Other house');
insert into public.household_members(id,household_id,profile_id,role) values
 ('23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000001','owner'),
 ('23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000002','member'),
 ('23000000-0000-4000-8000-000000000023','23000000-0000-4000-8000-000000000011','23000000-0000-4000-8000-000000000003','owner');
insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('23000000-0000-4000-8000-000000000031','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','A source','checking'),
 ('23000000-0000-4000-8000-000000000032','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','B destination','checking');
insert into public.account_ownerships(account_id,household_id,member_id) values
 ('23000000-0000-4000-8000-000000000031','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021'),
 ('23000000-0000-4000-8000-000000000032','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022');

insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date)
values
 ('23000000-0000-4000-8000-000000000051','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','expense','pending','confirmed','Origin A',500,500,500,0,current_date,date_trunc('month',current_date)::date),
 ('23000000-0000-4000-8000-000000000052','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','expense','pending','confirmed','Origin B',80,80,80,0,current_date,date_trunc('month',current_date)::date);

-- Preserve opposite gross origins: B owes A 500 while A owes B 80.
insert into public.member_settlement_events(id,household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,occurred_at,source_transaction_id)
values
 ('23000000-0000-4000-8000-000000000041','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',500,'realized','adjustment',current_date,now(),'23000000-0000-4000-8000-000000000051'),
 ('23000000-0000-4000-8000-000000000042','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000022',80,'realized','adjustment',current_date,now(),'23000000-0000-4000-8000-000000000052');

select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),500::numeric,'gross B to A is preserved');
select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000021'),80::numeric,'opposite gross A to B is preserved');
select is((select net_position from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),420::numeric,'net is informational only');
select throws_ok($$insert into public.member_settlement_events(household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date) values('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000021',1,'projected','adjustment',current_date)$$,'23514',null,'self-settlement is rejected');

select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.create_member_settlement_schedule('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',300,current_date+30,'schedule-1','future payment')$$,'schedule can be created');
select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),500::numeric,'schedule does not reduce realized debt');
select is((select scheduled_settlement_amount from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),300::numeric,'schedule is exposed separately');
select is((select public.create_member_settlement_schedule('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',300,current_date+30,'schedule-1','future payment')),(select id from public.member_settlement_schedules where idempotency_key='schedule-1'),'schedule retry is idempotent');
select throws_ok($$select public.create_member_settlement_schedule('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',301,current_date+30,'schedule-1','future payment')$$,'23505','idempotency key already used with different schedule data','idempotency conflict is strict');

select lives_ok($$select public.settle_member_position('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',200,'23000000-0000-4000-8000-000000000032','23000000-0000-4000-8000-000000000031')$$,'partial settlement succeeds');
select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),300::numeric,'partial settlement leaves 300');
select is((select count(*) from public.transactions),2::bigint,'settlement creates no income or expense transaction');
select is((select count(*) from public.money_movements where kind='member_settlement'),1::bigint,'settlement creates one neutral money movement');
select throws_ok($$select public.settle_member_position('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',301,'23000000-0000-4000-8000-000000000032','23000000-0000-4000-8000-000000000031')$$,'23514','settlement exceeds realized outstanding position','over-settlement is rejected');
select is((select count(*) from public.money_movements where kind='member_settlement'),1::bigint,'rejected over-settlement is atomic');

select lives_ok($$select public.cancel_member_settlement_schedule('23000000-0000-4000-8000-000000000010',(select id from public.member_settlement_schedules where idempotency_key='schedule-1'))$$,'schedule can be cancelled');
select is((select count(*) from public.member_settlement_schedules where idempotency_key='schedule-1'),1::bigint,'cancel preserves schedule history');
select is((select coalesce(scheduled_settlement_amount,0) from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),0::numeric,'cancelled schedule has no future impact');

select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.member_settlement_events where household_id='23000000-0000-4000-8000-000000000010'),0::bigint,'RLS hides another household ledger');

select * from finish();
rollback;
