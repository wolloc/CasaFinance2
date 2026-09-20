begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('8b000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-k-owner@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Owner PR K"}',now(),now()),
 ('8b000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-k-member@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Member PR K"}',now(),now()),
 ('8b000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-k-other@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Other PR K"}',now(),now());

insert into public.households(id,name,timezone)
values
 ('8b000000-0000-4000-8000-000000000010','Casa PR K','America/Sao_Paulo'),
 ('8b000000-0000-4000-8000-000000000011','Casa PR K Datas','America/Sao_Paulo');

insert into public.household_members(id,household_id,profile_id,role)
values
 ('8b000000-0000-4000-8000-000000000021','8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000001','owner'),
 ('8b000000-0000-4000-8000-000000000022','8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000002','member'),
 ('8b000000-0000-4000-8000-000000000023','8b000000-0000-4000-8000-000000000011','8b000000-0000-4000-8000-000000000003','owner');

insert into public.accounts(id,household_id,owner_member_id,name,type,institution,opening_balance)
values
 ('8b000000-0000-4000-8000-000000000031','8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000021','Conta legado A','checking','Banco A',999),
 ('8b000000-0000-4000-8000-000000000032','8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000022','Conta legado B','checking','Banco B',777),
 ('8b000000-0000-4000-8000-000000000033','8b000000-0000-4000-8000-000000000011','8b000000-0000-4000-8000-000000000023','Conta datas','checking','Banco Datas',555);

-- Efeitos canônicos antigos já existentes no Staging antes do corte.
insert into public.account_balance_events(
  household_id,account_id,created_by_member_id,kind,amount,effective_date,description
) values
 ('8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000031','8b000000-0000-4000-8000-000000000021','adjustment',100,current_date-6,'Ajuste histórico'),
 ('8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000031','8b000000-0000-4000-8000-000000000021','adjustment',20,current_date-5,'Ajuste no corte');

insert into public.money_movements(
  household_id,created_by_member_id,kind,state,amount,description,destination_account_id,movement_date,competence_date,realized_at
) values
 ('8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000021','adjustment','realized',50,'Entrada histórica','8b000000-0000-4000-8000-000000000031',current_date-7,date_trunc('month',current_date-7)::date,(current_date-7)::timestamptz),
 ('8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000021','adjustment','realized',5,'Entrada no corte','8b000000-0000-4000-8000-000000000032',current_date-5,date_trunc('month',current_date-5)::date,(current_date-5)::timestamptz);

insert into public.money_movements(
  household_id,created_by_member_id,kind,state,amount,description,source_account_id,movement_date,competence_date,realized_at
) values
 ('8b000000-0000-4000-8000-000000000010','8b000000-0000-4000-8000-000000000021','adjustment','realized',10,'Saída no corte','8b000000-0000-4000-8000-000000000031',current_date-5,date_trunc('month',current_date-5)::date,(current_date-5)::timestamptz);

select is(
  (select current_balance from public.financial_account_balances where account_id='8b000000-0000-4000-8000-000000000031'),
  160::numeric,
  'K01 antes do corte o read model ainda preserva todo o histórico canônico'
);

select is(
  (select count(*) from public.account_ownerships where household_id='8b000000-0000-4000-8000-000000000010'),
  0::bigint,
  'K02 titularidade legada ainda não é promovida automaticamente'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000001',true);

select throws_ok(
  $$select public.reconcile_existing_accounts_at_cutoff_idempotent(
    '8b000000-0000-4000-8000-000000000010',current_date-5,
    '[{"account_id":"8b000000-0000-4000-8000-000000000031","opening_amount":"500.00","owner_member_ids":["8b000000-0000-4000-8000-000000000021"]}]'::jsonb,
    'k-incomplete'
  )$$,
  '23514',
  'all active household accounts must be reconciled together',
  'K03 corte rejeita payload parcial e não deixa conta de fora'
);

select is(
  (select financial_tracking_started_on from public.households where id='8b000000-0000-4000-8000-000000000010'),
  null::date,
  'K04 falha parcial não fixa a data de corte'
);

select lives_ok(
  $$select public.reconcile_existing_accounts_at_cutoff_idempotent(
    '8b000000-0000-4000-8000-000000000010',current_date-5,
    '[
      {"account_id":"8b000000-0000-4000-8000-000000000031","opening_amount":"500.00","owner_member_ids":["8b000000-0000-4000-8000-000000000021"]},
      {"account_id":"8b000000-0000-4000-8000-000000000032","opening_amount":"200.00","owner_member_ids":["8b000000-0000-4000-8000-000000000021","8b000000-0000-4000-8000-000000000022"]}
    ]'::jsonb,
    'k-cutover'
  )$$,
  'K05 reconciliação explícita fecha todas as contas existentes atomicamente'
);

select is(
  (select financial_tracking_started_on from public.households where id='8b000000-0000-4000-8000-000000000010'),
  current_date-5,
  'K06 data de corte fica registrada na Casa'
);

select is(
  (select count(*) from public.account_balance_events where household_id='8b000000-0000-4000-8000-000000000010' and kind='opening' and reversed_at is null),
  2::bigint,
  'K07 cada conta existente recebe uma única abertura canônica'
);

select is(
  (select opening_balance from public.accounts where id='8b000000-0000-4000-8000-000000000031'),
  999::numeric,
  'K08 campo legado permanece intacto e não é reinterpretado'
);

select is(
  (select count(*) from public.account_ownerships where account_id='8b000000-0000-4000-8000-000000000031'),
  1::bigint,
  'K09 conta individual recebe titularidade canônica confirmada'
);

select is(
  (select count(*) from public.account_ownerships where account_id='8b000000-0000-4000-8000-000000000032'),
  2::bigint,
  'K10 conta conjunta recebe dois titulares explícitos'
);

select is(
  (select current_balance from public.financial_account_balances where account_id='8b000000-0000-4000-8000-000000000031'),
  510::numeric,
  'K11 saldo parte da abertura e preserva efeitos ocorridos na própria data de corte'
);

select is(
  (select current_balance from public.financial_account_balances where account_id='8b000000-0000-4000-8000-000000000032'),
  205::numeric,
  'K12 movimento no dia do corte continua compondo o saldo'
);

select is(
  (select count(*) from public.transactions where household_id='8b000000-0000-4000-8000-000000000010'),
  0::bigint,
  'K13 reconciliação não cria renda, despesa ou ajuste econômico'
);

select is(
  (select count(*) from public.money_movements where household_id='8b000000-0000-4000-8000-000000000010'),
  3::bigint,
  'K14 reconciliação não inventa movimento de caixa'
);

select is(
  (select count(*) from public.funding_events where household_id='8b000000-0000-4000-8000-000000000010'),
  0::bigint,
  'K15 reconciliação não inventa funding'
);

select lives_ok(
  $$select public.reconcile_existing_accounts_at_cutoff_idempotent(
    '8b000000-0000-4000-8000-000000000010',current_date-5,
    '[
      {"account_id":"8b000000-0000-4000-8000-000000000031","opening_amount":"500.00","owner_member_ids":["8b000000-0000-4000-8000-000000000021"]},
      {"account_id":"8b000000-0000-4000-8000-000000000032","opening_amount":"200.00","owner_member_ids":["8b000000-0000-4000-8000-000000000021","8b000000-0000-4000-8000-000000000022"]}
    ]'::jsonb,
    'k-cutover'
  )$$,
  'K16 retry com a mesma chave é idempotente'
);

select is(
  (select count(*) from public.account_balance_events where household_id='8b000000-0000-4000-8000-000000000010' and kind='opening' and reversed_at is null),
  2::bigint,
  'K17 retry não duplica posições iniciais'
);

select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000003',true);

select throws_ok(
  $$select public.reconcile_existing_accounts_at_cutoff_idempotent(
    '8b000000-0000-4000-8000-000000000011',
    ((current_timestamp at time zone 'America/Sao_Paulo')::date + 1),
    '[{"account_id":"8b000000-0000-4000-8000-000000000033","opening_amount":"300.00","owner_member_ids":["8b000000-0000-4000-8000-000000000023"]}]'::jsonb,
    'k-future-cutoff'
  )$$,
  '22023',
  'financial tracking start must be today or earlier in household timezone',
  'K18 comando público rejeita data futura no fuso financeiro da Casa'
);

reset role;
select * from finish();
rollback;
