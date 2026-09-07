begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('31000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','wallace-marco3@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace"}',now(),now()),
  ('31000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','guilherme-marco3@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Guilherme"}',now(),now()),
  ('31000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','third-marco3@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Terceiro"}',now(),now());

select is((select count(*) from public.profiles where id::text like '31000000-0000-4000-8000-00000000000%'),3::bigint,'auth users create three profiles');

insert into public.households(id,name) values
  ('31000000-0000-4000-8000-000000000010','Casa Wallace e Guilherme'),
  ('31000000-0000-4000-8000-000000000011','Casa Terceira');
insert into public.household_members(id,household_id,profile_id,role) values
  ('31000000-0000-4000-8000-000000000021','31000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000001','owner'),
  ('31000000-0000-4000-8000-000000000022','31000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000002','member'),
  ('31000000-0000-4000-8000-000000000023','31000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000003','owner');
insert into public.accounts(id,household_id,name,type) values
  ('31000000-0000-4000-8000-000000000031','31000000-0000-4000-8000-000000000010','Conta Casa A','checking'),
  ('31000000-0000-4000-8000-000000000032','31000000-0000-4000-8000-000000000011','Conta Casa B','checking');

select ok(has_table_privilege('authenticated','public.external_payment_events','SELECT'),'authenticated may read external payment facts through RLS');
select ok(not has_table_privilege('authenticated','public.external_payment_events','INSERT'),'authenticated cannot insert external payment facts directly');
select ok(not has_table_privilege('authenticated','public.external_payment_events','UPDATE'),'authenticated cannot update external payment facts directly');
select ok(not has_table_privilege('authenticated','public.external_payment_events','DELETE'),'authenticated cannot delete external payment facts directly');

set local role authenticated;
select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.households),1::bigint,'Wallace sees one household');
select is((select count(*) from public.accounts),1::bigint,'Wallace sees one household account');
select is((select count(*) from public.households where id='31000000-0000-4000-8000-000000000011'),0::bigint,'Wallace cannot see the other household');
select is((select count(*) from public.accounts where id='31000000-0000-4000-8000-000000000032'),0::bigint,'Wallace cannot see the other household account');

select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.households),1::bigint,'Guilherme sees the shared household');
select is((select count(*) from public.accounts),1::bigint,'Guilherme sees shared household financial data');
update public.household_members set role='viewer'
 where household_id='31000000-0000-4000-8000-000000000010'
   and profile_id='31000000-0000-4000-8000-000000000001';
select is((select role::text from public.household_members where profile_id='31000000-0000-4000-8000-000000000001'),'owner','non-owner cannot change household roles');

select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.households),1::bigint,'third user sees one household');
select is((select count(*) from public.households where id='31000000-0000-4000-8000-000000000010'),0::bigint,'third user cannot see Wallace and Guilherme household');
select is((select count(*) from public.accounts where id='31000000-0000-4000-8000-000000000031'),0::bigint,'third user cannot see Wallace and Guilherme account');
select is((select count(*) from public.households where id='31000000-0000-4000-8000-000000000011'),1::bigint,'third user sees only own household');

select set_config('request.jwt.claim.sub','31000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.households where id='31000000-0000-4000-8000-000000000011'),0::bigint,'Wallace remains isolated from third household after identity switches');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select * from public.households$$,'42501',null,'anonymous cannot list households');
select throws_ok($$select * from public.accounts$$,'42501',null,'anonymous cannot list financial accounts');
select throws_ok($$select public.bootstrap_household('Casa Anônima')$$,'42501',null,'anonymous cannot bootstrap a household');

reset role;
select * from finish();
rollback;
