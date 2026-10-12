begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('25000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','third-party-funding@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Member"}',now(),now());

insert into public.households(id,name)
values ('25000000-0000-4000-8000-000000000010','Third-party funding test house');
insert into public.household_members(id,household_id,profile_id,role)
values ('25000000-0000-4000-8000-000000000021','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000001','owner');
insert into public.accounts(id,household_id,owner_member_id,name,type)
values ('25000000-0000-4000-8000-000000000030','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','Checking','checking');
insert into public.financial_parties(id,household_id,created_by_member_id,name)
values ('25000000-0000-4000-8000-000000000040','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','External party');

insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date)
values
 ('25000000-0000-4000-8000-000000000050','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','expense','pending','confirmed','Shared purchase',100,100,100,0,'2026-10-01','2026-10-01'),
 ('25000000-0000-4000-8000-000000000051','25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000021','adjustment','paid','realized','Funding transaction',40,40,40,40,'2026-10-12','2026-10-01');

insert into public.economic_allocations(household_id,transaction_id,responsible_member_id,allocation_order,amount,percentage)
values ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000050','25000000-0000-4000-8000-000000000021',1,50,50);
insert into public.economic_allocations(household_id,transaction_id,responsible_party_id,allocation_order,amount,percentage)
values ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000050','25000000-0000-4000-8000-000000000040',2,50,50);

select is((select count(*) from public.financial_obligations where source_transaction_id='25000000-0000-4000-8000-000000000050' and kind='receivable'),0::bigint,'allocation alone does not create a receivable');

insert into public.funding_events(household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,amount,funded_at)
values ('25000000-0000-4000-8000-000000000010','25000000-0000-4000-8000-000000000050','25000000-0000-4000-8000-000000000051','25000000-0000-4000-8000-000000000021','25000000-0000-4000-8000-000000000030',40,'2026-10-12T12:00:00Z');

select is((select count(*) from public.third_party_commitment_receivables where funding_event_id=(select id from public.funding_events where funding_transaction_id='25000000-0000-4000-8000-000000000051')),1::bigint,'real funding creates one receivable tranche for the third-party allocation');
select is((select original_amount from public.financial_obligations where source_transaction_id='25000000-0000-4000-8000-000000000050' and kind='receivable'),20::numeric,'receivable equals only the funded amount multiplied by third-party responsibility');
select is((select sum(funded_responsibility_amount) from public.third_party_commitment_receivables where funding_event_id=(select id from public.funding_events where funding_transaction_id='25000000-0000-4000-8000-000000000051')),20::numeric,'receivable mapping preserves the funded third-party share');

select * from finish();
rollback;
