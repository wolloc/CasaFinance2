begin;

create extension if not exists pgtap with schema extensions;
select plan(42);

insert into auth.users (
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('78000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-d-wallace@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace PR D"}',now(),now()),
  ('78000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-d-gui@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Guilherme PR D"}',now(),now());

insert into public.households(id,name)
values ('78000000-0000-4000-8000-000000000010','Casa PR D');

insert into public.household_members(id,household_id,profile_id,role) values
  ('78000000-0000-4000-8000-000000000021','78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000001','owner'),
  ('78000000-0000-4000-8000-000000000022','78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000002','member');

-- One isolated card per behavioral scenario keeps exposure assertions deterministic.
insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day) values
  ('78000000-0000-4000-8000-000000000041','78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000021','PR-D A09',10000,20,28),
  ('78000000-0000-4000-8000-000000000042','78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000021','PR-D A10',10000,20,28),
  ('78000000-0000-4000-8000-000000000043','78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000021','PR-D A11',10000,20,28),
  ('78000000-0000-4000-8000-000000000044','78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000021','PR-D A12',10000,20,28),
  ('78000000-0000-4000-8000-000000000045','78000000-0000-4000-8000-000000000010','78000000-0000-4000-8000-000000000021','PR-D A13',10000,20,28);

set local role authenticated;
select set_config('request.jwt.claim.sub','78000000-0000-4000-8000-000000000001',true);

-- A09: cartão à vista R$100.
select lives_ok($$
  select public.create_financial_transaction_idempotent(
    '78000000-0000-4000-8000-000000000010','expense','PR-D A09 card single',100.00,current_date,null,
    '78000000-0000-4000-8000-000000000021','card',null,'78000000-0000-4000-8000-000000000041',
    '[{"member_id":"78000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    1,null,'pr-d-a09'
  )
$$,'A09 one-time card purchase succeeds');
select is((select count(*) from public.transactions where description='PR-D A09 card single' and type='expense'),1::bigint,'A09 creates one economic expense');
select is((select economic_state::text from public.transactions where description='PR-D A09 card single'),'realized'::text,'A09 purchase is a realized economic fact');
select is((select sum(a.amount) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='PR-D A09 card single'),100.00::numeric,'A09 responsibility closes exactly 100');
select is((select sum(total_amount) from public.card_invoices where card_id='78000000-0000-4000-8000-000000000041' and deleted_at is null),100.00::numeric,'A09 invoice exposure is 100');
select results_eq(
  $$select total_exposure,available_limit from public.financial_card_exposure_positions where card_id='78000000-0000-4000-8000-000000000041'$$,
  $$values(100.00::numeric,9900.00::numeric)$$,
  'A09 card limit reflects 100 exposure without cash'
);

-- A10: cartão R$120 em 2x.
select lives_ok($$
  select public.create_financial_transaction_idempotent(
    '78000000-0000-4000-8000-000000000010','expense','PR-D A10 card 2x',120.00,current_date,null,
    '78000000-0000-4000-8000-000000000021','card',null,'78000000-0000-4000-8000-000000000042',
    '[{"member_id":"78000000-0000-4000-8000-000000000021","amount":"120.00","percentage":"100.0000"}]'::jsonb,
    2,null,'pr-d-a10'
  )
$$,'A10 two-installment card purchase succeeds');
select is((select count(*) from public.transactions where description='PR-D A10 card 2x' and type='expense'),1::bigint,'A10 installments do not multiply the economic expense');
select results_eq(
  $$select installment_count,total_amount from public.installment_plans p join public.transactions t on t.id=p.purchase_transaction_id where t.description='PR-D A10 card 2x'$$,
  $$values(2,120.00::numeric)$$,
  'A10 installment plan records 2x and gross 120'
);
select is((select count(*) from public.installments i join public.installment_plans p on p.id=i.installment_plan_id join public.transactions t on t.id=p.purchase_transaction_id where t.description='PR-D A10 card 2x'),2::bigint,'A10 creates exactly two installments');
select is((select sum(i.amount) from public.installments i join public.installment_plans p on p.id=i.installment_plan_id join public.transactions t on t.id=p.purchase_transaction_id where t.description='PR-D A10 card 2x'),120.00::numeric,'A10 installment cents close exactly 120');
select is((select sum(total_amount) from public.card_invoices where card_id='78000000-0000-4000-8000-000000000042' and deleted_at is null),120.00::numeric,'A10 invoices total exactly 120');
select results_eq(
  $$select total_exposure,available_limit from public.financial_card_exposure_positions where card_id='78000000-0000-4000-8000-000000000042'$$,
  $$values(120.00::numeric,9880.00::numeric)$$,
  'A10 card exposure counts the purchase once'
);

-- A11: cartão R$1.200 em 12x.
select lives_ok($$
  select public.create_financial_transaction_idempotent(
    '78000000-0000-4000-8000-000000000010','expense','PR-D A11 card 12x',1200.00,current_date,null,
    '78000000-0000-4000-8000-000000000021','card',null,'78000000-0000-4000-8000-000000000043',
    '[{"member_id":"78000000-0000-4000-8000-000000000021","amount":"1200.00","percentage":"100.0000"}]'::jsonb,
    12,null,'pr-d-a11'
  )
$$,'A11 twelve-installment card purchase succeeds');
select is((select count(*) from public.transactions where description='PR-D A11 card 12x' and type='expense'),1::bigint,'A11 creates one economic expense');
select results_eq(
  $$select installment_count,total_amount from public.installment_plans p join public.transactions t on t.id=p.purchase_transaction_id where t.description='PR-D A11 card 12x'$$,
  $$values(12,1200.00::numeric)$$,
  'A11 installment plan records 12x and gross 1200'
);
select is((select count(*) from public.installments i join public.installment_plans p on p.id=i.installment_plan_id join public.transactions t on t.id=p.purchase_transaction_id where t.description='PR-D A11 card 12x'),12::bigint,'A11 creates exactly twelve installments');
select is((select sum(i.amount) from public.installments i join public.installment_plans p on p.id=i.installment_plan_id join public.transactions t on t.id=p.purchase_transaction_id where t.description='PR-D A11 card 12x'),1200.00::numeric,'A11 installment cents close exactly 1200');
select is((select sum(total_amount) from public.card_invoices where card_id='78000000-0000-4000-8000-000000000043' and deleted_at is null),1200.00::numeric,'A11 invoices total exactly 1200');
select results_eq(
  $$select total_exposure,available_limit from public.financial_card_exposure_positions where card_id='78000000-0000-4000-8000-000000000043'$$,
  $$values(1200.00::numeric,8800.00::numeric)$$,
  'A11 card exposure is 1200, not twelve duplicated expenses'
);

-- A12: Pix por cartão R$100 + R$10 de encargos.
select lives_ok($$
  select public.create_simple_card_pix_expense(
    '78000000-0000-4000-8000-000000000010','PR-D A12 card pix',100.00,10.00,current_date,null,
    '78000000-0000-4000-8000-000000000021','78000000-0000-4000-8000-000000000044',
    '[{"member_id":"78000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    '[{"member_id":"78000000-0000-4000-8000-000000000021","amount":"10.00","percentage":"100.0000"}]'::jsonb,
    1,null,'pr-d-a12'
  )
$$,'A12 card PIX with one financial charge succeeds');
select is((select count(*) from public.transactions where description='PR-D A12 card pix' and type='expense'),1::bigint,'A12 preserves one principal expense');
select is((select count(*) from public.transactions where description='Encargos financeiros PIX no cartão — PR-D A12 card pix' and type='expense'),1::bigint,'A12 records one linked economic charge');
select results_eq(
  $$select count(*),sum(l.amount) from public.transaction_links l join public.transactions t on t.id=l.source_transaction_id where t.description='PR-D A12 card pix' and l.kind='fee'$$,
  $$values(1::bigint,10.00::numeric)$$,
  'A12 links exactly one R$10 charge to the principal'
);
select is((select count(*) from public.transaction_components c join public.transactions t on t.id=c.transaction_id where t.description in ('PR-D A12 card pix','Encargos financeiros PIX no cartão — PR-D A12 card pix')),2::bigint,'A12 keeps principal and fee components explicit');
select is((select sum(a.amount) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='PR-D A12 card pix'),100.00::numeric,'A12 principal responsibility closes 100');
select is((select sum(a.amount) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='Encargos financeiros PIX no cartão — PR-D A12 card pix'),10.00::numeric,'A12 charge responsibility closes 10');
select is((select sum(total_amount) from public.card_invoices where card_id='78000000-0000-4000-8000-000000000044' and deleted_at is null),110.00::numeric,'A12 card invoices contain principal plus charge exactly once');
select results_eq(
  $$select total_exposure,available_limit from public.financial_card_exposure_positions where card_id='78000000-0000-4000-8000-000000000044'$$,
  $$values(110.00::numeric,9890.00::numeric)$$,
  'A12 card limit is committed by total financed 110'
);
select is((select sum(f.amount) from public.financing_allocations f where f.card_id='78000000-0000-4000-8000-000000000044' and f.mechanism='card_pix'),110.00::numeric,'A12 canonical card_pix financing totals 110');

-- A13: Pix R$100 + R$0,10; principal 99/1. Largest remainder assigns the
-- indivisible ten-cent charge to the 99% share and sends/persists no zero row.
select lives_ok($$
  select public.create_simple_card_pix_expense(
    '78000000-0000-4000-8000-000000000010','PR-D A13 card pix cents',100.00,0.10,current_date,null,
    '78000000-0000-4000-8000-000000000021','78000000-0000-4000-8000-000000000045',
    '[{"member_id":"78000000-0000-4000-8000-000000000021","amount":"99.00","percentage":"99.0000"},{"member_id":"78000000-0000-4000-8000-000000000022","amount":"1.00","percentage":"1.0000"}]'::jsonb,
    '[{"member_id":"78000000-0000-4000-8000-000000000021","amount":"0.10","percentage":"100.0000"}]'::jsonb,
    1,null,'pr-d-a13'
  )
$$,'A13 cent-sensitive card PIX succeeds');
select is((select a.amount from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='PR-D A13 card pix cents' and a.responsible_member_id='78000000-0000-4000-8000-000000000021'),99.00::numeric,'A13 principal keeps Wallace 99');
select is((select a.amount from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='PR-D A13 card pix cents' and a.responsible_member_id='78000000-0000-4000-8000-000000000022'),1.00::numeric,'A13 principal keeps Guilherme 1');
select is((select amount from public.transactions where description='Encargos financeiros PIX no cartão — PR-D A13 card pix cents'),0.10::numeric,'A13 linked financial charge is exactly ten cents');
select is((select count(*) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='Encargos financeiros PIX no cartão — PR-D A13 card pix cents'),1::bigint,'A13 charge persists only positive allocations');
select is((select a.amount from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='Encargos financeiros PIX no cartão — PR-D A13 card pix cents' and a.responsible_member_id='78000000-0000-4000-8000-000000000021'),0.10::numeric,'A13 largest remainder assigns ten cents to the 99% share');
select is((select count(*) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='Encargos financeiros PIX no cartão — PR-D A13 card pix cents' and a.responsible_member_id='78000000-0000-4000-8000-000000000022'),0::bigint,'A13 does not persist a zero-cent 1% charge allocation');
select is((select count(*) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description in ('PR-D A13 card pix cents','Encargos financeiros PIX no cartão — PR-D A13 card pix cents') and a.amount<=0),0::bigint,'A13 contains no zero or negative economic allocation');
select is((select sum(total_amount) from public.card_invoices where card_id='78000000-0000-4000-8000-000000000045' and deleted_at is null),100.10::numeric,'A13 invoice cents close principal plus charge exactly');
select results_eq(
  $$select total_exposure,available_limit from public.financial_card_exposure_positions where card_id='78000000-0000-4000-8000-000000000045'$$,
  $$values(100.10::numeric,9899.90::numeric)$$,
  'A13 exposure and available limit close to the cent'
);

-- Global card-creation invariants for A09-A13.
select is((select count(*) from public.money_movements where household_id='78000000-0000-4000-8000-000000000010'),0::bigint,'A09-A13 create no immediate account cash movement');
select is((select count(*) from public.economic_allocations where household_id='78000000-0000-4000-8000-000000000010' and amount<=0),0::bigint,'A09-A13 persist no zero or negative economic allocations');

select * from finish();
rollback;
