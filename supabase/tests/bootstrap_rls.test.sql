begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wallace.test@example.invalid', crypt('test-only', gen_salt('bf')), now(), '{}', '{"display_name":"Wallace Test"}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'guilherme.test@example.invalid', crypt('test-only', gen_salt('bf')), now(), '{}', '{"display_name":"Guilherme Test"}', now(), now()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-8000-000000000000', 'authenticated', 'authenticated', 'third.test@example.invalid', crypt('test-only', gen_salt('bf')), now(), '{}', '{"display_name":"Third Test"}', now(), now());

select is((select count(*) from public.profiles where id in (
  '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003')), 3::bigint, 'auth signup creates the profiles');

create temporary table test_households (id uuid primary key, label text not null);
grant select, insert on table test_households to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
insert into test_households
select id, 'first' from public.bootstrap_household('Casa Teste A');

select is((select count(*) from public.households), 1::bigint, 'first household is visible to its creator');
select is((select role::text from public.household_members where profile_id = auth.uid()), 'owner', 'creator is associated as owner');
select ok(public.is_active_household_member((select id from test_households where label = 'first')), 'Wallace can access the first household');
select throws_ok(
  $$select public.bootstrap_household('Casa Invalida', 'BRL', 'Not/A_Timezone')$$,
  '22023', 'timezone must be a valid IANA time zone', 'bootstrap rejects an invalid time zone'
);
select is((select count(*) from public.households), 1::bigint, 'invalid bootstrap leaves no orphan household');

insert into public.household_members (household_id, profile_id, role)
values ((select id from test_households where label = 'first'), '10000000-0000-4000-8000-000000000002', 'member');
insert into public.accounts (household_id, name, type)
values ((select id from test_households where label = 'first'), 'Conta A', 'checking');
select is((select count(*) from public.accounts), 1::bigint, 'Wallace can access household financial data');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((select count(*) from public.households), 1::bigint, 'Guilherme can access the shared household');
select is((select count(*) from public.accounts), 1::bigint, 'Guilherme can access shared household financial data');
select throws_ok(
  $$insert into public.household_members (household_id, profile_id, role)
    values ((select id from test_households where label = 'first'), '10000000-0000-4000-8000-000000000003', 'member')$$,
  '42501', null, 'a non-owner cannot administer members'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is((select count(*) from public.households), 0::bigint, 'third user cannot see the first household');
select is((select count(*) from public.accounts), 0::bigint, 'third user cannot see first-house financial data');
insert into test_households
select id, 'second' from public.bootstrap_household('Casa Teste B');
insert into public.accounts (household_id, name, type)
values ((select id from test_households where label = 'second'), 'Conta B', 'checking');
select is((select count(*) from public.households), 1::bigint, 'third user sees only their own household');
select is((select count(*) from public.accounts), 1::bigint, 'second household is isolated from the first');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*) from public.households), 1::bigint, 'first household remains isolated from second household');
select is((select count(*) from public.accounts), 1::bigint, 'first user sees no second-house financial data');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select * from public.households$$,
  '42501', null, 'anonymous users cannot list households'
);
select throws_ok(
  $$select public.bootstrap_household('Casa Anonima')$$,
  '42501', null, 'anonymous users cannot call bootstrap'
);
select throws_ok(
  $$select * from public.accounts$$,
  '42501', null, 'anonymous users have no financial table privileges'
);

reset role;
select * from finish();
rollback;
