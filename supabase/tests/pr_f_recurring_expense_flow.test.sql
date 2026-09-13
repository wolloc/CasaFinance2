begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '7a000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','pr-f-recurring@example.invalid',crypt('test-only',gen_salt('bf')),now(),
  '{}','{"display_name":"Recorrência PR F"}',now(),now()
);

insert into public.households(id,name)
values ('7a000000-0000-4000-8000-000000000010','Casa PR F');

insert into public.household_members(id,household_id,profile_id,role)
values ('7a000000-0000-4000-8000-000000000021','7a000000-0000-4000-8000-000000000010','7a000000-0000-4000-8000-000000000001','owner');

insert into public.accounts(id,household_id,owner_member_id,name,type)
values ('7a000000-0000-4000-8000-000000000031','7a000000-0000-4000-8000-000000000010','7a000000-0000-4000-8000-000000000021','Conta PR F','checking');

insert into public.account_ownerships(account_id,household_id,member_id)
values ('7a000000-0000-4000-8000-000000000031','7a000000-0000-4000-8000-000000000010','7a000000-0000-4000-8000-000000000021');

set local role authenticated;
select set_config('request.jwt.claim.sub','7a000000-0000-4000-8000-000000000001',true);

select lives_ok($$
  select public.create_and_settle_direct_expense_idempotent(
    '7a000000-0000-4000-8000-000000000010','PR-F recurring source',100.00,current_date,null,
    '7a000000-0000-4000-8000-000000000021','7a000000-0000-4000-8000-000000000031','7a000000-0000-4000-8000-000000000021',
    '[{"member_id":"7a000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    (current_date::timestamp + time '12:00') at time zone 'UTC',null,'pr-f-source'
  )
$$,'F01 current expense is created through the canonical direct command');

select is(
  public.create_recurring_expense_rule_from_transaction_idempotent(
    '7a000000-0000-4000-8000-000000000010',
    (select id from public.transactions where description='PR-F recurring source'),
    'monthly',1,current_date+1,null,'pr-f-create-rule'
  ),
  public.create_recurring_expense_rule_from_transaction_idempotent(
    '7a000000-0000-4000-8000-000000000010',
    (select id from public.transactions where description='PR-F recurring source'),
    'monthly',1,current_date+1,null,'pr-f-create-rule'
  ),
  'F02 retrying the rule command returns the same rule'
);

select is((select count(*) from public.recurring_rules where household_id='7a000000-0000-4000-8000-000000000010'),1::bigint,'F03 retry creates one rule');

select is(
  public.ensure_household_recurring_expense_horizon('7a000000-0000-4000-8000-000000000010',(current_date+1+interval '2 months')::date),
  3,
  'F04 horizon creates three monthly occurrences'
);
select is(
  public.ensure_household_recurring_expense_horizon('7a000000-0000-4000-8000-000000000010',(current_date+1+interval '2 months')::date),
  0,
  'F05 replaying the horizon creates nothing'
);
select is((select count(*) from public.recurring_occurrences where household_id='7a000000-0000-4000-8000-000000000010'),3::bigint,'F06 exactly three occurrences exist');
select is((select count(*) from public.transactions where household_id='7a000000-0000-4000-8000-000000000010' and description='PR-F recurring source'),4::bigint,'F07 one source plus three occurrence transactions exist');
select is((select count(*) from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7a000000-0000-4000-8000-000000000010' and t.economic_state='forecast' and t.realized_amount=0),3::bigint,'F08 every generated occurrence starts as forecast, never realized');
select is((select count(*) from public.money_movements m join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),0::bigint,'F09 materialization invents no cash movement');
select is((select count(*) from public.funding_events f join public.recurring_occurrences o on o.transaction_id=f.financed_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),0::bigint,'F10 materialization invents no funding');
select is((select count(*) from public.financial_transaction_positions p join public.recurring_occurrences o on o.transaction_id=p.transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010' and p.economic_state='realized'),0::bigint,'F11 forecasts are absent from realized economic facts');

select is(
  public.confirm_recurring_expense_occurrence_idempotent(
    '7a000000-0000-4000-8000-000000000010',
    (select id from public.recurring_occurrences where household_id='7a000000-0000-4000-8000-000000000010' order by competence_date limit 1),
    110.00,'pr-f-confirm-first'
  ),
  public.confirm_recurring_expense_occurrence_idempotent(
    '7a000000-0000-4000-8000-000000000010',
    (select id from public.recurring_occurrences where household_id='7a000000-0000-4000-8000-000000000010' order by competence_date limit 1),
    110.00,'pr-f-confirm-first'
  ),
  'F12 confirmation retry returns the same adjustment event'
);
select is((select count(*) from public.transaction_adjustment_events e join public.recurring_occurrences o on o.transaction_id=e.source_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),1::bigint,'F13 confirmation is audited exactly once');
select results_eq($$select t.economic_state::text,t.confirmed_amount from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7a000000-0000-4000-8000-000000000010' order by o.competence_date limit 1$$,$$values('confirmed'::text,110.00::numeric)$$,'F14 confirmation replaces the estimate on this occurrence');
select is((select count(*) from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7a000000-0000-4000-8000-000000000010' and t.economic_state='forecast'),2::bigint,'F15 other occurrences remain forecasts');
select is((select count(*) from public.money_movements m join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),0::bigint,'F16 confirmation still creates no cash');
select is((select count(*) from public.funding_events f join public.recurring_occurrences o on o.transaction_id=f.financed_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),0::bigint,'F17 confirmation still creates no funding');

select is(
  public.settle_recurring_expense_occurrence_idempotent(
    '7a000000-0000-4000-8000-000000000010',
    (select id from public.recurring_occurrences where household_id='7a000000-0000-4000-8000-000000000010' order by competence_date limit 1),
    '7a000000-0000-4000-8000-000000000031','7a000000-0000-4000-8000-000000000021',60.00,now(),'pr-f-pay-60'
  ),
  public.settle_recurring_expense_occurrence_idempotent(
    '7a000000-0000-4000-8000-000000000010',
    (select id from public.recurring_occurrences where household_id='7a000000-0000-4000-8000-000000000010' order by competence_date limit 1),
    '7a000000-0000-4000-8000-000000000031','7a000000-0000-4000-8000-000000000021',60.00,now(),'pr-f-pay-60'
  ),
  'F18 partial payment retry returns the same movement'
);
select lives_ok($$
  select public.settle_recurring_expense_occurrence_idempotent(
    '7a000000-0000-4000-8000-000000000010',
    (select id from public.recurring_occurrences where household_id='7a000000-0000-4000-8000-000000000010' order by competence_date limit 1),
    '7a000000-0000-4000-8000-000000000031','7a000000-0000-4000-8000-000000000021',50.00,now(),'pr-f-pay-50'
  )
$$,'F19 remaining amount can be settled once');
select is((select count(*) from public.money_movements m join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),2::bigint,'F20 two real payment portions create two cash movements');
select is((select sum(m.amount) from public.money_movements m join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),110.00::numeric,'F21 cash closes in cents at the confirmed amount');
select is((select sum(f.amount) from public.funding_events f join public.recurring_occurrences o on o.transaction_id=f.financed_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),110.00::numeric,'F22 funding closes in cents at the confirmed amount');
select results_eq($$select t.economic_state::text,t.realized_amount,o.status::text from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7a000000-0000-4000-8000-000000000010' order by o.competence_date limit 1$$,$$values('realized'::text,110.00::numeric,'paid'::text)$$,'F23 paid occurrence becomes one realized fact');
select is((select count(*) from public.financial_transaction_positions p join public.recurring_occurrences o on o.transaction_id=p.transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010' and p.economic_state='realized'),1::bigint,'F24 only the paid occurrence enters realized economic facts');

reset role;
select * from finish();
rollback;
