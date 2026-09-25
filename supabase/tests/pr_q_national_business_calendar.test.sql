begin;

set local time zone 'America/Sao_Paulo';

create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  'b1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','pr-q-calendar@example.invalid',crypt('test-only',gen_salt('bf')),now(),
  '{}','{"display_name":"Calendário PR Q"}',now(),now()
);

insert into public.households(id,name,timezone)
values ('b1000000-0000-4000-8000-000000000010','Casa PR Q','America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role)
values (
  'b1000000-0000-4000-8000-000000000021',
  'b1000000-0000-4000-8000-000000000010',
  'b1000000-0000-4000-8000-000000000001',
  'owner'
);

insert into public.accounts(id,household_id,owner_member_id,name,type)
values (
  'b1000000-0000-4000-8000-000000000031',
  'b1000000-0000-4000-8000-000000000010',
  'b1000000-0000-4000-8000-000000000021',
  'Conta PR Q',
  'checking'
);

insert into public.account_ownerships(account_id,household_id,member_id)
values (
  'b1000000-0000-4000-8000-000000000031',
  'b1000000-0000-4000-8000-000000000010',
  'b1000000-0000-4000-8000-000000000021'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);

select is(
  (select count(*)
     from public.brazil_national_holidays
    where holiday_date between date '2026-01-01' and date '2030-12-31'),
  45::bigint,
  'Q01 imports exactly the nine national holidays for each year from 2026 through 2030'
);

select ok(
  not exists(
    select 1 from public.brazil_national_holidays
     where holiday_date=date '2002-11-02'
  ),
  'Q02 does not retroactively classify Finados as a national holiday before Law 10.607/2002 took effect'
);

select is(
  (select legal_basis
     from public.brazil_national_holidays
    where holiday_date=date '2026-11-20'),
  'Lei nº 14.759/2023',
  'Q03 includes National Black Awareness Day with its federal legal basis'
);

select ok(
  not public.is_brazil_national_business_day(date '2026-09-07')
  and not public.is_brazil_national_business_day(date '2026-09-06')
  and public.is_brazil_national_business_day(date '2026-09-08'),
  'Q04 national holidays and weekends are non-business days while the following weekday is business'
);

select is(
  public.adjust_projected_business_date(date '2026-09-07','next'),
  date '2026-09-08',
  'Q05 projected expense on Independence Day moves to the next business day'
);

select is(
  public.adjust_projected_business_date(date '2026-09-07','previous'),
  date '2026-09-04',
  'Q06 projected income on Independence Day moves to the prior business day'
);

select throws_ok(
  $$select public.is_brazil_national_business_day(date '2031-01-01')$$,
  '22023',
  'Brazilian national calendar is configured from 2000 through 2030',
  'Q07 calendar refuses to silently project beyond its imported coverage'
);

select ok(
  not has_table_privilege('authenticated','public.brazil_national_holidays','INSERT')
  and not has_table_privilege('authenticated','public.brazil_national_holidays','UPDATE')
  and not has_table_privilege('authenticated','public.brazil_national_holidays','DELETE'),
  'Q08 authenticated users can read but cannot mutate the legal holiday reference'
);

select lives_ok($$
  select public.create_and_settle_direct_expense_idempotent(
    'b1000000-0000-4000-8000-000000000010',
    'PR-Q direct recurring template',
    100.00,
    date '2026-08-01',
    null,
    'b1000000-0000-4000-8000-000000000021',
    'b1000000-0000-4000-8000-000000000031',
    'b1000000-0000-4000-8000-000000000021',
    '[{"member_id":"b1000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    '2026-08-01T12:00:00Z'::timestamptz,
    null,
    'pr-q-direct-template'
  )
$$,'Q09 creates the direct-account template with the canonical command');

select lives_ok($$
  select public.create_recurring_expense_rule_from_transaction_idempotent(
    'b1000000-0000-4000-8000-000000000010',
    (select id from public.transactions
      where household_id='b1000000-0000-4000-8000-000000000010'
        and description='PR-Q direct recurring template'),
    'monthly',
    1,
    date '2026-09-07',
    date '2026-09-07',
    'pr-q-direct-rule'
  )
$$,'Q10 creates the direct recurring rule with Independence Day as its anchor');

select is(
  public.ensure_household_recurring_expense_horizon(
    'b1000000-0000-4000-8000-000000000010',
    date '2026-09-07'
  ),
  1,
  'Q11 materializes exactly one direct recurring occurrence'
);

select is(
  (select o.competence_date
     from public.recurring_occurrences o
     join public.transactions t on t.id=o.transaction_id
    where o.household_id='b1000000-0000-4000-8000-000000000010'
      and t.description='PR-Q direct recurring template'),
  date '2026-09-07',
  'Q12 direct recurrence preserves the economic anchor'
);

select is(
  (select t.transaction_date
     from public.transactions t
     join public.recurring_occurrences o on o.transaction_id=t.id
    where o.household_id='b1000000-0000-4000-8000-000000000010'
      and t.description='PR-Q direct recurring template'),
  date '2026-09-07',
  'Q13 direct recurrence does not rewrite the economic date'
);

select is(
  (select o.due_date
     from public.recurring_occurrences o
     join public.transactions t on t.id=o.transaction_id
    where o.household_id='b1000000-0000-4000-8000-000000000010'
      and t.description='PR-Q direct recurring template'),
  date '2026-09-08',
  'Q14 direct recurring commitment moves its planned settlement to the next business day'
);

select is(
  (select count(*)
     from public.money_movements m
     join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id
    where o.household_id='b1000000-0000-4000-8000-000000000010'),
  0::bigint,
  'Q15 business-day adjustment creates no cash movement for the direct forecast'
);

select is(
  (select count(*)
     from public.funding_events f
     join public.recurring_occurrences o on o.transaction_id=f.financed_transaction_id
    where o.household_id='b1000000-0000-4000-8000-000000000010'),
  0::bigint,
  'Q16 business-day adjustment creates no funding for the direct forecast'
);

select lives_ok($$
  select public.create_recurring_income_rule(
    'b1000000-0000-4000-8000-000000000010',
    'PR-Q recurring income',
    750.00,
    date '2026-09-07',
    date '2026-09-07',
    'monthly',
    null,
    'b1000000-0000-4000-8000-000000000021',
    'b1000000-0000-4000-8000-000000000031',
    'salary',
    'confirmed',
    null
  )
$$,'Q17 creates a recurring income rule through the canonical command');

select is(
  (select t.transaction_date
     from public.transactions t
     join public.recurring_occurrences o on o.transaction_id=t.id
    where o.household_id='b1000000-0000-4000-8000-000000000010'
      and t.description='PR-Q recurring income'),
  date '2026-09-07',
  'Q18 recurring income preserves its economic anchor'
);

select is(
  (select o.due_date
     from public.recurring_occurrences o
     join public.transactions t on t.id=o.transaction_id
    where o.household_id='b1000000-0000-4000-8000-000000000010'
      and t.description='PR-Q recurring income'),
  date '2026-09-04',
  'Q19 recurring income exposes its expected receipt on the previous business day'
);

select is(
  (select m.movement_date
     from public.money_movements m
     join public.transactions t on t.id=m.related_transaction_id
    where t.household_id='b1000000-0000-4000-8000-000000000010'
      and t.description='PR-Q recurring income'
      and m.kind='income'
      and m.state='projected'),
  date '2026-09-04',
  'Q20 calendar adjustment changes only the projected receipt date, not a realized cash fact'
);

reset role;
select * from finish();
rollback;
