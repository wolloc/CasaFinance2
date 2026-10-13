begin;

set local time zone 'America/Sao_Paulo';
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users(
 id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
 (
  'c4000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','pr-v-mixed-owner@example.invalid',
  crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Invoice Mixed Owner"}',now(),now()
 ),
 (
  'c4000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','pr-v-mixed-member@example.invalid',
  crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Invoice Mixed Member"}',now(),now()
 );

insert into public.households(id,name,financial_tracking_started_on,timezone)
values ('c4000000-0000-4000-8000-000000000010','Casa PR V Mixed',current_date,'America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role)
values
 ('c4000000-0000-4000-8000-000000000021','c4000000-0000-4000-8000-000000000010','c4000000-0000-4000-8000-000000000001','owner'),
 ('c4000000-0000-4000-8000-000000000022','c4000000-0000-4000-8000-000000000010','c4000000-0000-4000-8000-000000000002','member');

insert into public.accounts(id,household_id,owner_member_id,name,type)
values ('c4000000-0000-4000-8000-000000000031','c4000000-0000-4000-8000-000000000010','c4000000-0000-4000-8000-000000000021','Conta PR V Mixed','checking');

insert into public.account_ownerships(account_id,household_id,member_id)
values
 ('c4000000-0000-4000-8000-000000000031','c4000000-0000-4000-8000-000000000010','c4000000-0000-4000-8000-000000000021'),
 ('c4000000-0000-4000-8000-000000000031','c4000000-0000-4000-8000-000000000010','c4000000-0000-4000-8000-000000000022');

insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day)
values ('c4000000-0000-4000-8000-000000000041','c4000000-0000-4000-8000-000000000010','c4000000-0000-4000-8000-000000000021','PR-V Mixed High Volume',20000,20,28);

set local role authenticated;
select set_config('request.jwt.claim.sub','c4000000-0000-4000-8000-000000000001',true);
set local statement_timeout='0';

-- Isolated synthetic fixture: 40 purchases, each with 50/50 economic responsibility.
-- Fixture setup is outside the measured timeout and the transaction is rolled back.
do $fixture$
declare i integer;
begin
 for i in 1..40 loop
  perform public.create_financial_transaction_idempotent(
   'c4000000-0000-4000-8000-000000000010','expense',
   'PR-V mixed responsibility purchase '||i,100.00,current_date,null,
   'c4000000-0000-4000-8000-000000000021','card',null,
   'c4000000-0000-4000-8000-000000000041',
   '[{"member_id":"c4000000-0000-4000-8000-000000000021","amount":"50.00","percentage":"50.0000"},{"member_id":"c4000000-0000-4000-8000-000000000022","amount":"50.00","percentage":"50.0000"}]'::jsonb,
   1,null,'pr-v-mixed-create-'||i
  );
 end loop;
end
$fixture$;

select is(
 (select count(distinct invoice_id) from public.transactions
  where household_id='c4000000-0000-4000-8000-000000000010'
    and description like 'PR-V mixed responsibility purchase %'
    and invoice_id is not null),
 1::bigint,
 'M01 all forty mixed-responsibility purchases land on one invoice'
);

select is(
 (select count(*) from public.transactions
  where household_id='c4000000-0000-4000-8000-000000000010'
    and description like 'PR-V mixed responsibility purchase %'),
 40::bigint,
 'M02 fixture contains exactly forty mixed-responsibility purchases'
);

select is(
 (select count(*) from public.economic_allocations ea
  join public.transactions t on t.id=ea.transaction_id
  where t.household_id='c4000000-0000-4000-8000-000000000010'
    and t.description like 'PR-V mixed responsibility purchase %'),
 80::bigint,
 'M03 fixture has two canonical member allocations per purchase'
);

set local statement_timeout='8s';

select lives_ok($$
 select public.pay_card_invoice_idempotent(
  'c4000000-0000-4000-8000-000000000010',
  (select invoice_id from public.transactions
   where household_id='c4000000-0000-4000-8000-000000000010'
     and description='PR-V mixed responsibility purchase 1'),
  'c4000000-0000-4000-8000-000000000031',
  'c4000000-0000-4000-8000-000000000021',
  4000.00,now(),'pr-v-mixed-high-volume-pay'
 )
$$,'M04 mixed-responsibility invoice payment completes within 8 seconds');

select lives_ok($$
 select public.pay_card_invoice_idempotent(
  'c4000000-0000-4000-8000-000000000010',
  (select invoice_id from public.transactions
   where household_id='c4000000-0000-4000-8000-000000000010'
     and description='PR-V mixed responsibility purchase 1'),
  'c4000000-0000-4000-8000-000000000031',
  'c4000000-0000-4000-8000-000000000021',
  4000.00,now(),'pr-v-mixed-high-volume-pay'
 )
$$,'M05 retry with same idempotency key succeeds');

select is(
 (select count(*) from public.card_invoice_payments
  where household_id='c4000000-0000-4000-8000-000000000010'),
 1::bigint,
 'M06 retry leaves exactly one canonical invoice payment'
);

select is(
 (select coalesce(sum(amount),0) from public.money_movements
  where household_id='c4000000-0000-4000-8000-000000000010'
    and kind='invoice_payment'),
 4000.00::numeric,
 'M07 retry leaves exactly one cash outflow for the paid amount'
);

reset role;
select * from finish();
rollback;
