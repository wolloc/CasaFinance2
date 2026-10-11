begin;

set local time zone 'America/Sao_Paulo';
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users(
 id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
 'c3000000-0000-4000-8000-000000000001',
 '00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','pr-v-invoice-timeout@example.invalid',
 crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Invoice Timeout PR V"}',now(),now()
);

insert into public.households(id,name,financial_tracking_started_on,timezone)
values ('c3000000-0000-4000-8000-000000000010','Casa PR V',current_date,'America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role)
values ('c3000000-0000-4000-8000-000000000021','c3000000-0000-4000-8000-000000000010','c3000000-0000-4000-8000-000000000001','owner');

insert into public.accounts(id,household_id,owner_member_id,name,type)
values ('c3000000-0000-4000-8000-000000000031','c3000000-0000-4000-8000-000000000010','c3000000-0000-4000-8000-000000000021','Conta PR V','checking');

insert into public.account_ownerships(account_id,household_id,member_id)
values ('c3000000-0000-4000-8000-000000000031','c3000000-0000-4000-8000-000000000010','c3000000-0000-4000-8000-000000000021');

insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day)
values ('c3000000-0000-4000-8000-000000000041','c3000000-0000-4000-8000-000000000010','c3000000-0000-4000-8000-000000000021','PR-V High Volume',20000,20,28);

set local role authenticated;
select set_config('request.jwt.claim.sub','c3000000-0000-4000-8000-000000000001',true);
set local statement_timeout='0';

-- Fixture setup is deliberately outside the measured timeout. All data is synthetic
-- and the transaction is rolled back at the end of this test.
do $fixture$
declare i integer;
begin
 for i in 1..40 loop
  perform public.create_financial_transaction_idempotent(
   'c3000000-0000-4000-8000-000000000010','expense',
   'PR-V high-volume purchase '||i,100.00,current_date,null,
   'c3000000-0000-4000-8000-000000000021','card',null,
   'c3000000-0000-4000-8000-000000000041',
   '[{"member_id":"c3000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
   1,null,'pr-v-create-'||i
  );
 end loop;
end
$fixture$;

select is(
 (select count(distinct invoice_id) from public.transactions
  where household_id='c3000000-0000-4000-8000-000000000010'
    and description like 'PR-V high-volume purchase %'
    and invoice_id is not null),
 1::bigint,
 'V01 all forty synthetic card purchases land on one invoice'
);

select is(
 (select count(*) from public.transactions
  where household_id='c3000000-0000-4000-8000-000000000010'
    and description like 'PR-V high-volume purchase %'),
 40::bigint,
 'V01b fixture contains exactly forty synthetic card purchases'
);

set local statement_timeout='8s';

select lives_ok($$
 select public.pay_card_invoice_idempotent(
  'c3000000-0000-4000-8000-000000000010',
  (select invoice_id from public.transactions
   where household_id='c3000000-0000-4000-8000-000000000010'
     and description='PR-V high-volume purchase 1'),
  'c3000000-0000-4000-8000-000000000031',
  'c3000000-0000-4000-8000-000000000021',
  4000.00,now(),'pr-v-high-volume-pay'
 )
$$,'V02 high-volume invoice payment completes within the 8-second statement timeout');

select lives_ok($$
 select public.pay_card_invoice_idempotent(
  'c3000000-0000-4000-8000-000000000010',
  (select invoice_id from public.transactions
   where household_id='c3000000-0000-4000-8000-000000000010'
     and description='PR-V high-volume purchase 1'),
  'c3000000-0000-4000-8000-000000000031',
  'c3000000-0000-4000-8000-000000000021',
  1200.00,now(),'pr-v-high-volume-pay'
 )
$$,'V03 retry with same idempotency key succeeds');

select is(
 (select count(*) from public.card_invoice_payments
  where household_id='c3000000-0000-4000-8000-000000000010'),
 1::bigint,
 'V04 exactly one canonical invoice payment exists after retry'
);

select is(
 (select coalesce(sum(amount),0) from public.money_movements
  where household_id='c3000000-0000-4000-8000-000000000010'
    and kind='invoice_payment'),
 4000.00::numeric,
 'V05 exactly one 4000 cash outflow is recorded'
);

select is(
 (select coalesce(sum(amount),0) from public.funding_events
  where household_id='c3000000-0000-4000-8000-000000000010'
    and invoice_id=(select invoice_id from public.transactions
      where household_id='c3000000-0000-4000-8000-000000000010'
        and description='PR-V high-volume purchase 1')),
 4000.00::numeric,
 'V06 funding allocation totals the paid invoice amount'
);

reset role;
select * from finish();
rollback;
