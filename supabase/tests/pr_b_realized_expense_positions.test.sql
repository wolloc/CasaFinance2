begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
(
  '74000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','pr-b-wallace@example.invalid',
  crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace PR B"}',now(),now()
),
(
  '74000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','pr-b-guilherme@example.invalid',
  crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Guilherme PR B"}',now(),now()
);

insert into public.profiles(id,display_name)
values
  ('74000000-0000-4000-8000-000000000001','Wallace PR B'),
  ('74000000-0000-4000-8000-000000000002','Guilherme PR B')
on conflict (id) do nothing;

insert into public.households(id,name)
values ('74000000-0000-4000-8000-000000000010','Casa PR B');

insert into public.household_members(id,household_id,profile_id,role)
values
  ('74000000-0000-4000-8000-000000000021','74000000-0000-4000-8000-000000000010','74000000-0000-4000-8000-000000000001','owner'),
  ('74000000-0000-4000-8000-000000000022','74000000-0000-4000-8000-000000000010','74000000-0000-4000-8000-000000000002','member');

insert into public.financial_parties(id,household_id,kind,name,created_by_member_id)
values ('74000000-0000-4000-8000-000000000041','74000000-0000-4000-8000-000000000010','person','Terceiro PR B','74000000-0000-4000-8000-000000000021');

insert into public.transactions(
  id,household_id,created_by_member_id,buyer_member_id,type,status,description,amount,
  transaction_date,competence_date,settled_at,economic_state,confirmed_amount,realized_amount
) values
(
  '74000000-0000-4000-8000-000000000051','74000000-0000-4000-8000-000000000010',
  '74000000-0000-4000-8000-000000000021','74000000-0000-4000-8000-000000000021',
  'expense','paid','PR-B realized mixed',100.00,current_date,date_trunc('month',current_date)::date,now(),'realized',100.00,100.00
),
(
  '74000000-0000-4000-8000-000000000052','74000000-0000-4000-8000-000000000010',
  '74000000-0000-4000-8000-000000000021','74000000-0000-4000-8000-000000000021',
  'expense','pending','PR-B confirmed only',50.00,current_date,date_trunc('month',current_date)::date,null,'confirmed',50.00,0
),
(
  '74000000-0000-4000-8000-000000000053','74000000-0000-4000-8000-000000000010',
  '74000000-0000-4000-8000-000000000021','74000000-0000-4000-8000-000000000021',
  'expense','paid','PR-B legacy realized',25.00,current_date,date_trunc('month',current_date)::date,now(),'realized',25.00,25.00
);

insert into public.economic_allocations(
  household_id,transaction_id,responsible_member_id,responsible_party_id,allocation_order,amount,percentage
) values
  ('74000000-0000-4000-8000-000000000010','74000000-0000-4000-8000-000000000051','74000000-0000-4000-8000-000000000021',null,1,30.00,30.0000),
  ('74000000-0000-4000-8000-000000000010','74000000-0000-4000-8000-000000000051','74000000-0000-4000-8000-000000000022',null,2,30.00,30.0000),
  ('74000000-0000-4000-8000-000000000010','74000000-0000-4000-8000-000000000051',null,'74000000-0000-4000-8000-000000000041',3,40.00,40.0000),
  ('74000000-0000-4000-8000-000000000010','74000000-0000-4000-8000-000000000052','74000000-0000-4000-8000-000000000021',null,1,50.00,100.0000);

select is(
  (select gross_event_amount from public.financial_transaction_positions where transaction_id='74000000-0000-4000-8000-000000000051'),
  100.00::numeric,
  'B01 canonical position preserves gross realized fact'
);
select is(
  (select household_economic_amount from public.financial_transaction_positions where transaction_id='74000000-0000-4000-8000-000000000051'),
  60.00::numeric,
  'B02 consolidated member responsibility is 60, not gross 100'
);
select is(
  (select third_party_economic_amount from public.financial_transaction_positions where transaction_id='74000000-0000-4000-8000-000000000051'),
  40.00::numeric,
  'B03 third-party responsibility remains separate at 40'
);
select is(
  (select coalesce(sum(amount),0) from public.economic_allocations where transaction_id='74000000-0000-4000-8000-000000000051' and responsible_member_id is not null),
  60.00::numeric,
  'B04 both Casa members remain individually attributable under the consolidated 60'
);
select is(
  (select economic_state::text from public.financial_transaction_positions where transaction_id='74000000-0000-4000-8000-000000000052'),
  'confirmed'::text,
  'B05 confirmed economic fact remains distinguishable from realized'
);
select is(
  (select household_economic_amount from public.financial_transaction_positions where transaction_id='74000000-0000-4000-8000-000000000052'),
  50.00::numeric,
  'B06 confirmed member share is preserved without making it realized'
);
select is(
  (select household_economic_amount from public.financial_transaction_positions where transaction_id='74000000-0000-4000-8000-000000000053'),
  25.00::numeric,
  'B07 legacy transaction without allocations falls back to its gross amount'
);
select is(
  (select count(*) from public.financial_transaction_positions where household_id='74000000-0000-4000-8000-000000000010' and economic_state='realized'),
  2::bigint,
  'B08 canonical read model can isolate the two realized facts from the confirmed one'
);

select * from finish();
rollback;
