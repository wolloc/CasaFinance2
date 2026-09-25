begin;

set local time zone 'America/Sao_Paulo';

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
 ('9f000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','month-owner@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Month Owner"}',now(),now()),
 ('9f000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','month-outsider@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Month Outsider"}',now(),now());

insert into public.households(id,name,financial_tracking_started_on,timezone)
values (
  '9f000000-0000-4000-8000-000000000010',
  'Casa Reference Month',
  (date_trunc('month',current_date)-interval '2 months'+interval '14 days')::date,
  'America/Sao_Paulo'
);

insert into public.household_members(id,household_id,profile_id,role)
values (
  '9f000000-0000-4000-8000-000000000021',
  '9f000000-0000-4000-8000-000000000010',
  '9f000000-0000-4000-8000-000000000001',
  'owner'
);

insert into public.accounts(id,household_id,owner_member_id,name,type,resource_restriction) values
 ('9f000000-0000-4000-8000-000000000031','9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000021','Conta principal','checking',null),
 ('9f000000-0000-4000-8000-000000000032','9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000021','Carteira','digital_wallet',null),
 ('9f000000-0000-4000-8000-000000000033','9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000021','Reserva','checking','reserve'),
 ('9f000000-0000-4000-8000-000000000034','9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000021','Benefício','meal_benefit',null),
 ('9f000000-0000-4000-8000-000000000035','9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000021','Investimento','investment',null);

insert into public.account_ownerships(account_id,household_id,member_id)
select id,household_id,'9f000000-0000-4000-8000-000000000021'::uuid
from public.accounts
where household_id='9f000000-0000-4000-8000-000000000010';

insert into public.account_balance_events(
  household_id,account_id,created_by_member_id,kind,amount,effective_date,description,reversed_at
) values
 ('9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000031','9f000000-0000-4000-8000-000000000021','opening',1000,(date_trunc('month',current_date)-interval '2 months'+interval '14 days')::date,'Abertura principal',null),
 ('9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000033','9f000000-0000-4000-8000-000000000021','opening',500,(date_trunc('month',current_date)-interval '2 months'+interval '14 days')::date,'Abertura reserva',null),
 ('9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000034','9f000000-0000-4000-8000-000000000021','opening',300,(date_trunc('month',current_date)-interval '2 months'+interval '14 days')::date,'Abertura benefício',null),
 ('9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000035','9f000000-0000-4000-8000-000000000021','opening',700,(date_trunc('month',current_date)-interval '2 months'+interval '14 days')::date,'Abertura investimento',null),
 ('9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000031','9f000000-0000-4000-8000-000000000021','adjustment',200,(date_trunc('month',current_date)-interval '2 months'+interval '17 days')::date,'Ajuste rastreável',null),
 ('9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000031','9f000000-0000-4000-8000-000000000021','adjustment',999,(date_trunc('month',current_date)-interval '2 months'+interval '18 days')::date,'Ajuste revertido',now()),
 ('9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000031','9f000000-0000-4000-8000-000000000021','adjustment',50,(date_trunc('month',current_date)-interval '1 month'+interval '1 day')::date,'Ajuste mês seguinte',null);

insert into public.money_movements(
  household_id,created_by_member_id,kind,state,amount,description,
  beneficiary_member_id,source_account_id,destination_account_id,
  movement_date,competence_date,realized_at
) values
 ('9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000021','income','realized',400,'Entrada realizada',
  '9f000000-0000-4000-8000-000000000021',null,'9f000000-0000-4000-8000-000000000031',
  (date_trunc('month',current_date)-interval '2 months'+interval '19 days')::date,(date_trunc('month',current_date)-interval '2 months')::date,now()),
 ('9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000021','expense_payment','realized',150,'Saída realizada',
  null,'9f000000-0000-4000-8000-000000000031',null,
  (date_trunc('month',current_date)-interval '2 months'+interval '20 days')::date,(date_trunc('month',current_date)-interval '2 months')::date,now()),
 ('9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000021','transfer','realized',100,'Transferência interna',
  null,'9f000000-0000-4000-8000-000000000031','9f000000-0000-4000-8000-000000000032',
  (date_trunc('month',current_date)-interval '2 months'+interval '21 days')::date,(date_trunc('month',current_date)-interval '2 months')::date,now()),
 ('9f000000-0000-4000-8000-000000000010','9f000000-0000-4000-8000-000000000021','income','projected',1000,'Entrada só projetada',
  '9f000000-0000-4000-8000-000000000021',null,'9f000000-0000-4000-8000-000000000031',
  (date_trunc('month',current_date)-interval '2 months'+interval '22 days')::date,(date_trunc('month',current_date)-interval '2 months')::date,null);

set local role authenticated;
select set_config('request.jwt.claim.sub','9f000000-0000-4000-8000-000000000001',true);

select is(
  public.financial_available_cash_at_date(
    '9f000000-0000-4000-8000-000000000010',
    (date_trunc('month',current_date)-interval '2 months'+interval '13 days')::date
  ),
  null::numeric,
  'P01 cash before canonical cutover is unavailable, not fabricated'
);

select is(
  public.financial_available_cash_at_date(
    '9f000000-0000-4000-8000-000000000010',
    (date_trunc('month',current_date)-interval '1 month'-interval '1 day')::date
  ),
  1450::numeric,
  'P02 historical cash uses canonical unrestricted realized ledger only'
);

select is(
  public.financial_available_cash_at_date(
    '9f000000-0000-4000-8000-000000000010',
    (date_trunc('month',current_date)-interval '1 day')::date
  ),
  1500::numeric,
  'P03 later historical cash chains from dated facts without snapshot persistence'
);

select is(
  (select period_kind from public.financial_reference_month_context(
    '9f000000-0000-4000-8000-000000000010',
    (date_trunc('month',current_date)-interval '2 months')::date
  )),
  'past',
  'P04 closed tracked month is explicitly past'
);

select is(
  (select coverage_state from public.financial_reference_month_context(
    '9f000000-0000-4000-8000-000000000010',
    (date_trunc('month',current_date)-interval '2 months')::date
  )),
  'partial',
  'P05 cutover inside a month marks historical coverage partial'
);

select is(
  (select historical_opening_cash from public.financial_reference_month_context(
    '9f000000-0000-4000-8000-000000000010',
    (date_trunc('month',current_date)-interval '2 months')::date
  )),
  null::numeric,
  'P06 first partial month does not invent a pre-cutover opening cash'
);

select is(
  (select historical_closing_cash from public.financial_reference_month_context(
    '9f000000-0000-4000-8000-000000000010',
    (date_trunc('month',current_date)-interval '2 months')::date
  )),
  1450::numeric,
  'P07 first tracked month closes from canonical dated facts'
);

select ok(
  (select can_navigate from public.financial_reference_month_context(
    '9f000000-0000-4000-8000-000000000010',
    (date_trunc('month',current_date)-interval '2 months')::date
  )),
  'P08 partial tracked month is navigable'
);

select is(
  (select coverage_state from public.financial_reference_month_context(
    '9f000000-0000-4000-8000-000000000010',
    (date_trunc('month',current_date)-interval '3 months')::date
  )),
  'unavailable',
  'P09 month fully before cutover is unavailable'
);

select ok(
  not (select can_navigate from public.financial_reference_month_context(
    '9f000000-0000-4000-8000-000000000010',
    (date_trunc('month',current_date)-interval '3 months')::date
  )),
  'P10 month fully before cutover cannot be selected'
);

select results_eq(
  $$select coverage_state,historical_opening_cash,historical_closing_cash
      from public.financial_reference_month_context(
        '9f000000-0000-4000-8000-000000000010',
        (date_trunc('month',current_date)-interval '1 month')::date
      )$$,
  $$values ('full'::text,1450::numeric,1500::numeric)$$,
  'P11 later historical month has full coverage and chained opening/closing cash'
);

select results_eq(
  $$select period_kind,historical_closing_cash
      from public.financial_reference_month_context(
        '9f000000-0000-4000-8000-000000000010',
        date_trunc('month',current_date)::date
      )$$,
  $$values ('current'::text,null::numeric)$$,
  'P12 current month is not mislabeled as a closed historical snapshot'
);

select results_eq(
  $$select period_kind,historical_closing_cash
      from public.financial_reference_month_context(
        '9f000000-0000-4000-8000-000000000010',
        (date_trunc('month',current_date)+interval '1 month')::date
      )$$,
  $$values ('future'::text,null::numeric)$$,
  'P13 future month is reserved for projection, not historical facts'
);

select throws_ok(
  $$select * from public.financial_reference_month_context(
    '9f000000-0000-4000-8000-000000000010',
    (date_trunc('month',current_date)-interval '1 month'+interval '1 day')::date
  )$$,
  '22023',
  'reference month must be the first day of a month',
  'P14 reference month must be canonical month start'
);

select set_config('request.jwt.claim.sub','9f000000-0000-4000-8000-000000000002',true);

select throws_ok(
  $$select public.financial_available_cash_at_date(
    '9f000000-0000-4000-8000-000000000010',
    current_date
  )$$,
  '42501',
  'active household membership required',
  'P15 another authenticated user cannot read household history'
);

select * from finish();
rollback;
