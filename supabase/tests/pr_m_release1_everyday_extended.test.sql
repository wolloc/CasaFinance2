begin;

set local time zone 'America/Sao_Paulo';

create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
 ('9c000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','release2-wallace@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace Release 2"}',now(),now()),
 ('9c000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','release2-gui@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Gui Release 2"}',now(),now());

insert into public.households(id,name,financial_tracking_started_on,timezone)
values ('9c000000-0000-4000-8000-000000000010','Casa Release 2',current_date,'America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role) values
 ('9c000000-0000-4000-8000-000000000021','9c000000-0000-4000-8000-000000000010','9c000000-0000-4000-8000-000000000001','owner'),
 ('9c000000-0000-4000-8000-000000000022','9c000000-0000-4000-8000-000000000010','9c000000-0000-4000-8000-000000000002','member');

insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('9c000000-0000-4000-8000-000000000031','9c000000-0000-4000-8000-000000000010','9c000000-0000-4000-8000-000000000021','Conta Wallace','checking'),
 ('9c000000-0000-4000-8000-000000000032','9c000000-0000-4000-8000-000000000010','9c000000-0000-4000-8000-000000000021','VA Wallace','meal_benefit');

insert into public.account_ownerships(account_id,household_id,member_id) values
 ('9c000000-0000-4000-8000-000000000031','9c000000-0000-4000-8000-000000000010','9c000000-0000-4000-8000-000000000021'),
 ('9c000000-0000-4000-8000-000000000032','9c000000-0000-4000-8000-000000000010','9c000000-0000-4000-8000-000000000021');

insert into public.financial_parties(id,household_id,kind,name,created_by_member_id)
values ('9c000000-0000-4000-8000-000000000041','9c000000-0000-4000-8000-000000000010','person','Terceiro Release','9c000000-0000-4000-8000-000000000021');

set local role authenticated;
select set_config('request.jwt.claim.sub','9c000000-0000-4000-8000-000000000001',true);

select lives_ok($$
  select public.create_and_settle_direct_expense_idempotent(
    '9c000000-0000-4000-8000-000000000010','Academia recorrente',100,current_date,null,
    '9c000000-0000-4000-8000-000000000021','9c000000-0000-4000-8000-000000000031','9c000000-0000-4000-8000-000000000021',
    '[{"member_id":"9c000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    now(),null,'release2-source'
  )
$$,'M01 recurring source expense can be created and settled');

select lives_ok($$
  select public.create_recurring_expense_rule_from_transaction_idempotent(
    '9c000000-0000-4000-8000-000000000010',
    (select id from public.transactions where description='Academia recorrente'),
    'monthly',1,current_date+1,null,'release2-rule'
  )
$$,'M02 recurring rule can be created');

select is((select count(*) from public.recurring_rules where household_id='9c000000-0000-4000-8000-000000000010' and deactivated_at is null),1::bigint,'M03 one active recurring rule exists');

select is(
  public.ensure_household_recurring_expense_horizon('9c000000-0000-4000-8000-000000000010',(current_date+1+interval '1 month')::date),
  2,
  'M04 horizon creates exactly two monthly occurrences'
);

select is((select count(*) from public.recurring_occurrences where household_id='9c000000-0000-4000-8000-000000000010'),2::bigint,'M05 two recurring occurrences exist');
select is((select count(*) from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='9c000000-0000-4000-8000-000000000010' and t.economic_state='forecast'),2::bigint,'M06 future recurrence stays forecast');
select is((select count(*) from public.money_movements m join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id where o.household_id='9c000000-0000-4000-8000-000000000010'),0::bigint,'M07 recurrence forecast invents no cash');
select is((select count(*) from public.funding_events f join public.recurring_occurrences o on o.transaction_id=f.financed_transaction_id where o.household_id='9c000000-0000-4000-8000-000000000010'),0::bigint,'M08 recurrence forecast invents no funding');

select lives_ok($$
  select public.confirm_recurring_expense_occurrence_idempotent(
    '9c000000-0000-4000-8000-000000000010',
    (select id from public.recurring_occurrences where household_id='9c000000-0000-4000-8000-000000000010' order by competence_date limit 1),
    110,'release2-confirm-first'
  )
$$,'M09 one recurring occurrence can be confirmed');

select is((select t.confirmed_amount from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='9c000000-0000-4000-8000-000000000010' order by o.competence_date limit 1),110::numeric,'M10 confirmed recurrence keeps the corrected amount');

select lives_ok($$
  select public.settle_recurring_expense_occurrence_idempotent(
    '9c000000-0000-4000-8000-000000000010',
    (select id from public.recurring_occurrences where household_id='9c000000-0000-4000-8000-000000000010' order by competence_date limit 1),
    '9c000000-0000-4000-8000-000000000031','9c000000-0000-4000-8000-000000000021',110,now(),'release2-settle-first'
  )
$$,'M11 confirmed recurrence can be realized once');

select is((select t.realized_amount from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='9c000000-0000-4000-8000-000000000010' order by o.competence_date limit 1),110::numeric,'M12 realized recurrence closes at confirmed amount');
select is((select coalesce(sum(m.amount),0) from public.money_movements m join public.recurring_occurrences o on o.transaction_id=m.related_transaction_id where o.household_id='9c000000-0000-4000-8000-000000000010'),110::numeric,'M13 recurrence cash closes once');

select lives_ok($$
  select public.revise_recurring_expense_rule_idempotent(
    '9c000000-0000-4000-8000-000000000010',
    (select id from public.recurring_rules where household_id='9c000000-0000-4000-8000-000000000010' and deactivated_at is null limit 1),
    (current_date+interval '2 months')::date,120,'monthly',1,null,'Ajuste de valor futuro','release2-revise-rule'
  )
$$,'M14 future recurring series can be corrected prospectively');

select is((select count(*) from public.recurring_expense_series_events where household_id='9c000000-0000-4000-8000-000000000010' and kind='revision'),1::bigint,'M15 recurrence correction is audited once');

select lives_ok($$
  select public.create_and_settle_direct_expense_idempotent(
    '9c000000-0000-4000-8000-000000000010','Almoço no benefício',25,current_date,null,
    '9c000000-0000-4000-8000-000000000021','9c000000-0000-4000-8000-000000000032','9c000000-0000-4000-8000-000000000021',
    '[{"member_id":"9c000000-0000-4000-8000-000000000021","amount":"25.00","percentage":"100.0000"}]'::jsonb,
    now(),null,'release2-benefit'
  )
$$,'M16 benefit expense is a realized expense');

select is((select count(*) from public.money_movements m join public.transactions t on t.id=m.related_transaction_id where t.description='Almoço no benefício'),1::bigint,'M17 benefit use creates one resource movement');
select is((select count(*) from public.funding_events f join public.transactions t on t.id=f.financed_transaction_id where t.description='Almoço no benefício'),1::bigint,'M18 benefit use creates one funding fact');

select throws_ok($$
  select public.create_recurring_expense_rule_from_transaction_idempotent(
    '9c000000-0000-4000-8000-000000000010',
    (select id from public.transactions where description='Almoço no benefício'),
    'monthly',1,current_date+1,null,'release2-benefit-rule'
  )
$$,'0A000','benefit expenses cannot become recurring series','M19 benefit expense does not create an unsafe recurring rule');

select lives_ok($$
  select public.create_externally_paid_expense(
    '9c000000-0000-4000-8000-000000000010','Presente pago por terceiro',80,current_date,null,
    '9c000000-0000-4000-8000-000000000021',
    '[{"member_id":"9c000000-0000-4000-8000-000000000021","amount":"40.00","percentage":"50.0000"},{"member_id":"9c000000-0000-4000-8000-000000000022","amount":"40.00","percentage":"50.0000"}]'::jsonb,
    '9c000000-0000-4000-8000-000000000041',false,null,null,'release2-external-gift'
  )
$$,'M20 third party can pay without inventing Casa cash');

select is((select coalesce(sum(e.amount),0) from public.external_payment_events e join public.transactions t on t.id=e.source_transaction_id where t.description='Presente pago por terceiro'),80::numeric,'M21 external payer funding preserves gross amount');
select is((select count(*) from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='Presente pago por terceiro' and o.kind='payable'),0::bigint,'M22 non-repayable external payment creates no payable');
select is((select count(*) from public.money_movements m join public.transactions t on t.id=m.related_transaction_id where t.description='Presente pago por terceiro'),0::bigint,'M23 external payment invents no Casa cash movement');

select lives_ok($$
  select public.create_externally_paid_expense_with_repayment_plan(
    '9c000000-0000-4000-8000-000000000010','Compra para devolver',100,current_date,null,
    '9c000000-0000-4000-8000-000000000021',
    '[{"member_id":"9c000000-0000-4000-8000-000000000021","amount":"50.00","percentage":"50.0000"},{"member_id":"9c000000-0000-4000-8000-000000000022","amount":"50.00","percentage":"50.0000"}]'::jsonb,
    '9c000000-0000-4000-8000-000000000041','installments',2,current_date,
    '9c000000-0000-4000-8000-000000000031',null,'release2-external-repay'
  )
$$,'M24 external payer reimbursement plan can be created');

select is((select original_amount from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='Compra para devolver' and o.kind='payable'),100::numeric,'M25 repayable third-party payment creates exactly the members payable');

select is((select count(*) from public.obligation_repayment_schedule_items s join public.financial_obligations o on o.id=s.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='Compra para devolver'),2::bigint,'M26 repayment schedule has two installments');
select is((select coalesce(sum(s.amount),0) from public.obligation_repayment_schedule_items s join public.financial_obligations o on o.id=s.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='Compra para devolver'),100::numeric,'M27 repayment schedule closes exactly 100');

reset role;
select * from finish();
rollback;
