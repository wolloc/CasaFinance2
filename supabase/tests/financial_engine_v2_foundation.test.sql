begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

select is(public.financial_effective_total_amount('forecast', 250, null, 0), 250::numeric, 'forecast uses its estimate');
select is(public.financial_effective_total_amount('confirmed', 250, 287.43, 0), 287.43::numeric, 'confirmation supersedes forecast');
select is(public.financial_effective_total_amount('confirmed', 250, 287.43, 100), 287.43::numeric, 'partial realization does not supersede confirmed total');
select is(public.financial_remaining_amount('confirmed', 250, 287.43, 100), 187.43::numeric, 'remaining subtracts partial realization');
select is(public.financial_effective_total_amount('realized', 250, 287.43, 287.43), 287.43::numeric, 'complete realization is effective');
select is(public.financial_remaining_amount('realized', 250, 287.43, 287.43), 0::numeric, 'complete realization has no remainder');
select is(public.financial_remaining_amount('realized', 250, 287.43, 300), 0::numeric, 'remaining is clamped at zero');
select is(public.financial_effective_total_amount('cancelled', 250, 287.43, 100), 0::numeric, 'cancelled event has no effective total');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '20000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'v2.foundation@example.invalid',
  crypt('test-only', gen_salt('bf')), now(), '{}', '{"display_name":"V2 Foundation"}', now(), now()
);

insert into public.households (id, name)
values ('20000000-0000-4000-8000-000000000002', 'Casa V2 Foundation');
insert into public.household_members (id, household_id, profile_id, role)
values (
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000001',
  'owner'
);
insert into public.accounts (id, household_id, owner_member_id, name, type, opening_balance)
values (
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  'Conta de teste', 'checking', 123.45
);

select is((select overdraft_enabled from public.accounts where id='20000000-0000-4000-8000-000000000004'), false, 'overdraft defaults to disabled');
select is((select overdraft_limit from public.accounts where id='20000000-0000-4000-8000-000000000004'), 0::numeric, 'overdraft limit defaults to zero');
select throws_ok(
  $$insert into public.accounts (household_id, owner_member_id, name, type, overdraft_limit)
    values ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'LIS inválido', 'checking', -0.01)$$,
  '23514', null, 'negative overdraft limit is rejected'
);
update public.accounts set overdraft_enabled=true, overdraft_limit=2000
 where id='20000000-0000-4000-8000-000000000004';
select is((select opening_balance from public.accounts where id='20000000-0000-4000-8000-000000000004'), 123.45::numeric, 'enabling overdraft does not alter existing balance metadata');

select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
insert into public.transactions (
  id, household_id, created_by_member_id, buyer_member_id, type, status,
  economic_state, description, amount, estimated_amount, confirmed_amount,
  realized_amount, transaction_date, competence_date
) values (
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000003',
  'expense', 'pending', 'confirmed', 'Despesa parcial', 1000, 1000, 1000, 0,
  current_date, date_trunc('month', current_date)::date
);
insert into public.transaction_payment_instruments (household_id, transaction_id, kind, account_id)
values (
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000005',
  'account', '20000000-0000-4000-8000-000000000004'
);

set local role authenticated;
select lives_ok(
  $$select public.settle_direct_expense(
    '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 400
  )$$,
  'partial settlement succeeds atomically'
);
select is((select realized_amount from public.transactions where id='20000000-0000-4000-8000-000000000005'), 400::numeric, 'partial settlement records 400 realized');
select is((select economic_state::text from public.transactions where id='20000000-0000-4000-8000-000000000005'), 'confirmed', 'partial settlement remains confirmed');
select is((select public.financial_remaining_amount(economic_state,estimated_amount,confirmed_amount,realized_amount,amount) from public.transactions where id='20000000-0000-4000-8000-000000000005'), 600::numeric, 'partial settlement leaves 600 remaining');
select throws_ok(
  $$select public.settle_direct_expense(
    '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 601
  )$$,
  '23514', 'expense funding exceeds economic amount', 'settlement cannot exceed applicable total'
);
select is((select realized_amount from public.transactions where id='20000000-0000-4000-8000-000000000005'), 400::numeric, 'rejected over-settlement is atomic');
select lives_ok(
  $$select public.settle_direct_expense(
    '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 600
  )$$,
  'final settlement succeeds atomically'
);
select is((select realized_amount from public.transactions where id='20000000-0000-4000-8000-000000000005'), 1000::numeric, 'final settlement records full realization');
select is((select economic_state::text from public.transactions where id='20000000-0000-4000-8000-000000000005'), 'realized', 'full settlement realizes the expense');
select is((select public.financial_remaining_amount(economic_state,estimated_amount,confirmed_amount,realized_amount,amount) from public.transactions where id='20000000-0000-4000-8000-000000000005'), 0::numeric, 'full settlement leaves zero remaining');

select * from finish();
rollback;
