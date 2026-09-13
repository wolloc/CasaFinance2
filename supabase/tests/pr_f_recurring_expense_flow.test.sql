begin;

create extension if not exists pgtap with schema extensions;
select plan(32);

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
values
  ('7a000000-0000-4000-8000-000000000031','7a000000-0000-4000-8000-000000000010','7a000000-0000-4000-8000-000000000021','Conta PR F','checking'),
  ('7a000000-0000-4000-8000-000000000032','7a000000-0000-4000-8000-000000000010','7a000000-0000-4000-8000-000000000021','VA PR F','meal_benefit');

insert into public.account_ownerships(account_id,household_id,member_id)
values
  ('7a000000-0000-4000-8000-000000000031','7a000000-0000-4000-8000-000000000010','7a000000-0000-4000-8000-000000000021'),
  ('7a000000-0000-4000-8000-000000000032','7a000000-0000-4000-8000-000000000010','7a000000-0000-4000-8000-000000000021');

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
select throws_ok($$
  select public.correct_unrealized_transaction(
    '7a000000-0000-4000-8000-000000000010',
    (select transaction_id from public.recurring_occurrences where household_id='7a000000-0000-4000-8000-000000000010' order by competence_date limit 1),
    'generic mutation must fail',100.00,current_date+1,current_date+1,null,
    'generic correction attempt','pr-f-generic-correction'
  )
$$,'0A000','materialized recurring occurrence requires the dedicated recurrence correction flow','F12 generic transaction correction remains blocked');

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
  'F13 confirmation retry returns the same adjustment event'
);
select is((select count(*) from public.transaction_adjustment_events e join public.recurring_occurrences o on o.transaction_id=e.source_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),1::bigint,'F14 confirmation is audited exactly once');
select is((select t.economic_state::text from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7a000000-0000-4000-8000-000000000010' order by o.competence_date limit 1),'confirmed'::text,'F15 confirmed occurrence remains distinguishable from realized');
select is((select t.confirmed_amount from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7a000000-0000-4000-8000-000000000010' order by o.competence_date limit 1),110.00::numeric,'F15b confirmation replaces the estimate on this occurrence');
select is((select count(*) from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7a000000-0000-4000-8000-000000000010' and t.economic_state='forecast'),2::bigint,'F16 other occurrences remain forecasts');
select is((select count(*) from public.money_movements m join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),0::bigint,'F17 confirmation still creates no cash');
select is((select count(*) from public.funding_events f join public.recurring_occurrences o on o.transaction_id=f.financed_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),0::bigint,'F18 confirmation still creates no funding');

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
  'F19 partial payment retry returns the same movement'
);
select lives_ok($$
  select public.settle_recurring_expense_occurrence_idempotent(
    '7a000000-0000-4000-8000-000000000010',
    (select id from public.recurring_occurrences where household_id='7a000000-0000-4000-8000-000000000010' order by competence_date limit 1),
    '7a000000-0000-4000-8000-000000000031','7a000000-0000-4000-8000-000000000021',50.00,now(),'pr-f-pay-50'
  )
$$,'F20 remaining amount can be settled once');
select is((select count(*) from public.money_movements m join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),2::bigint,'F21 two real payment portions create two cash movements');
select is((select sum(m.amount) from public.money_movements m join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),110.00::numeric,'F22 cash closes in cents at the confirmed amount');
select is((select sum(f.amount) from public.funding_events f join public.recurring_occurrences o on o.transaction_id=f.financed_transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010'),110.00::numeric,'F23 funding closes in cents at the confirmed amount');
select is((select t.economic_state::text from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7a000000-0000-4000-8000-000000000010' order by o.competence_date limit 1),'realized'::text,'F24 paid occurrence becomes realized');
select is((select t.realized_amount from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7a000000-0000-4000-8000-000000000010' order by o.competence_date limit 1),110.00::numeric,'F24b paid occurrence realizes the confirmed amount exactly');
select is((select o.status::text from public.recurring_occurrences o where o.household_id='7a000000-0000-4000-8000-000000000010' order by o.competence_date limit 1),'paid'::text,'F24c occurrence status closes as paid');
select is((select count(*) from public.financial_transaction_positions p join public.recurring_occurrences o on o.transaction_id=p.transaction_id where o.household_id='7a000000-0000-4000-8000-000000000010' and p.economic_state='realized'),1::bigint,'F25 only the paid occurrence enters realized economic facts');
select is((select count(*) from public.transactions where household_id='7a000000-0000-4000-8000-000000000010' and type='expense' and deleted_at is null),4::bigint,'F26 settlement creates no additional unlinked economic expense');

select lives_ok($$
  select public.create_and_settle_direct_expense_idempotent(
    '7a000000-0000-4000-8000-000000000010','PR-F benefit expense',25.00,current_date,null,
    '7a000000-0000-4000-8000-000000000021','7a000000-0000-4000-8000-000000000032','7a000000-0000-4000-8000-000000000021',
    '[{"member_id":"7a000000-0000-4000-8000-000000000021","amount":"25.00","percentage":"100.0000"}]'::jsonb,
    (current_date::timestamp + time '13:00') at time zone 'UTC',null,'pr-f-benefit-source'
  )
$$,'F27 benefit expense itself remains a valid realized expense');
select throws_ok($$
  select public.create_recurring_expense_rule_from_transaction_idempotent(
    '7a000000-0000-4000-8000-000000000010',
    (select id from public.transactions where description='PR-F benefit expense'),
    'monthly',1,current_date+1,null,'pr-f-benefit-rule'
  )
$$,'0A000','benefit expenses cannot become recurring series','F28 benefit expense cannot activate recurrence');
select is((select count(*) from public.recurring_rules rr join public.transactions t on t.id=rr.template_transaction_id where rr.household_id='7a000000-0000-4000-8000-000000000010' and t.description='PR-F benefit expense'),0::bigint,'F29 rejected benefit recurrence creates no rule');
select is((select count(*) from public.transactions where household_id='7a000000-0000-4000-8000-000000000010' and type='expense' and description='PR-F benefit expense'),1::bigint,'F30 rejected recurrence does not duplicate the benefit expense');
select is((select count(*) from public.money_movements where household_id='7a000000-0000-4000-8000-000000000010' and related_transaction_id=(select id from public.transactions where description='PR-F benefit expense')),1::bigint,'F31 benefit expense keeps exactly one cash movement');
select is((select count(*) from public.funding_events where household_id='7a000000-0000-4000-8000-000000000010' and financed_transaction_id=(select id from public.transactions where description='PR-F benefit expense')),1::bigint,'F32 benefit expense keeps exactly one funding event');

reset role;
select * from finish();
rollback;
