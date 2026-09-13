begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '7c000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','pr-h-card@example.invalid',crypt('test-only',gen_salt('bf')),now(),
  '{}','{"display_name":"Cartão PR H"}',now(),now()
);

insert into public.households(id,name)
values ('7c000000-0000-4000-8000-000000000010','Casa PR H');

insert into public.household_members(id,household_id,profile_id,role)
values ('7c000000-0000-4000-8000-000000000021','7c000000-0000-4000-8000-000000000010','7c000000-0000-4000-8000-000000000001','owner');

insert into public.accounts(id,household_id,owner_member_id,name,type)
values ('7c000000-0000-4000-8000-000000000031','7c000000-0000-4000-8000-000000000010','7c000000-0000-4000-8000-000000000021','Conta PR H','checking');

insert into public.account_ownerships(account_id,household_id,member_id)
values ('7c000000-0000-4000-8000-000000000031','7c000000-0000-4000-8000-000000000010','7c000000-0000-4000-8000-000000000021');

insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day) values
  ('7c000000-0000-4000-8000-000000000041','7c000000-0000-4000-8000-000000000010','7c000000-0000-4000-8000-000000000021','PR-H à vista',10000,20,28),
  ('7c000000-0000-4000-8000-000000000042','7c000000-0000-4000-8000-000000000010','7c000000-0000-4000-8000-000000000021','PR-H parcelado',10000,20,28);

set local role authenticated;
select set_config('request.jwt.claim.sub','7c000000-0000-4000-8000-000000000001',true);

select lives_ok($$
  select public.create_financial_transaction_idempotent(
    '7c000000-0000-4000-8000-000000000010','expense','PR-H card single',100.00,current_date,null,
    '7c000000-0000-4000-8000-000000000021','card',null,'7c000000-0000-4000-8000-000000000041',
    '[{"member_id":"7c000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    1,null,'pr-h-card-single'
  )
$$,'H01 one-time card purchase succeeds');

select is((select count(*) from public.transactions where household_id='7c000000-0000-4000-8000-000000000010' and description='PR-H card single' and type='expense'),1::bigint,'H02 purchase creates exactly one economic expense');
select is((select economic_state::text from public.transactions where description='PR-H card single'),'realized'::text,'H03 card purchase is economically realized on purchase date');
select is((select count(*) from public.money_movements where household_id='7c000000-0000-4000-8000-000000000010'),0::bigint,'H04 purchase creates no immediate cash movement');
select is((select effective_amount from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card single')),100.00::numeric,'H05 financial commitment keeps the full invoice-backed amount');
select is((select realized_amount from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card single')),0.00::numeric,'H06 unpaid card commitment has zero financial realization');
select is((select remaining_amount from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card single')),100.00::numeric,'H07 unpaid card commitment remains fully outstanding');
select is((select commitment_state::text from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card single')),'confirmed'::text,'H08 unpaid economically-realized card purchase is financially confirmed, not paid');
select is(
  (select cp.due_date from public.financial_commitment_positions cp where cp.source_transaction_id=(select id from public.transactions where description='PR-H card single')),
  (select i.due_date from public.card_invoices i join public.transactions t on t.invoice_id=i.id where t.description='PR-H card single'),
  'H09 direct card commitment uses the canonical invoice due date'
);

select lives_ok($$
  select public.pay_card_invoice_idempotent(
    '7c000000-0000-4000-8000-000000000010',
    (select invoice_id from public.transactions where description='PR-H card single'),
    '7c000000-0000-4000-8000-000000000031','7c000000-0000-4000-8000-000000000021',
    40.00,now(),'pr-h-card-pay-40'
  )
$$,'H10 partial invoice payment succeeds');
select is((select realized_amount from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card single')),40.00::numeric,'H11 partial invoice payment financially realizes exactly 40');
select is((select remaining_amount from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card single')),60.00::numeric,'H12 partial invoice payment leaves 60 outstanding');
select is((select commitment_state::text from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card single')),'confirmed'::text,'H13 partially paid card commitment remains financially confirmed');
select is((select count(*) from public.transactions where household_id='7c000000-0000-4000-8000-000000000010' and description='PR-H card single' and type='expense'),1::bigint,'H14 partial payment does not create another expense');
select is((select settled_amount from public.card_invoices i join public.transactions t on t.invoice_id=i.id where t.description='PR-H card single'),40.00::numeric,'H15 invoice itself records 40 paid');

select lives_ok($$
  select public.pay_card_invoice_idempotent(
    '7c000000-0000-4000-8000-000000000010',
    (select invoice_id from public.transactions where description='PR-H card single'),
    '7c000000-0000-4000-8000-000000000031','7c000000-0000-4000-8000-000000000021',
    60.00,now(),'pr-h-card-pay-60'
  )
$$,'H16 remaining invoice payment succeeds');
select is((select realized_amount from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card single')),100.00::numeric,'H17 full invoice settlement financially realizes exactly 100');
select is((select remaining_amount from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card single')),0.00::numeric,'H18 full invoice settlement leaves no remaining commitment');
select is((select commitment_state::text from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card single')),'realized'::text,'H19 fully paid card commitment becomes financially realized');
select is((select settled_amount from public.card_invoices i join public.transactions t on t.invoice_id=i.id where t.description='PR-H card single'),100.00::numeric,'H20 invoice is fully settled');
select is((select sum(amount) from public.money_movements where household_id='7c000000-0000-4000-8000-000000000010' and kind='invoice_payment'),100.00::numeric,'H21 cash leaves only through invoice payments and totals 100');
select is((select count(*) from public.transactions where household_id='7c000000-0000-4000-8000-000000000010' and type='expense' and description='PR-H card single'),1::bigint,'H22 invoice settlement never duplicates the economic expense');

select lives_ok($$
  select public.create_and_settle_direct_expense_idempotent(
    '7c000000-0000-4000-8000-000000000010','PR-H direct account',25.00,current_date,null,
    '7c000000-0000-4000-8000-000000000021','7c000000-0000-4000-8000-000000000031','7c000000-0000-4000-8000-000000000021',
    '[{"member_id":"7c000000-0000-4000-8000-000000000021","amount":"25.00","percentage":"100.0000"}]'::jsonb,
    now(),null,'pr-h-direct'
  )
$$,'H23 immediate account expense still succeeds');
select is((select remaining_amount from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H direct account' and type='expense')),0.00::numeric,'H24 immediate account expense remains financially realized');
select is((select commitment_state::text from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H direct account' and type='expense')),'realized'::text,'H25 immediate account commitment state remains realized');

select lives_ok($$
  select public.create_financial_transaction_idempotent(
    '7c000000-0000-4000-8000-000000000010','expense','PR-H card 2x',120.00,current_date,null,
    '7c000000-0000-4000-8000-000000000021','card',null,'7c000000-0000-4000-8000-000000000042',
    '[{"member_id":"7c000000-0000-4000-8000-000000000021","amount":"120.00","percentage":"100.0000"}]'::jsonb,
    2,null,'pr-h-card-2x'
  )
$$,'H26 installment card purchase still succeeds');
select is((select count(*) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card 2x')),2::bigint,'H27 two installments remain two financial commitment units');
select is((select sum(remaining_amount) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card 2x')),120.00::numeric,'H28 unpaid installment commitments total exactly 120');
select is((select count(*) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-H card 2x') and commitment_state='confirmed'),2::bigint,'H29 unpaid installments are financially confirmed rather than falsely paid');
select is((select count(*) from public.transactions where household_id='7c000000-0000-4000-8000-000000000010' and type='expense' and description='PR-H card 2x'),1::bigint,'H30 installment commitments do not multiply the economic expense');
select is((select count(*) from public.financial_commitment_positions where household_id='7c000000-0000-4000-8000-000000000010' and economic_type='invoice_payment'),0::bigint,'H31 invoice payments never become Gastos commitments');

reset role;
select * from finish();
rollback;
