begin;

set local time zone 'America/Sao_Paulo';

create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
 ('b2000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-r-wallace@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace PR R"}',now(),now()),
 ('b2000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-r-luiz@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Luiz PR R"}',now(),now());

insert into public.households(id,name,financial_tracking_started_on,timezone)
values ('b2000000-0000-4000-8000-000000000010','Casa PR R',current_date,'America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role) values
 ('b2000000-0000-4000-8000-000000000021','b2000000-0000-4000-8000-000000000010','b2000000-0000-4000-8000-000000000001','owner'),
 ('b2000000-0000-4000-8000-000000000022','b2000000-0000-4000-8000-000000000010','b2000000-0000-4000-8000-000000000002','member');

insert into public.categories(id,household_id,name,type)
values ('b2000000-0000-4000-8000-000000000026','b2000000-0000-4000-8000-000000000010','Casa','expense');

insert into public.accounts(id,household_id,owner_member_id,name,type)
values ('b2000000-0000-4000-8000-000000000031','b2000000-0000-4000-8000-000000000010','b2000000-0000-4000-8000-000000000021','Conta Wallace PR R','checking');

insert into public.account_ownerships(account_id,household_id,member_id)
values ('b2000000-0000-4000-8000-000000000031','b2000000-0000-4000-8000-000000000010','b2000000-0000-4000-8000-000000000021');

set local role authenticated;
select set_config('request.jwt.claim.sub','b2000000-0000-4000-8000-000000000001',true);
set local statement_timeout='8s';

select lives_ok($$
  select public.create_and_settle_direct_expense_idempotent(
    'b2000000-0000-4000-8000-000000000010','PR-R recurring source',100.00,current_date,
    'b2000000-0000-4000-8000-000000000026',
    'b2000000-0000-4000-8000-000000000021',
    'b2000000-0000-4000-8000-000000000031',
    'b2000000-0000-4000-8000-000000000021',
    '[{"member_id":"b2000000-0000-4000-8000-000000000021","amount":"50.00","percentage":"50.0000"},{"member_id":"b2000000-0000-4000-8000-000000000022","amount":"50.00","percentage":"50.0000"}]'::jsonb,
    now(),null,'pr-r-source'
  )
$$,'R01 shared direct expense completes within authenticated timeout');

select is(
  (select realized_outstanding
   from public.financial_member_settlement_positions
   where debtor_member_id='b2000000-0000-4000-8000-000000000022'
     and creditor_member_id='b2000000-0000-4000-8000-000000000021'),
  50.00::numeric,
  'R02 realized settlement remains 50 after Wallace funds a 50/50 expense'
);

select lives_ok($$
  select public.create_recurring_expense_rule_from_transaction_idempotent(
    'b2000000-0000-4000-8000-000000000010',
    (select id from public.transactions where description='PR-R recurring source' and type='expense'),
    'weekly',1,current_date+1,null,'pr-r-rule'
  )
$$,'R03 weekly recurrence rule is created');

select is(
  public.ensure_household_recurring_expense_horizon(
    'b2000000-0000-4000-8000-000000000010',
    (current_date+interval '1 year')::date
  ),
  (1 + (((current_date+interval '1 year')::date-(current_date+1))/7))::integer,
  'R04 one-year weekly horizon completes within authenticated timeout'
);

select is(
  (select count(*)::integer from public.recurring_occurrences where household_id='b2000000-0000-4000-8000-000000000010'),
  (1 + (((current_date+interval '1 year')::date-(current_date+1))/7))::integer,
  'R05 horizon materializes each weekly occurrence exactly once'
);

select is(
  (select count(*) from public.transactions t
   join public.recurring_occurrences o on o.transaction_id=t.id
   where o.household_id='b2000000-0000-4000-8000-000000000010'
     and t.economic_state='forecast' and t.realized_amount=0),
  (select count(*) from public.recurring_occurrences where household_id='b2000000-0000-4000-8000-000000000010'),
  'R06 future occurrences remain forecasts'
);

select is(
  (select count(*) from public.money_movements m
   join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id
   where o.household_id='b2000000-0000-4000-8000-000000000010'),
  0::bigint,
  'R07 horizon creates no cash movement'
);

select is(
  (select count(*) from public.funding_events f
   join public.recurring_occurrences o on o.transaction_id=f.financed_transaction_id
   where o.household_id='b2000000-0000-4000-8000-000000000010'),
  0::bigint,
  'R08 horizon creates no realized funding'
);

select is(
  (select projected_outstanding
   from public.financial_member_settlement_positions
   where debtor_member_id='b2000000-0000-4000-8000-000000000022'
     and creditor_member_id='b2000000-0000-4000-8000-000000000021'),
  (50 * (1 + (((current_date+interval '1 year')::date-(current_date+1))/7)))::numeric,
  'R09 each future 50/50 occurrence preserves its projected settlement'
);

select is(
  public.ensure_household_recurring_expense_horizon(
    'b2000000-0000-4000-8000-000000000010',
    (current_date+interval '1 year')::date
  ),
  0,
  'R10 replaying the same horizon is idempotent'
);

select is(
  (select count(*) from public.recurring_rules where household_id='b2000000-0000-4000-8000-000000000010'),
  1::bigint,
  'R11 exactly one recurring rule exists'
);

select is(
  (select count(*) from public.transactions where household_id='b2000000-0000-4000-8000-000000000010' and description='PR-R recurring source' and type='expense'),
  1::bigint,
  'R12 source expense remains one economic fact'
);

reset role;
select * from finish();
rollback;
