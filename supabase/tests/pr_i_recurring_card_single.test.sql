begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('7d000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-i-card@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Cartão PR I"}',now(),now());
insert into public.households(id,name) values ('7d000000-0000-4000-8000-000000000010','Casa PR I');
insert into public.household_members(id,household_id,profile_id,role) values ('7d000000-0000-4000-8000-000000000021','7d000000-0000-4000-8000-000000000010','7d000000-0000-4000-8000-000000000001','owner');
insert into public.accounts(id,household_id,owner_member_id,name,type) values ('7d000000-0000-4000-8000-000000000031','7d000000-0000-4000-8000-000000000010','7d000000-0000-4000-8000-000000000021','Conta PR I','checking');
insert into public.account_ownerships(account_id,household_id,member_id) values ('7d000000-0000-4000-8000-000000000031','7d000000-0000-4000-8000-000000000010','7d000000-0000-4000-8000-000000000021');
insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day)
values ('7d000000-0000-4000-8000-000000000041','7d000000-0000-4000-8000-000000000010','7d000000-0000-4000-8000-000000000021','Cartão PR I',500.00,20,28);

set local role authenticated;
select set_config('request.jwt.claim.sub','7d000000-0000-4000-8000-000000000001',true);

select lives_ok($$
  select public.create_financial_transaction_idempotent(
    '7d000000-0000-4000-8000-000000000010','expense','PR-I Netflix',30.00,current_date-1,null,
    '7d000000-0000-4000-8000-000000000021','card',null,'7d000000-0000-4000-8000-000000000041',
    '[{"member_id":"7d000000-0000-4000-8000-000000000021","amount":"30.00","percentage":"100.0000"}]'::jsonb,1,null,'pr-i-source'
  )
$$,'I00 canonical simple card purchase can be the series template');

select lives_ok($$
  select public.create_recurring_expense_rule_from_transaction_idempotent(
    '7d000000-0000-4000-8000-000000000010',(select id from public.transactions where description='PR-I Netflix' order by created_at limit 1),
    'monthly',1,current_date,null,'pr-i-rule'
  )
$$,'I00b canonical card recurrence rule is accepted');
select is(public.ensure_household_recurring_expense_horizon('7d000000-0000-4000-8000-000000000010',(current_date+interval '2 months')::date),3,'I00c three occurrences materialize idempotently');

select is((select count(*) from public.recurring_occurrences where household_id='7d000000-0000-4000-8000-000000000010'),3::bigint,'I01 three projected occurrences exist');
select is((select total_exposure from public.financial_card_exposure_positions where card_id='7d000000-0000-4000-8000-000000000041'),30.00::numeric,'I02 future forecasts do not consume real limit');
select is((select available_limit from public.financial_card_exposure_positions where card_id='7d000000-0000-4000-8000-000000000041'),470.00::numeric,'I03 available limit ignores all three forecasts');
select is((select count(*) from public.financial_card_future_commitments where card_id='7d000000-0000-4000-8000-000000000041' and source_type='recurring_occurrence' and commitment_state='forecast'),3::bigint,'I04 each forecast appears in the projected card commitments');
select is((select count(*) from public.card_invoices i join public.recurring_occurrences o on o.transaction_id in (select t.id from public.transactions t where t.invoice_id=i.id) where o.household_id='7d000000-0000-4000-8000-000000000010'),0::bigint,'I05 forecast creates no invoice materialization');
select is((select count(*) from public.funding_events where household_id='7d000000-0000-4000-8000-000000000010'),0::bigint,'I06 forecast creates no funding');
select is((select count(*) from public.money_movements where household_id='7d000000-0000-4000-8000-000000000010'),0::bigint,'I07 forecast creates no cash movement');
select is((select count(*) from public.financial_transaction_positions p join public.recurring_occurrences o on o.transaction_id=p.transaction_id where o.household_id='7d000000-0000-4000-8000-000000000010' and p.economic_state='realized'),0::bigint,'I08 forecast is not a realized expense');
select throws_ok($$
  select public.confirm_recurring_card_expense_occurrence(
    '7d000000-0000-4000-8000-000000000010',(select id from public.recurring_occurrences where household_id='7d000000-0000-4000-8000-000000000010' order by competence_date desc limit 1),30.00)
$$,'22023','future recurring card occurrence cannot be confirmed before its economic date','I08b future occurrence cannot be prematurely realized');

select is(
  public.confirm_recurring_card_expense_occurrence_idempotent(
    '7d000000-0000-4000-8000-000000000010',(select id from public.recurring_occurrences where household_id='7d000000-0000-4000-8000-000000000010' order by competence_date limit 1),30.00,'pr-i-confirm-first'
  ),
  public.confirm_recurring_card_expense_occurrence_idempotent(
    '7d000000-0000-4000-8000-000000000010',(select id from public.recurring_occurrences where household_id='7d000000-0000-4000-8000-000000000010' order by competence_date limit 1),30.00,'pr-i-confirm-first'
  ),'I09 confirmation is idempotent');
select is((select count(*) from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7d000000-0000-4000-8000-000000000010' and t.economic_state='realized'),1::bigint,'I10 confirming creates exactly one new realized economic purchase');
select is((select count(*) from public.transactions where household_id='7d000000-0000-4000-8000-000000000010' and description='PR-I Netflix'),4::bigint,'I11 confirmation reuses the occurrence instead of inserting another transaction');
select is((select count(*) from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7d000000-0000-4000-8000-000000000010' and t.invoice_id is not null),1::bigint,'I12 confirmed occurrence belongs to exactly one invoice');
select is((select total_exposure from public.financial_card_exposure_positions where card_id='7d000000-0000-4000-8000-000000000041'),60.00::numeric,'I13 confirmed charge increases real card exposure by 30');
select is((select available_limit from public.financial_card_exposure_positions where card_id='7d000000-0000-4000-8000-000000000041'),440.00::numeric,'I14 confirmed charge reduces real available limit by 30');
select is((select count(*) from public.money_movements where household_id='7d000000-0000-4000-8000-000000000010'),0::bigint,'I15 charging the card still creates no cash movement');
select is((select count(*) from public.funding_events where household_id='7d000000-0000-4000-8000-000000000010'),0::bigint,'I16 charging the card still creates no funding');
select is((select count(*) from public.recurring_occurrences o join public.transactions t on t.id=o.transaction_id where o.household_id='7d000000-0000-4000-8000-000000000010' and t.economic_state='forecast'),2::bigint,'I17 following occurrences remain forecast only');

select lives_ok($$
  select public.pay_card_invoice_idempotent('7d000000-0000-4000-8000-000000000010',
    (select t.invoice_id from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7d000000-0000-4000-8000-000000000010' order by o.competence_date limit 1),
    '7d000000-0000-4000-8000-000000000031','7d000000-0000-4000-8000-000000000021',10.00,now(),'pr-i-pay-10')
$$,'I18 partial invoice payment succeeds');
select is((select remaining_amount from public.financial_commitment_positions where source_transaction_id=(select transaction_id from public.recurring_occurrences where household_id='7d000000-0000-4000-8000-000000000010' order by competence_date limit 1)),20.00::numeric,'I19 partial payment reduces only the open balance');
select is((select total_exposure from public.financial_card_exposure_positions where card_id='7d000000-0000-4000-8000-000000000041'),50.00::numeric,'I20 partial payment frees only the paid limit');
select is((select count(*) from public.transactions where household_id='7d000000-0000-4000-8000-000000000010' and type='expense' and description='PR-I Netflix'),4::bigint,'I21 invoice payment creates no economic expense');
select lives_ok($$
  select public.pay_card_invoice_idempotent('7d000000-0000-4000-8000-000000000010',
    (select t.invoice_id from public.transactions t join public.recurring_occurrences o on o.transaction_id=t.id where o.household_id='7d000000-0000-4000-8000-000000000010' order by o.competence_date limit 1),
    '7d000000-0000-4000-8000-000000000031','7d000000-0000-4000-8000-000000000021',20.00,now(),'pr-i-pay-20')
$$,'I22 remaining invoice payment succeeds');
select is((select remaining_amount from public.financial_commitment_positions where source_transaction_id=(select transaction_id from public.recurring_occurrences where household_id='7d000000-0000-4000-8000-000000000010' order by competence_date limit 1)),0.00::numeric,'I23 full payment settles the occurrence commitment');
select is((select total_exposure from public.financial_card_exposure_positions where card_id='7d000000-0000-4000-8000-000000000041'),30.00::numeric,'I24 full payment frees that occurrence limit');
select is((select count(*) from public.transactions where household_id='7d000000-0000-4000-8000-000000000010' and type='invoice_payment'),2::bigint,'I25 payments are exactly the two invoice settlements');

select lives_ok($$
  select public.create_and_settle_direct_expense_idempotent(
    '7d000000-0000-4000-8000-000000000010','PR-I direct account',25.00,current_date,null,
    '7d000000-0000-4000-8000-000000000021','7d000000-0000-4000-8000-000000000031','7d000000-0000-4000-8000-000000000021',
    '[{"member_id":"7d000000-0000-4000-8000-000000000021","amount":"25.00","percentage":"100.0000"}]'::jsonb,now(),null,'pr-i-direct'
  )
$$,'I26 direct account expense remains intact');
select is((select remaining_amount from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-I direct account')),0.00::numeric,'I27 direct account expense remains settled');

reset role;
select * from finish();
rollback;
