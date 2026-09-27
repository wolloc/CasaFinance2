begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('ab000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-transfer-a@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace"}',now(),now()),
 ('ab000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-transfer-b@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Guilherme"}',now(),now());

insert into public.households(id,name) values
 ('ab000000-0000-4000-8000-000000000010','Casa posição contínua');

insert into public.household_members(id,household_id,profile_id,role) values
 ('ab000000-0000-4000-8000-000000000021','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000001','owner'),
 ('ab000000-0000-4000-8000-000000000022','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000002','member');

insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('ab000000-0000-4000-8000-000000000031','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000021','Conta Wallace','checking'),
 ('ab000000-0000-4000-8000-000000000032','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000022','Conta Guilherme','checking');

insert into public.account_ownerships(account_id,household_id,member_id) values
 ('ab000000-0000-4000-8000-000000000031','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000021'),
 ('ab000000-0000-4000-8000-000000000032','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000022');

-- Before the transfer, Guilherme has R$ 4.000 with Wallace.
insert into public.transactions(
 id,household_id,created_by_member_id,buyer_member_id,type,status,economic_state,description,amount,
 estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date
) values(
 'ab000000-0000-4000-8000-000000000041','ab000000-0000-4000-8000-000000000010',
 'ab000000-0000-4000-8000-000000000021','ab000000-0000-4000-8000-000000000022','expense','paid','realized','Compromissos de Guilherme pagos por Wallace',4000,
 4000,4000,4000,current_date,date_trunc('month',current_date)::date
);

insert into public.member_settlement_events(
 household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,
 state,kind,financial_date,occurred_at,source_transaction_id
) values(
 'ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000021',
 'ab000000-0000-4000-8000-000000000022','ab000000-0000-4000-8000-000000000021',4000,
 'realized','adjustment',current_date,now(),'ab000000-0000-4000-8000-000000000041'
);

select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000002',true);
set local role authenticated;

select lives_ok($$
  select public.create_member_position_transfer_idempotent(
   'ab000000-0000-4000-8000-000000000010',
   'ab000000-0000-4000-8000-000000000032',
   'ab000000-0000-4000-8000-000000000031',
   5000,current_date,'Transferência Guilherme para Wallace','transfer-cross-zero-1'
  )
$$,'U01 cross-member transfer can cross zero');

select is(
 (select count(*)::integer from public.money_movements
  where household_id='ab000000-0000-4000-8000-000000000010'
    and kind='member_settlement' and amount=5000),
 1,
 'U02 transfer creates exactly one cash movement'
);

select is(
 (select count(*)::integer from public.transactions
  where household_id='ab000000-0000-4000-8000-000000000010' and type='transfer'),
 1,
 'U03 transfer is recorded as one neutral transfer transaction'
);

select is(
 (select count(*)::integer from public.transactions
  where household_id='ab000000-0000-4000-8000-000000000010' and type in ('income','expense')),
 1,
 'U04 member transfer creates no second income or expense fact'
);

select is(
 (select net_position from public.financial_member_settlement_positions
  where household_id='ab000000-0000-4000-8000-000000000010'
    and debtor_member_id='ab000000-0000-4000-8000-000000000021'
    and creditor_member_id='ab000000-0000-4000-8000-000000000022'),
 1000::numeric,
 'U05 excess transfer inverts the position: Wallace now has R$ 1.000 with Guilherme'
);

select is(
 (select net_position from public.financial_member_settlement_positions
  where household_id='ab000000-0000-4000-8000-000000000010'
    and debtor_member_id='ab000000-0000-4000-8000-000000000022'
    and creditor_member_id='ab000000-0000-4000-8000-000000000021'),
 -1000::numeric,
 'U06 opposite row exposes the same net position with inverse sign'
);

select is(
 (select count(*)::integer from public.member_settlement_events
  where household_id='ab000000-0000-4000-8000-000000000010'
    and source_money_movement_id is not null and amount=5000),
 1,
 'U07 the position effect is linked to the same cash movement'
);

select is(
 public.create_member_position_transfer_idempotent(
   'ab000000-0000-4000-8000-000000000010',
   'ab000000-0000-4000-8000-000000000032',
   'ab000000-0000-4000-8000-000000000031',
   5000,current_date,'Transferência Guilherme para Wallace','transfer-cross-zero-1'
 ),
 (select id from public.transactions
  where household_id='ab000000-0000-4000-8000-000000000010' and type='transfer' limit 1),
 'U08 retry returns the original transfer'
);

select is(
 (select count(*)::integer from public.money_movements
  where household_id='ab000000-0000-4000-8000-000000000010'
    and kind='member_settlement' and amount=5000),
 1,
 'U09 retry never duplicates cash'
);

reset role;
select * from finish();
rollback;
