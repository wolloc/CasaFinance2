begin;

set local time zone 'America/Sao_Paulo';
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users(
 id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
 (
  'c4100000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','pr-x-installment-owner@example.invalid',
  crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Invoice Installment Owner"}',now(),now()
 ),
 (
  'c4100000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','pr-x-installment-member@example.invalid',
  crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Invoice Installment Member"}',now(),now()
 );

insert into public.households(id,name,financial_tracking_started_on,timezone)
values ('c4100000-0000-4000-8000-000000000010','Casa PR X Installments',current_date,'America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role)
values
 ('c4100000-0000-4000-8000-000000000021','c4100000-0000-4000-8000-000000000010','c4100000-0000-4000-8000-000000000001','owner'),
 ('c4100000-0000-4000-8000-000000000022','c4100000-0000-4000-8000-000000000010','c4100000-0000-4000-8000-000000000002','member');

insert into public.accounts(id,household_id,owner_member_id,name,type)
values ('c4100000-0000-4000-8000-000000000031','c4100000-0000-4000-8000-000000000010','c4100000-0000-4000-8000-000000000021','Conta PR X Installments','checking');

insert into public.account_ownerships(account_id,household_id,member_id)
values
 ('c4100000-0000-4000-8000-000000000031','c4100000-0000-4000-8000-000000000010','c4100000-0000-4000-8000-000000000021'),
 ('c4100000-0000-4000-8000-000000000031','c4100000-0000-4000-8000-000000000010','c4100000-0000-4000-8000-000000000022');

insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day)
values ('c4100000-0000-4000-8000-000000000041','c4100000-0000-4000-8000-000000000010','c4100000-0000-4000-8000-000000000021','PR-X Mixed Installment High Volume',20000,20,28);

set local role authenticated;
select set_config('request.jwt.claim.sub','c4100000-0000-4000-8000-000000000001',true);
set local statement_timeout='0';

-- 36 direct purchases, 10 with 50/50 splits and 26 with 100% assigned to the owner.
-- The split table therefore contains 46 rows for these 36 direct purchases.
do $direct_fixture$
declare i integer; splits jsonb;
begin
 for i in 1..36 loop
  if i<=10 then
   splits:='[{"member_id":"c4100000-0000-4000-8000-000000000021","amount":"37.50","percentage":"50.0000"},{"member_id":"c4100000-0000-4000-8000-000000000022","amount":"37.50","percentage":"50.0000"}]'::jsonb;
  else
   splits:='[{"member_id":"c4100000-0000-4000-8000-000000000021","amount":"75.00","percentage":"100.0000"}]'::jsonb;
  end if;
  perform public.create_financial_transaction_idempotent(
   'c4100000-0000-4000-8000-000000000010','expense',
   'PR-X direct purchase '||i,75.00,current_date,null,
   'c4100000-0000-4000-8000-000000000021','card',null,
   'c4100000-0000-4000-8000-000000000041',splits,1,null,'pr-x-direct-create-'||i
  );
 end loop;
end
$direct_fixture$;

-- 13 installment plans of 2 x R$100: one R$100 installment from each plan
-- lands on the same invoice, contributing R$1,300 alongside R$2,700 direct spend.
do $installment_fixture$
declare i integer;
begin
 for i in 1..13 loop
  perform public.create_financial_transaction_idempotent(
   'c4100000-0000-4000-8000-000000000010','expense',
   'PR-X installment purchase '||i,200.00,current_date,null,
   'c4100000-0000-4000-8000-000000000021','card',null,
   'c4100000-0000-4000-8000-000000000041',
   '[{"member_id":"c4100000-0000-4000-8000-000000000021","amount":"100.00","percentage":"50.0000"},{"member_id":"c4100000-0000-4000-8000-000000000022","amount":"100.00","percentage":"50.0000"}]'::jsonb,
   2,null,'pr-x-installment-create-'||i
  );
 end loop;
end
$installment_fixture$;

select is(
 (select count(distinct invoice_id) from public.transactions
  where household_id='c4100000-0000-4000-8000-000000000010'
    and description like 'PR-X direct purchase %' and invoice_id is not null),
 1::bigint,
 'X01 all 36 direct purchases land on one invoice'
);

select is(
 (select count(*) from public.transactions
  where household_id='c4100000-0000-4000-8000-000000000010'
    and description like 'PR-X direct purchase %'),
 36::bigint,
 'X02 fixture contains exactly 36 direct purchases'
);

select is(
 (select count(*) from public.installments i
  join public.card_invoices ci on ci.id=i.invoice_id
  where i.household_id='c4100000-0000-4000-8000-000000000010'
    and ci.id=(select invoice_id from public.transactions
      where household_id='c4100000-0000-4000-8000-000000000010'
        and description='PR-X direct purchase 1')),
 13::bigint,
 'X03 target invoice contains 13 installment rows'
);

select is(
 (select total_amount from public.card_invoices
  where id=(select invoice_id from public.transactions
    where household_id='c4100000-0000-4000-8000-000000000010'
      and description='PR-X direct purchase 1')),
 4000.00::numeric,
 'X04 target invoice total is R$4,000 (R$2,700 direct + R$1,300 installments)'
);

select is(
 (select count(*) from public.transaction_splits ts
  join public.transactions t on t.id=ts.transaction_id
  where t.household_id='c4100000-0000-4000-8000-000000000010'
    and (t.description like 'PR-X direct purchase %' or t.description like 'PR-X installment purchase %')),
 72::bigint,
 'X05 mixed fixture contains 72 member split rows across direct and installment purchases'
);

set local statement_timeout='8s';

select lives_ok($$
 select public.pay_card_invoice_idempotent(
  'c4100000-0000-4000-8000-000000000010',
  (select invoice_id from public.transactions
   where household_id='c4100000-0000-4000-8000-000000000010'
     and description='PR-X direct purchase 1'),
  'c4100000-0000-4000-8000-000000000031',
  'c4100000-0000-4000-8000-000000000021',
  4000.00,now(),'pr-x-mixed-installment-pay'
 )
$$,'X06 mixed direct + installment invoice payment completes within 8 seconds');

select lives_ok($$
 select public.pay_card_invoice_idempotent(
  'c4100000-0000-4000-8000-000000000010',
  (select invoice_id from public.transactions
   where household_id='c4100000-0000-4000-8000-000000000010'
     and description='PR-X direct purchase 1'),
  'c4100000-0000-4000-8000-000000000031',
  'c4100000-0000-4000-8000-000000000021',
  4000.00,now(),'pr-x-mixed-installment-pay'
 )
$$,'X07 retry with same idempotency key succeeds');

select is(
 (select count(*) from public.card_invoice_payments
  where household_id='c4100000-0000-4000-8000-000000000010'),
 1::bigint,
 'X08 retry leaves exactly one canonical invoice payment'
);

select is(
 (select coalesce(sum(amount),0) from public.money_movements
  where household_id='c4100000-0000-4000-8000-000000000010'
    and kind='invoice_payment'),
 4000.00::numeric,
 'X09 retry leaves exactly one R$4,000 cash outflow'
);

select is(
 (select count(*) from public.funding_events
  where household_id='c4100000-0000-4000-8000-000000000010'
    and invoice_id=(select invoice_id from public.transactions
      where household_id='c4100000-0000-4000-8000-000000000010'
        and description='PR-X direct purchase 1')),
 49::bigint,
 'X10 exactly 49 funding rows cover 36 direct purchases and 13 installments'
);

select is(
 (select coalesce(sum(amount),0) from public.funding_events
  where household_id='c4100000-0000-4000-8000-000000000010'
    and invoice_id=(select invoice_id from public.transactions
      where household_id='c4100000-0000-4000-8000-000000000010'
        and description='PR-X direct purchase 1')),
 4000.00::numeric,
 'X11 funding total remains equal to the amount paid'
);

reset role;
select * from finish();
rollback;
