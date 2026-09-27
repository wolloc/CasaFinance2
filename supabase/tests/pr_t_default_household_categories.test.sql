begin;

set local time zone 'America/Sao_Paulo';

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
 ('aa000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','defaults-a@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Owner A"}',now(),now()),
 ('aa000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','defaults-b@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Owner B"}',now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);

select lives_ok(
  $$select public.bootstrap_household('Casa Categorias A','BRL','America/Sao_Paulo')$$,
  'T01 legacy bootstrap creates a household with category suggestions'
);

select is(
  (select count(*)::integer from public.categories c
   join public.household_members hm on hm.household_id=c.household_id
   where hm.profile_id='aa000000-0000-4000-8000-000000000001' and c.type='expense'),
  12,
  'T02 new household starts with 12 expense suggestions'
);

select is(
  (select count(*)::integer from public.categories c
   join public.household_members hm on hm.household_id=c.household_id
   where hm.profile_id='aa000000-0000-4000-8000-000000000001' and c.type='income'),
  8,
  'T03 new household starts with 8 income suggestions'
);

select ok(
  exists(
    select 1 from public.categories c
    join public.household_members hm on hm.household_id=c.household_id
    where hm.profile_id='aa000000-0000-4000-8000-000000000001'
      and c.type='expense' and c.name='Mercado' and c.icon='shopping-basket'
  ),
  'T04 expense suggestion includes editable visual metadata'
);

select ok(
  exists(
    select 1 from public.categories c
    join public.household_members hm on hm.household_id=c.household_id
    where hm.profile_id='aa000000-0000-4000-8000-000000000001'
      and c.type='income' and c.name='Salário' and c.icon='briefcase-business'
  ),
  'T05 income suggestion includes editable visual metadata'
);

select is(
  (select count(*)::integer from public.transactions t
   join public.household_members hm on hm.household_id=t.household_id
   where hm.profile_id='aa000000-0000-4000-8000-000000000001'),
  0,
  'T06 category seeding creates no financial facts'
);

select lives_ok($$
  update public.categories
  set name='Supermercado', updated_at=now()
  where household_id=(
    select household_id from public.household_members
    where profile_id='aa000000-0000-4000-8000-000000000001' and deactivated_at is null
    limit 1
  ) and type='expense' and name='Mercado'
$$,'T07 default categories remain user-editable');

select ok(
  exists(
    select 1 from public.categories c
    join public.household_members hm on hm.household_id=c.household_id
    where hm.profile_id='aa000000-0000-4000-8000-000000000001'
      and c.type='expense' and c.name='Supermercado'
  ),
  'T08 edited suggestion keeps the household customization'
);

select set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000002',true);

select lives_ok(
  $$select public.bootstrap_household_with_profile('Casa Categorias B','Owner B','BRL','America/Sao_Paulo')$$,
  'T09 current onboarding bootstrap also creates the suggestions'
);

select is(
  (select count(*)::integer from public.categories c
   join public.household_members hm on hm.household_id=c.household_id
   where hm.profile_id='aa000000-0000-4000-8000-000000000002'),
  20,
  'T10 current onboarding receives exactly the compact default set'
);

reset role;
select * from finish();
rollback;
