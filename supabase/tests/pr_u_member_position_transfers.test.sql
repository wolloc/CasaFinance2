begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('ab000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','position-a@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace"}',now(),now()),
 ('ab000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','position-b@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Guilherme"}',now(),now()),
 ('ab000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','position-outsider@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Outsider"}',now(),now());

insert into public.households(id,name) values
 ('ab000000-0000-4000-8000-000000000010','Casa Position'),
 ('ab000000-0000-4000-8000-000000000011','Casa Outsider');

insert into public.household_members(id,household_id,profile_id,role) values
 ('ab000000-0000-4000-8000-000000000021','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000001','owner'),
 ('ab000000-0000-4000-8000-000000000022','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000002','member'),
 ('ab000000-0000-4000-8000-000000000023','ab000000-0000-4000-8000-000000000011','ab000000-0000-4000-8000-000000000003','owner');

insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('ab000000-0000-4000-8000-000000000031','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000021','Wallace Itaú','checking'),
 ('ab000000-0000-4000-8000-000000000032','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000022','Guilherme Conta','checking'),
 ('ab000000-0000-4000-8000-000000000033','ab000000-0000-4000-8000-000000000010',null,'Conta conjunta','checking'),
 ('ab000000-0000-4000-8000-000000000034','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000021','Wallace secundária','checking');

insert into public.account_ownerships(account_id,household_id,member_id) values
 ('ab000000-0000-4000-8000-000000000031','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000021'),
 ('ab000000-0000-4000-8000-000000000032','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000022'),
 ('ab000000-0000-4000-8000-000000000033','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000021'),
 ('ab000000-0000-4000-8000-000000000033','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000022'),
 ('ab000000-0000-4000-8000-000000000034','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000021');

insert into public.account_balance_events(household_id,account_id,created_by_member_id,kind,amount,effective_date,description)
values
 ('ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000031','ab000000-0000-4000-8000-000000000021','opening',1000,current_date,'Opening Wallace'),
 ('ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000032','ab000000-0000-4000-8000-000000000021','opening',1000,current_date,'Opening Guilherme');

insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date)
values ('ab000000-0000-4000-8000-000000000051','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000021','adjustment','paid','realized','Saldo anterior entre membros',400,400,400,400,current_date,date_trunc('month',current_date)::date);

insert into public.member_settlement_events(
 id,household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,occurred_at,source_transaction_id
) values (
 'ab000000-0000-4000-8000-000000000061','ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000021',
 'ab000000-0000-4000-8000-000000000022','ab000000-0000-4000-8000-000000000021',400,'realized','adjustment',current_date,now(),'ab000000-0000-4000-8000-000000000051'
);

select is(
 (select realized_outstanding from public.financial_member_net_positions where debtor_member_id='ab000000-0000-4000-8000-000000000022' and creditor_member_id='ab000000-0000-4000-8000-000000000021'),
 400::numeric,
 'U01 initial normalized position shows Guilherme owing Wallace 400'
);

select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
set local role authenticated;

select lives_ok($$
 select public.create_member_position_transfer_idempotent(
  'ab000000-0000-4000-8000-000000000010',
  'ab000000-0000-4000-8000-000000000032',
  'ab000000-0000-4000-8000-000000000031',
  500,current_date,'Transferência Guilherme para Wallace','position-transfer-1'
 )
$$,'U02 cross-member position transfer succeeds');

select is(
 (select count(*) from public.money_movements where household_id='ab000000-0000-4000-8000-000000000010' and kind='member_settlement'),
 1::bigint,
 'U03 position transfer creates exactly one cash movement'
);

select is(
 (select count(*) from public.transactions where household_id='ab000000-0000-4000-8000-000000000010' and type='transfer'),
 1::bigint,
 'U04 position transfer keeps one transfer transaction wrapper'
);

select is(
 (select count(*) from public.transactions where household_id='ab000000-0000-4000-8000-000000000010' and type in ('income','expense')),
 0::bigint,
 'U05 position transfer creates neither income nor expense'
);

select is(
 (select count(*) from public.transfers where household_id='ab000000-0000-4000-8000-000000000010'),
 1::bigint,
 'U06 position transfer remains traceable as transfer'
);

select is(
 (select current_balance from public.financial_account_balances where account_id='ab000000-0000-4000-8000-000000000031'),
 1500::numeric,
 'U07 destination balance increases once'
);

select is(
 (select current_balance from public.financial_account_balances where account_id='ab000000-0000-4000-8000-000000000032'),
 500::numeric,
 'U08 source balance decreases once'
);

select is(
 (select count(*) from public.financial_member_net_positions where debtor_member_id='ab000000-0000-4000-8000-000000000022' and creditor_member_id='ab000000-0000-4000-8000-000000000021' and realized_outstanding>0),
 0::bigint,
 'U09 original direction disappears after crossing zero'
);

select is(
 (select realized_outstanding from public.financial_member_net_positions where debtor_member_id='ab000000-0000-4000-8000-000000000021' and creditor_member_id='ab000000-0000-4000-8000-000000000022'),
 100::numeric,
 'U10 excess transfer reverses the net position by 100'
);

select is(
 (select public.create_member_position_transfer_idempotent(
  'ab000000-0000-4000-8000-000000000010',
  'ab000000-0000-4000-8000-000000000032',
  'ab000000-0000-4000-8000-000000000031',
  500,current_date,'Transferência Guilherme para Wallace','position-transfer-1'
 )),
 (select transaction_id from public.transfers where household_id='ab000000-0000-4000-8000-000000000010' limit 1),
 'U11 retry returns the same transfer'
);

select is(
 (select count(*) from public.money_movements where household_id='ab000000-0000-4000-8000-000000000010' and kind='member_settlement'),
 1::bigint,
 'U12 retry never duplicates cash movement'
);

select throws_ok($$
 select public.create_member_position_transfer_idempotent(
  'ab000000-0000-4000-8000-000000000010',
  'ab000000-0000-4000-8000-000000000033',
  'ab000000-0000-4000-8000-000000000031',
  10,current_date,'Joint ambiguous','joint-position'
 )
$$,'23514','member position transfer requires one active owner per account','U13 joint ownership is never silently inferred');

select throws_ok($$
 select public.create_member_position_transfer_idempotent(
  'ab000000-0000-4000-8000-000000000010',
  'ab000000-0000-4000-8000-000000000034',
  'ab000000-0000-4000-8000-000000000031',
  10,current_date,'Same owner','same-owner-position'
 )
$$,'23514','member position transfer requires distinct account owners','U14 same-owner transfer cannot affect member position');

select throws_ok($$
 select public.create_member_position_transfer_idempotent(
  'ab000000-0000-4000-8000-000000000010',
  'ab000000-0000-4000-8000-000000000032',
  'ab000000-0000-4000-8000-000000000031',
  10,current_date+1,'Future movement','future-position'
 )
$$,'22023','valid realized transfer data required','U15 future transfer cannot alter realized member position');

reset role;
select * from finish();
rollback;
