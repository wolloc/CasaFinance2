begin;

set local time zone 'America/Sao_Paulo';

create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
 ('9a000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','release-wallace@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace Release"}',now(),now()),
 ('9a000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','release-gui@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Gui Release"}',now(),now());

insert into public.households(id,name,financial_tracking_started_on,timezone)
values ('9a000000-0000-4000-8000-000000000010','Casa Release',current_date,'America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role) values
 ('9a000000-0000-4000-8000-000000000021','9a000000-0000-4000-8000-000000000010','9a000000-0000-4000-8000-000000000001','owner'),
 ('9a000000-0000-4000-8000-000000000022','9a000000-0000-4000-8000-000000000010','9a000000-0000-4000-8000-000000000002','member');

insert into public.categories(id,household_id,name,type) values
 ('9a000000-0000-4000-8000-000000000025','9a000000-0000-4000-8000-000000000010','Salário','income'),
 ('9a000000-0000-4000-8000-000000000026','9a000000-0000-4000-8000-000000000010','Casa','expense');

insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('9a000000-0000-4000-8000-000000000031','9a000000-0000-4000-8000-000000000010','9a000000-0000-4000-8000-000000000021','Conta Wallace','checking'),
 ('9a000000-0000-4000-8000-000000000032','9a000000-0000-4000-8000-000000000010','9a000000-0000-4000-8000-000000000022','Conta Gui','checking');

insert into public.account_ownerships(account_id,household_id,member_id) values
 ('9a000000-0000-4000-8000-000000000031','9a000000-0000-4000-8000-000000000010','9a000000-0000-4000-8000-000000000021'),
 ('9a000000-0000-4000-8000-000000000032','9a000000-0000-4000-8000-000000000010','9a000000-0000-4000-8000-000000000022');

insert into public.account_balance_events(household_id,account_id,created_by_member_id,kind,amount,effective_date,description) values
 ('9a000000-0000-4000-8000-000000000010','9a000000-0000-4000-8000-000000000031','9a000000-0000-4000-8000-000000000021','opening',2000,current_date,'Posição inicial'),
 ('9a000000-0000-4000-8000-000000000010','9a000000-0000-4000-8000-000000000032','9a000000-0000-4000-8000-000000000021','opening',1000,current_date,'Posição inicial');

insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day,default_payment_account_id)
values ('9a000000-0000-4000-8000-000000000041','9a000000-0000-4000-8000-000000000010','9a000000-0000-4000-8000-000000000021','Cartão Wallace',5000,28,10,'9a000000-0000-4000-8000-000000000031');

set local role authenticated;
select set_config('request.jwt.claim.sub','9a000000-0000-4000-8000-000000000001',true);

select lives_ok($$
  select public.create_income_fact(
    '9a000000-0000-4000-8000-000000000010','Salário Release',1000,current_date,
    '9a000000-0000-4000-8000-000000000025','9a000000-0000-4000-8000-000000000021',
    '9a000000-0000-4000-8000-000000000031','salary','confirmed',null
  )
$$,'L01 true income can be created');

select lives_ok($$
  select public.settle_income_idempotent(
    '9a000000-0000-4000-8000-000000000010',
    (select id from public.transactions where description='Salário Release' and type='income'),
    '9a000000-0000-4000-8000-000000000031','9a000000-0000-4000-8000-000000000021',
    1000,now(),'release-income-receipt'
  )
$$,'L02 true income can be realized into cash');

select is((select count(*) from public.transactions where household_id='9a000000-0000-4000-8000-000000000010' and type='income' and description='Salário Release'),1::bigint,'L03 income remains one economic fact');
select is((select current_balance from public.financial_account_balances where account_id='9a000000-0000-4000-8000-000000000031'),3000::numeric,'L04 realized income increases Wallace account once');

select lives_ok($$
  select public.create_and_settle_direct_expense_idempotent(
    '9a000000-0000-4000-8000-000000000010','Mercado Release',300,current_date,
    '9a000000-0000-4000-8000-000000000026','9a000000-0000-4000-8000-000000000022',
    '9a000000-0000-4000-8000-000000000031','9a000000-0000-4000-8000-000000000021',
    '[{"member_id":"9a000000-0000-4000-8000-000000000021","amount":"150.00","percentage":"50.0000"},{"member_id":"9a000000-0000-4000-8000-000000000022","amount":"150.00","percentage":"50.0000"}]'::jsonb,
    now(),null,'release-direct-expense'
  )
$$,'L05 direct shared expense succeeds');

select is((select count(*) from public.transactions where household_id='9a000000-0000-4000-8000-000000000010' and type='expense' and description='Mercado Release'),1::bigint,'L06 direct payment creates one economic expense');
select is((select current_balance from public.financial_account_balances where account_id='9a000000-0000-4000-8000-000000000031'),2700::numeric,'L07 direct expense reduces the source account once');
select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='9a000000-0000-4000-8000-000000000022' and creditor_member_id='9a000000-0000-4000-8000-000000000021'),150::numeric,'L08 Gui owes Wallace 150 after Wallace funds a 50/50 direct expense');

select lives_ok($$
  select public.create_financial_transaction_idempotent(
    '9a000000-0000-4000-8000-000000000010','expense','TV Release',600,current_date,
    '9a000000-0000-4000-8000-000000000026','9a000000-0000-4000-8000-000000000022',
    'card',null,'9a000000-0000-4000-8000-000000000041',
    '[{"member_id":"9a000000-0000-4000-8000-000000000021","amount":"300.00","percentage":"50.0000"},{"member_id":"9a000000-0000-4000-8000-000000000022","amount":"300.00","percentage":"50.0000"}]'::jsonb,
    3,null,'release-card-expense'
  )
$$,'L09 installment card purchase succeeds');

select is((select count(*) from public.transactions where household_id='9a000000-0000-4000-8000-000000000010' and type='expense' and description='TV Release'),1::bigint,'L10 installments do not multiply the economic expense');
select is((select count(*) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='TV Release')),3::bigint,'L11a three installments create exactly three commitments');
select is((select sum(effective_amount) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='TV Release')),600::numeric,'L11b three installments preserve exactly 600 of commitments');
select is((select projected_outstanding from public.financial_member_settlement_positions where debtor_member_id='9a000000-0000-4000-8000-000000000022' and creditor_member_id='9a000000-0000-4000-8000-000000000021'),300::numeric,'L12 card purchase creates 300 projected settlement');
select is((select count(*) from public.money_movements where household_id='9a000000-0000-4000-8000-000000000010' and kind='invoice_payment'),0::bigint,'L13 card purchase alone creates no cash outflow');

select lives_ok($$
  select public.pay_card_invoice_idempotent(
    '9a000000-0000-4000-8000-000000000010',
    (
      select i.invoice_id
      from public.installments i
      join public.installment_plans p on p.id=i.installment_plan_id
      join public.transactions t on t.id=p.purchase_transaction_id
      where t.description='TV Release' and i.number=1
    ),
    '9a000000-0000-4000-8000-000000000031','9a000000-0000-4000-8000-000000000021',
    200,now(),'release-card-payment'
  )
$$,'L14 first invoice installment can be paid');

select is((select sum(remaining_amount) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='TV Release')),400::numeric,'L15 only 400 of card commitments remain after first installment payment');
select is((select total_exposure from public.financial_card_exposure_positions where card_id='9a000000-0000-4000-8000-000000000041'),400::numeric,'L16 card exposure falls to 400 after the payment');
select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='9a000000-0000-4000-8000-000000000022' and creditor_member_id='9a000000-0000-4000-8000-000000000021'),250::numeric,'L17 realized settlement combines direct funding 150 and first card installment 100');
select is((select projected_outstanding from public.financial_member_settlement_positions where debtor_member_id='9a000000-0000-4000-8000-000000000022' and creditor_member_id='9a000000-0000-4000-8000-000000000021'),200::numeric,'L18 remaining card installments preserve 200 projected settlement');

select lives_ok($$
  select public.settle_member_position_idempotent(
    '9a000000-0000-4000-8000-000000000010',
    '9a000000-0000-4000-8000-000000000022','9a000000-0000-4000-8000-000000000021',100,
    '9a000000-0000-4000-8000-000000000032','9a000000-0000-4000-8000-000000000031',
    'Acerto Release','release-member-settlement'
  )
$$,'L19 member settlement can be partially paid');

select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='9a000000-0000-4000-8000-000000000022' and creditor_member_id='9a000000-0000-4000-8000-000000000021'),150::numeric,'L20 member settlement reduces only realized debt');
select is((select count(*) from public.money_movements where household_id='9a000000-0000-4000-8000-000000000010' and kind='member_settlement'),1::bigint,'L21 settlement is one neutral internal money movement');
select is((select current_balance from public.financial_account_balances where account_id='9a000000-0000-4000-8000-000000000031'),2600::numeric,'L22 Wallace final account balance reconciles');
select is((select current_balance from public.financial_account_balances where account_id='9a000000-0000-4000-8000-000000000032'),900::numeric,'L23 Gui final account balance reconciles');
select is((select sum(current_balance) from public.financial_account_balances where household_id='9a000000-0000-4000-8000-000000000010'),3500::numeric,'L24 household cash closes: openings + income - direct expense - invoice payment');
select is((select count(*) from public.transactions where household_id='9a000000-0000-4000-8000-000000000010' and type='expense'),2::bigint,'L25a the Casa recognizes exactly two economic expenses');
select is((select sum(amount) from public.transactions where household_id='9a000000-0000-4000-8000-000000000010' and type='expense'),900::numeric,'L25b the two economic expenses total exactly 900');
select is((select sum(a.amount) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.household_id='9a000000-0000-4000-8000-000000000010' and t.type='expense'),900::numeric,'L26 economic responsibilities close exactly to total expenses');
select is((select count(*) from public.financial_commitment_positions where household_id='9a000000-0000-4000-8000-000000000010' and economic_type='invoice_payment'),0::bigint,'L27 invoice payment never becomes a second Gastos commitment');

reset role;
select * from finish();
rollback;
