begin;

set local time zone 'America/Sao_Paulo';

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
 ('9e000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ux-owner@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Owner Global"}',now(),now()),
 ('9e000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','ux-member@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Member Global"}',now(),now());

insert into public.households(id,name,financial_tracking_started_on,timezone)
values ('9e000000-0000-4000-8000-000000000010','Casa UX',current_date,'America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role) values
 ('9e000000-0000-4000-8000-000000000021','9e000000-0000-4000-8000-000000000010','9e000000-0000-4000-8000-000000000001','owner'),
 ('9e000000-0000-4000-8000-000000000022','9e000000-0000-4000-8000-000000000010','9e000000-0000-4000-8000-000000000002','member');

insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('9e000000-0000-4000-8000-000000000031','9e000000-0000-4000-8000-000000000010','9e000000-0000-4000-8000-000000000021','Conta UX','checking');

insert into public.account_ownerships(account_id,household_id,member_id) values
 ('9e000000-0000-4000-8000-000000000031','9e000000-0000-4000-8000-000000000010','9e000000-0000-4000-8000-000000000021');

set local role authenticated;
select set_config('request.jwt.claim.sub','9e000000-0000-4000-8000-000000000001',true);

select lives_ok($$
  select public.set_household_member_display_name(
    '9e000000-0000-4000-8000-000000000010',
    '9e000000-0000-4000-8000-000000000022',
    'Gui da Casa'
  )
$$,'O01 owner can set the household-local name of another member');

select is(
  (select display_name from public.household_members where id='9e000000-0000-4000-8000-000000000022'),
  'Gui da Casa',
  'O02 local member name is stored on household membership'
);

select lives_ok($$
  select public.create_income_fact(
    '9e000000-0000-4000-8000-000000000010','Renda sem categoria',900,current_date,
    null,'9e000000-0000-4000-8000-000000000021','9e000000-0000-4000-8000-000000000031',
    'salary','confirmed',null
  )
$$,'O03 canonical income can be created without category');

select is(
  (select category_id from public.transactions where household_id='9e000000-0000-4000-8000-000000000010' and description='Renda sem categoria'),
  null::uuid,
  'O04 income fact preserves an absent category'
);

select is(
  (select category_id from public.money_movements where household_id='9e000000-0000-4000-8000-000000000010' and description='Renda sem categoria'),
  null::uuid,
  'O05 projected cash leg also preserves an absent category'
);

select lives_ok($$
  select public.create_recurring_income_rule(
    '9e000000-0000-4000-8000-000000000010','Renda recorrente sem categoria',1200,current_date,null,
    'monthly',null,'9e000000-0000-4000-8000-000000000021','9e000000-0000-4000-8000-000000000031',
    'salary','confirmed',null
  )
$$,'O06 recurring income rule accepts no category');

select ok(
  exists(
    select 1 from public.recurring_occurrences o
    join public.transactions t on t.id=o.transaction_id
    where o.household_id='9e000000-0000-4000-8000-000000000010'
      and t.description='Renda recorrente sem categoria'
      and t.category_id is null
  ),
  'O07 recurring occurrence materializes with no category'
);

select set_config('request.jwt.claim.sub','9e000000-0000-4000-8000-000000000002',true);

select throws_ok($$
  select public.set_household_member_display_name(
    '9e000000-0000-4000-8000-000000000010',
    '9e000000-0000-4000-8000-000000000021',
    'Não autorizado'
  )
$$,'42501','only the household owner can rename another member','O08 member cannot rename another member');

select lives_ok($$
  select public.set_household_member_display_name(
    '9e000000-0000-4000-8000-000000000010',
    '9e000000-0000-4000-8000-000000000022',
    'Meu nome na Casa'
  )
$$,'O09 member can edit their own household-local name');

reset role;
select * from finish();
rollback;
