begin;

set local time zone 'America/Sao_Paulo';

create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
 ('9d000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recon-wallace@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace Recon"}',now(),now()),
 ('9d000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','recon-gui@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Gui Recon"}',now(),now());

insert into public.households(id,name,financial_tracking_started_on,timezone)
values ('9d000000-0000-4000-8000-000000000010','Casa Recon',current_date,'America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role) values
 ('9d000000-0000-4000-8000-000000000021','9d000000-0000-4000-8000-000000000010','9d000000-0000-4000-8000-000000000001','owner'),
 ('9d000000-0000-4000-8000-000000000022','9d000000-0000-4000-8000-000000000010','9d000000-0000-4000-8000-000000000002','member');

insert into public.categories(id,household_id,name,type) values
 ('9d000000-0000-4000-8000-000000000025','9d000000-0000-4000-8000-000000000010','Salário','income'),
 ('9d000000-0000-4000-8000-000000000026','9d000000-0000-4000-8000-000000000010','Casa','expense');

insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('9d000000-0000-4000-8000-000000000031','9d000000-0000-4000-8000-000000000010','9d000000-0000-4000-8000-000000000021','Conta Wallace','checking'),
 ('9d000000-0000-4000-8000-000000000032','9d000000-0000-4000-8000-000000000010','9d000000-0000-4000-8000-000000000022','Conta Gui','checking');

insert into public.account_ownerships(account_id,household_id,member_id) values
 ('9d000000-0000-4000-8000-000000000031','9d000000-0000-4000-8000-000000000010','9d000000-0000-4000-8000-000000000021'),
 ('9d000000-0000-4000-8000-000000000032','9d000000-0000-4000-8000-000000000010','9d000000-0000-4000-8000-000000000022');

insert into public.account_balance_events(household_id,account_id,created_by_member_id,kind,amount,effective_date,description) values
 ('9d000000-0000-4000-8000-000000000010','9d000000-0000-4000-8000-000000000031','9d000000-0000-4000-8000-000000000021','opening',2000,current_date,'Posição inicial'),
 ('9d000000-0000-4000-8000-000000000010','9d000000-0000-4000-8000-000000000032','9d000000-0000-4000-8000-000000000021','opening',1000,current_date,'Posição inicial');

insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day,default_payment_account_id)
values ('9d000000-0000-4000-8000-000000000041','9d000000-0000-4000-8000-000000000010','9d000000-0000-4000-8000-000000000021','Cartão Wallace',5000,28,10,'9d000000-0000-4000-8000-000000000031');

set local role authenticated;
select set_config('request.jwt.claim.sub','9d000000-0000-4000-8000-000000000001',true);

select lives_ok($$
  select public.create_income_fact(
    '9d000000-0000-4000-8000-000000000010','Salário Recon',1000,current_date,
    '9d000000-0000-4000-8000-000000000025','9d000000-0000-4000-8000-000000000021',
    '9d000000-0000-4000-8000-000000000031','salary','confirmed',null
  )
$$,'N01 income fact can be created');

select lives_ok($$
  select public.settle_income_idempotent(
    '9d000000-0000-4000-8000-000000000010',
    (select id from public.transactions where description='Salário Recon'),
    '9d000000-0000-4000-8000-000000000031','9d000000-0000-4000-8000-000000000021',
    1000,now(),'recon-income'
  )
$$,'N02 income can be realized');

select lives_ok($$
  select public.create_and_settle_direct_expense_idempotent(
    '9d000000-0000-4000-8000-000000000010','Mercado Recon',300,current_date,
    '9d000000-0000-4000-8000-000000000026','9d000000-0000-4000-8000-000000000022',
    '9d000000-0000-4000-8000-000000000031','9d000000-0000-4000-8000-000000000021',
    '[{"member_id":"9d000000-0000-4000-8000-000000000021","amount":"150.00","percentage":"50.0000"},{"member_id":"9d000000-0000-4000-8000-000000000022","amount":"150.00","percentage":"50.0000"}]'::jsonb,
    now(),null,'recon-direct'
  )
$$,'N03 direct shared expense can be settled');

select lives_ok($$
  select public.create_financial_transaction_idempotent(
    '9d000000-0000-4000-8000-000000000010','expense','TV Recon',600,current_date,
    '9d000000-0000-4000-8000-000000000026','9d000000-0000-4000-8000-000000000022',
    'card',null,'9d000000-0000-4000-8000-000000000041',
    '[{"member_id":"9d000000-0000-4000-8000-000000000021","amount":"300.00","percentage":"50.0000"},{"member_id":"9d000000-0000-4000-8000-000000000022","amount":"300.00","percentage":"50.0000"}]'::jsonb,
    3,null,'recon-card'
  )
$$,'N04 installment card purchase can be created');

select lives_ok($$
  select public.pay_card_invoice_idempotent(
    '9d000000-0000-4000-8000-000000000010',
    (
      select i.invoice_id
      from public.installments i
      join public.installment_plans p on p.id=i.installment_plan_id
      join public.transactions t on t.id=p.purchase_transaction_id
      where t.description='TV Recon' and i.number=1
    ),
    '9d000000-0000-4000-8000-000000000031','9d000000-0000-4000-8000-000000000021',
    200,now(),'recon-invoice'
  )
$$,'N05 first invoice installment can be paid');

select lives_ok($$
  select public.settle_member_position_idempotent(
    '9d000000-0000-4000-8000-000000000010',
    '9d000000-0000-4000-8000-000000000022','9d000000-0000-4000-8000-000000000021',100,
    '9d000000-0000-4000-8000-000000000032','9d000000-0000-4000-8000-000000000031',
    'Acerto Recon','recon-member'
  )
$$,'N06 realized member position can be partially settled');

select is((select current_balance from public.financial_account_balances where account_id='9d000000-0000-4000-8000-000000000031'),2600::numeric,'N07 Wallace account closes at 2600');
select is((select current_balance from public.financial_account_balances where account_id='9d000000-0000-4000-8000-000000000032'),900::numeric,'N08 Gui account closes at 900');
select is((select sum(current_balance) from public.financial_account_balances where household_id='9d000000-0000-4000-8000-000000000010'),3500::numeric,'N09 household cash closes at 3500');
select is((select available_money from public.financial_household_position where household_id='9d000000-0000-4000-8000-000000000010'),3500::numeric,'N10 dashboard available money matches canonical balances');

select is((select sum(p.household_economic_amount) from public.financial_transaction_positions p join public.transactions t on t.id=p.transaction_id where p.household_id='9d000000-0000-4000-8000-000000000010' and t.type='expense' and p.economic_state='realized'),900::numeric,'N11 realized economic expenses total 900');
select is((select sum(a.amount) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.household_id='9d000000-0000-4000-8000-000000000010' and t.type='expense'),900::numeric,'N12 responsibilities close exactly to economic expenses');

select is((select sum(remaining_amount) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='TV Recon')),400::numeric,'N13 card commitments leave exactly 400 open');
select is((select total_exposure from public.financial_card_exposure_positions where card_id='9d000000-0000-4000-8000-000000000041'),400::numeric,'N14 card exposure matches remaining card commitments');
select is((select sum(remaining_amount) from public.financial_card_invoice_positions where card_id='9d000000-0000-4000-8000-000000000041' and state<>'paid'),400::numeric,'N15 open invoice totals match card exposure');
select is((select open_invoices from public.financial_household_position where household_id='9d000000-0000-4000-8000-000000000010'),400::numeric,'N16 dashboard open invoices match invoice positions');

select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='9d000000-0000-4000-8000-000000000022' and creditor_member_id='9d000000-0000-4000-8000-000000000021'),150::numeric,'N17 realized settlement position closes at 150');
select is((select projected_outstanding from public.financial_member_settlement_positions where debtor_member_id='9d000000-0000-4000-8000-000000000022' and creditor_member_id='9d000000-0000-4000-8000-000000000021'),200::numeric,'N18 projected settlement position closes at 200');

select is((select count(*) from public.transactions where household_id='9d000000-0000-4000-8000-000000000010' and type='expense'),2::bigint,'N19 invoice payment and member settlement create no extra expense');
select is((select count(*) from public.money_movements where household_id='9d000000-0000-4000-8000-000000000010' and kind='member_settlement'),1::bigint,'N20 member settlement remains one neutral internal money movement');

reset role;
select * from finish();
rollback;
