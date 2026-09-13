begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '7b000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','pr-g-recurring@example.invalid',crypt('test-only',gen_salt('bf')),now(),
  '{}','{"display_name":"Recorrência PR G"}',now(),now()
);

insert into public.households(id,name)
values ('7b000000-0000-4000-8000-000000000010','Casa PR G');

insert into public.household_members(id,household_id,profile_id,role)
values ('7b000000-0000-4000-8000-000000000021','7b000000-0000-4000-8000-000000000010','7b000000-0000-4000-8000-000000000001','owner');

insert into public.accounts(id,household_id,owner_member_id,name,type)
values ('7b000000-0000-4000-8000-000000000031','7b000000-0000-4000-8000-000000000010','7b000000-0000-4000-8000-000000000021','Conta PR G','checking');

insert into public.account_ownerships(account_id,household_id,member_id)
values ('7b000000-0000-4000-8000-000000000031','7b000000-0000-4000-8000-000000000010','7b000000-0000-4000-8000-000000000021');

set local role authenticated;
select set_config('request.jwt.claim.sub','7b000000-0000-4000-8000-000000000001',true);

select lives_ok($$
  select public.create_and_settle_direct_expense_idempotent(
    '7b000000-0000-4000-8000-000000000010','PR-G monthly source',100.00,'2023-12-01',null,
    '7b000000-0000-4000-8000-000000000021','7b000000-0000-4000-8000-000000000031','7b000000-0000-4000-8000-000000000021',
    '[{"member_id":"7b000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    '2023-12-01T12:00:00Z'::timestamptz,null,'pr-g-source'
  )
$$,'G01 source expense is created through the canonical direct command');

select lives_ok($$
  select public.create_recurring_expense_rule_from_transaction_idempotent(
    '7b000000-0000-4000-8000-000000000010',
    (select id from public.transactions where household_id='7b000000-0000-4000-8000-000000000010' and description='PR-G monthly source' order by created_at limit 1),
    'monthly',1,'2024-01-31',null,'pr-g-rule'
  )
$$,'G02 monthly recurrence can use day 31 as its anchor');

select is(
  public.ensure_household_recurring_expense_horizon('7b000000-0000-4000-8000-000000000010','2024-03-31'),
  3,
  'G03 first horizon materializes January through March'
);

select is(
  (select string_agg(to_char(competence_date,'YYYY-MM-DD'),',' order by competence_date)
   from public.recurring_occurrences
   where household_id='7b000000-0000-4000-8000-000000000010'),
  '2024-01-31,2024-02-29,2024-03-31',
  'G04 February falls back to leap-year month end and March returns to day 31'
);

select is(
  (select count(*) from public.recurring_occurrences where household_id='7b000000-0000-4000-8000-000000000010'),
  3::bigint,
  'G05 first horizon contains exactly three occurrences'
);

select is(
  public.ensure_household_recurring_expense_horizon('7b000000-0000-4000-8000-000000000010','2024-05-31'),
  2,
  'G06 extending the horizon adds only the missing future occurrences'
);

select is(
  (select string_agg(to_char(competence_date,'YYYY-MM-DD'),',' order by competence_date)
   from public.recurring_occurrences
   where household_id='7b000000-0000-4000-8000-000000000010'),
  '2024-01-31,2024-02-29,2024-03-31,2024-04-30,2024-05-31',
  'G07 month-end fallback never shifts the original day-31 anchor'
);

select is(
  (select count(*) from public.recurring_occurrences where household_id='7b000000-0000-4000-8000-000000000010'),
  5::bigint,
  'G08 rolling horizon contains exactly five unique occurrences'
);

select is(
  public.ensure_household_recurring_expense_horizon('7b000000-0000-4000-8000-000000000010','2024-05-31'),
  0,
  'G09 replaying the same horizon is idempotent'
);

select is(
  (select count(*) from public.transactions t
   join public.recurring_occurrences o on o.transaction_id=t.id
   where o.household_id='7b000000-0000-4000-8000-000000000010'
     and t.economic_state='forecast' and t.realized_amount=0),
  5::bigint,
  'G10 every materialized future occurrence remains forecast and unrealized'
);

select is(
  (select count(*) from public.money_movements m
   join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id
   where o.household_id='7b000000-0000-4000-8000-000000000010'),
  0::bigint,
  'G11 extending the horizon invents no cash movement'
);

select is(
  (select count(*) from public.funding_events f
   join public.recurring_occurrences o on o.transaction_id=f.financed_transaction_id
   where o.household_id='7b000000-0000-4000-8000-000000000010'),
  0::bigint,
  'G12 extending the horizon invents no funding'
);

select is(
  (select count(*) from public.transactions
   where household_id='7b000000-0000-4000-8000-000000000010' and type='expense'),
  6::bigint,
  'G13 there is one realized source plus five projected occurrence facts, with no duplicate extras'
);

reset role;
select * from finish();
rollback;
