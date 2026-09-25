begin;

set local time zone 'America/Sao_Paulo';

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
 ('c3000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-s-wallace@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace PR S"}',now(),now()),
 ('c3000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-s-gui@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Gui PR S"}',now(),now());

insert into public.households(id,name,financial_tracking_started_on,timezone)
values ('c3000000-0000-4000-8000-000000000010','Casa PR S',current_date,'America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role) values
 ('c3000000-0000-4000-8000-000000000021','c3000000-0000-4000-8000-000000000010','c3000000-0000-4000-8000-000000000001','owner'),
 ('c3000000-0000-4000-8000-000000000022','c3000000-0000-4000-8000-000000000010','c3000000-0000-4000-8000-000000000002','member');

insert into public.categories(id,household_id,name,type)
values ('c3000000-0000-4000-8000-000000000026','c3000000-0000-4000-8000-000000000010','Casa','expense');

insert into public.accounts(id,household_id,owner_member_id,name,type)
values ('c3000000-0000-4000-8000-000000000031','c3000000-0000-4000-8000-000000000010','c3000000-0000-4000-8000-000000000021','Conta Wallace PR S','checking');

insert into public.account_ownerships(account_id,household_id,member_id)
values ('c3000000-0000-4000-8000-000000000031','c3000000-0000-4000-8000-000000000010','c3000000-0000-4000-8000-000000000021');

insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day,default_payment_account_id)
values ('c3000000-0000-4000-8000-000000000041','c3000000-0000-4000-8000-000000000010','c3000000-0000-4000-8000-000000000021','Cartão PR S',5000,28,10,'c3000000-0000-4000-8000-000000000031');

set local role authenticated;
select set_config('request.jwt.claim.sub','c3000000-0000-4000-8000-000000000001',true);

select lives_ok($$
  select public.create_financial_transaction_idempotent(
    'c3000000-0000-4000-8000-000000000010','expense','PR-S refund purchase',600,current_date,
    'c3000000-0000-4000-8000-000000000026','c3000000-0000-4000-8000-000000000021',
    'card',null,'c3000000-0000-4000-8000-000000000041',
    '[{"member_id":"c3000000-0000-4000-8000-000000000021","amount":"300.00","percentage":"50.0000"},{"member_id":"c3000000-0000-4000-8000-000000000022","amount":"300.00","percentage":"50.0000"}]'::jsonb,
    3,null,'pr-s-refund-create'
  )
$$,'S01 shared installment card purchase succeeds');

select is(
  (select projected_outstanding
   from public.financial_member_settlement_positions
   where debtor_member_id='c3000000-0000-4000-8000-000000000022'
     and creditor_member_id='c3000000-0000-4000-8000-000000000021'),
  300.00::numeric,
  'S02 projected member settlement starts at 300'
);

select lives_ok($$
  select public.record_card_invoice_credit_refund(
    'c3000000-0000-4000-8000-000000000010',
    (select id from public.transactions where description='PR-S refund purchase'),
    (
      select i.invoice_id
      from public.installments i
      join public.installment_plans p on p.id=i.installment_plan_id
      join public.transactions t on t.id=p.purchase_transaction_id
      where t.description='PR-S refund purchase' and i.number=1
    ),
    100,now(),'Refund parcial PR S','pr-s-refund-100'
  )
$$,'S03 partial card refund succeeds');

select is(
  (select projected_outstanding
   from public.financial_member_settlement_positions
   where debtor_member_id='c3000000-0000-4000-8000-000000000022'
     and creditor_member_id='c3000000-0000-4000-8000-000000000021'),
  250.00::numeric,
  'S04 partial refund immediately reconciles projected member settlement'
);

select is(
  (select sum(a.amount)
   from public.economic_allocations a
   join public.transactions t on t.id=a.transaction_id
   where t.description='PR-S refund purchase'),
  500.00::numeric,
  'S05 refund rescales economic responsibility to the net purchase amount'
);

set local statement_timeout='0';

do $fixture$
declare
  i integer;
  tx uuid;
  start_date date:=current_date+1;
  end_date date:=(current_date+1+interval '11 months')::date;
begin
  for i in 1..10 loop
    tx:=public.create_and_settle_direct_expense_idempotent(
      'c3000000-0000-4000-8000-000000000010',
      'PR-S monthly source '||i,
      1.00,current_date,
      'c3000000-0000-4000-8000-000000000026',
      'c3000000-0000-4000-8000-000000000021',
      'c3000000-0000-4000-8000-000000000031',
      'c3000000-0000-4000-8000-000000000021',
      '[{"member_id":"c3000000-0000-4000-8000-000000000021","amount":"0.50","percentage":"50.0000"},{"member_id":"c3000000-0000-4000-8000-000000000022","amount":"0.50","percentage":"50.0000"}]'::jsonb,
      now(),null,'pr-s-source-'||i
    );

    perform public.create_recurring_expense_rule_from_transaction_idempotent(
      'c3000000-0000-4000-8000-000000000010',
      tx,'monthly',1,start_date,end_date,'pr-s-rule-'||i
    );
  end loop;
end
$fixture$;

select is(
  (select count(*) from public.recurring_rules
   where household_id='c3000000-0000-4000-8000-000000000010'
     and frequency='monthly'
     and interval_count=1
     and deactivated_at is null),
  10::bigint,
  'S06 ten monthly Release 1 rules exist'
);

set local statement_timeout='8s';

select lives_ok($$
  select public.ensure_household_recurring_expense_horizon(
    'c3000000-0000-4000-8000-000000000010',
    (current_date+1+interval '11 months')::date
  )
$$,'S07 ten monthly series materialize under authenticated timeout');

select is(
  (select count(*)::integer
   from public.recurring_occurrences
   where household_id='c3000000-0000-4000-8000-000000000010'),
  120,
  'S08 ten monthly series produce exactly 120 projected occurrences'
);

select is(
  (select count(*)
   from public.member_settlement_events e
   join public.recurring_occurrences o on o.transaction_id=e.source_transaction_id
   where o.household_id='c3000000-0000-4000-8000-000000000010'
     and e.state='projected'),
  120::bigint,
  'S09 each projected occurrence is reconciled once into the canonical settlement ledger'
);

reset role;
select * from finish();
rollback;
