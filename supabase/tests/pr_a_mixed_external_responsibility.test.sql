begin;

create extension if not exists pgtap with schema extensions;
select plan(38);

-- Fixture isolada da PR A.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '73000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','pr-a-wallace@example.invalid',
  crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace PR A"}',now(),now()
);

insert into public.households(id,name)
values ('73000000-0000-4000-8000-000000000010','Casa PR A');

insert into public.household_members(id,household_id,profile_id,role)
values (
  '73000000-0000-4000-8000-000000000021',
  '73000000-0000-4000-8000-000000000010',
  '73000000-0000-4000-8000-000000000001','owner'
);

insert into public.accounts(id,household_id,name,type)
values ('73000000-0000-4000-8000-000000000031','73000000-0000-4000-8000-000000000010','Conta PR A','checking');

insert into public.account_ownerships(account_id,household_id,member_id)
values (
  '73000000-0000-4000-8000-000000000031',
  '73000000-0000-4000-8000-000000000010',
  '73000000-0000-4000-8000-000000000021'
);

insert into public.financial_parties(id,household_id,kind,name,created_by_member_id)
values
  ('73000000-0000-4000-8000-000000000041','73000000-0000-4000-8000-000000000010','person','Terceiro A','73000000-0000-4000-8000-000000000021'),
  ('73000000-0000-4000-8000-000000000042','73000000-0000-4000-8000-000000000010','person','Terceiro B','73000000-0000-4000-8000-000000000021');

set local role authenticated;
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);

-- A04: Casa paga R$100, assume R$60 e terceiro A assume R$40.
select lives_ok($$
  select public.create_and_settle_shared_expense_idempotent(
    '73000000-0000-4000-8000-000000000010',
    'PR-A04 shared expense',100.00,current_date,null,
    '73000000-0000-4000-8000-000000000021',
    '73000000-0000-4000-8000-000000000031',
    '73000000-0000-4000-8000-000000000021',
    '[{"member_id":"73000000-0000-4000-8000-000000000021","amount":"60.00","percentage":"60.0000"},{"party_id":"73000000-0000-4000-8000-000000000041","amount":"40.00","percentage":"40.0000"}]'::jsonb,
    null,null,'pr-a04'
  )
$$,'A04 shared expense command succeeds');
select is((select amount from public.transactions where household_id='73000000-0000-4000-8000-000000000010' and description='PR-A04 shared expense'),100.00::numeric,'A04 preserves gross economic fact');
select is((select coalesce(sum(amount),0) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='PR-A04 shared expense' and a.responsible_member_id is not null),60.00::numeric,'A04 Casa economic responsibility is 60');
select is((select coalesce(sum(amount),0) from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A04 shared expense' and o.kind='receivable' and o.counterparty_id='73000000-0000-4000-8000-000000000041'),40.00::numeric,'A04 creates receivable 40 from responsible third party');
select is((select coalesce(sum(amount),0) from public.funding_events f join public.transactions t on t.id=f.financed_transaction_id where t.description='PR-A04 shared expense'),100.00::numeric,'A04 Casa funding records gross 100 once');
select is((select count(*) from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A04 shared expense' and o.kind='payable'),0::bigint,'A04 creates no payable');

-- A05: Casa assume R$100; terceiro B paga R$100 sem devolução.
select lives_ok($$
  select public.create_externally_paid_expense(
    '73000000-0000-4000-8000-000000000010','PR-A05 external gift',100.00,current_date,null,
    '73000000-0000-4000-8000-000000000021',
    '[{"member_id":"73000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    '73000000-0000-4000-8000-000000000042',false,null,null,'pr-a05'
  )
$$,'A05 externally paid non-repayable expense succeeds');
select is((select coalesce(sum(e.amount),0) from public.external_payment_events e join public.transactions t on t.id=e.source_transaction_id where t.description='PR-A05 external gift'),100.00::numeric,'A05 external funding is gross 100');
select is((select count(*) from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A05 external gift' and o.kind='payable'),0::bigint,'A05 creates no payable');
select is((select realized_amount from public.transactions where description='PR-A05 external gift'),100.00::numeric,'A05 gross expense is realized by external funding');

-- A06: Casa assume R$100; terceiro B paga R$100 com devolução em 2x.
select lives_ok($$
  select public.create_externally_paid_expense_with_repayment_plan(
    '73000000-0000-4000-8000-000000000010','PR-A06 full reimbursement',100.00,current_date,null,
    '73000000-0000-4000-8000-000000000021',
    '[{"member_id":"73000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    '73000000-0000-4000-8000-000000000042','installments',2,current_date,
    '73000000-0000-4000-8000-000000000031',null,'pr-a06'
  )
$$,'A06 full reimbursement plan succeeds');
select is((select original_amount from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A06 full reimbursement' and o.kind='payable'),100.00::numeric,'A06 payable remains full Casa responsibility 100');
select is((select coalesce(sum(s.amount),0) from public.obligation_repayment_schedule_items s join public.financial_obligations o on o.id=s.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A06 full reimbursement'),100.00::numeric,'A06 repayment schedule closes 100');
select is((select coalesce(sum(p.amount),0) from public.commitment_funding_plans p join public.financial_obligations o on o.id=p.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A06 full reimbursement' and p.state='active'),100.00::numeric,'A06 funding plan closes 100');

-- A07: Casa R$60 + o próprio terceiro pagador A R$40; A paga R$100.
select lives_ok($$
  select public.create_externally_paid_expense_with_repayment_plan(
    '73000000-0000-4000-8000-000000000010','PR-A07 payer also responsible',100.00,current_date,null,
    '73000000-0000-4000-8000-000000000021',
    '[{"member_id":"73000000-0000-4000-8000-000000000021","amount":"60.00","percentage":"60.0000"},{"party_id":"73000000-0000-4000-8000-000000000041","amount":"40.00","percentage":"40.0000"}]'::jsonb,
    '73000000-0000-4000-8000-000000000041','installments',2,current_date,
    '73000000-0000-4000-8000-000000000031',null,'pr-a07'
  )
$$,'A07 mixed responsibility with same external payer succeeds');
select is((select coalesce(sum(e.amount),0) from public.external_payment_events e join public.transactions t on t.id=e.source_transaction_id where t.description='PR-A07 payer also responsible'),100.00::numeric,'A07 gross external funding remains 100');
select is((select coalesce(sum(a.amount),0) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='PR-A07 payer also responsible' and a.responsible_member_id is not null),60.00::numeric,'A07 Casa economic responsibility is 60');
select is((select original_amount from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A07 payer also responsible' and o.kind='payable'),60.00::numeric,'A07 Casa payable is limited to 60');
select is((select counterparty_id from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A07 payer also responsible' and o.kind='payable'),'73000000-0000-4000-8000-000000000041'::uuid,'A07 payable points to actual payer A');
select is((select coalesce(sum(s.amount),0) from public.obligation_repayment_schedule_items s join public.financial_obligations o on o.id=s.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A07 payer also responsible'),60.00::numeric,'A07 repayment schedule closes Casa share 60');
select is((select coalesce(sum(p.amount),0) from public.commitment_funding_plans p join public.financial_obligations o on o.id=p.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A07 payer also responsible' and p.state='active'),60.00::numeric,'A07 funding plan closes Casa share 60');
select is((select count(*) from public.transactions where description='PR-A07 payer also responsible'),1::bigint,'A07 creates one economic transaction');
select is((select coalesce(sum(f.amount),0) from public.financing_allocations f join public.transactions t on t.id=f.transaction_id where t.description='PR-A07 payer also responsible' and f.mechanism='external'),100.00::numeric,'A07 canonical external financing preserves gross 100');
select is((select count(*) from public.transaction_payment_instruments i join public.transactions t on t.id=i.transaction_id where t.description='PR-A07 payer also responsible'),0::bigint,'A07 does not invent Casa account/card instrument');

-- A08: Casa R$60 + terceiro A R$40; terceiro B paga R$100.
select lives_ok($$
  select public.create_externally_paid_expense_with_repayment_plan(
    '73000000-0000-4000-8000-000000000010','PR-A08 different payer',100.00,current_date,null,
    '73000000-0000-4000-8000-000000000021',
    '[{"member_id":"73000000-0000-4000-8000-000000000021","amount":"60.00","percentage":"60.0000"},{"party_id":"73000000-0000-4000-8000-000000000041","amount":"40.00","percentage":"40.0000"}]'::jsonb,
    '73000000-0000-4000-8000-000000000042','installments',3,current_date,
    '73000000-0000-4000-8000-000000000031',null,'pr-a08'
  )
$$,'A08 mixed responsibility with different external payer succeeds');
select is((select coalesce(sum(e.amount),0) from public.external_payment_events e join public.transactions t on t.id=e.source_transaction_id where t.description='PR-A08 different payer'),100.00::numeric,'A08 gross external funding remains 100');
select is((select coalesce(sum(a.amount),0) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='PR-A08 different payer' and a.responsible_member_id is not null),60.00::numeric,'A08 Casa economic responsibility is 60');
select is((select original_amount from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A08 different payer' and o.kind='payable'),60.00::numeric,'A08 payable to external payer B is limited to 60');
select is((select counterparty_id from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A08 different payer' and o.kind='payable'),'73000000-0000-4000-8000-000000000042'::uuid,'A08 payable points to payer B, not responsible party A');
select is((select coalesce(sum(s.amount),0) from public.obligation_repayment_schedule_items s join public.financial_obligations o on o.id=s.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A08 different payer'),60.00::numeric,'A08 repayment schedule closes 60');
select is((select count(*) from public.obligation_repayment_schedule_items s join public.financial_obligations o on o.id=s.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A08 different payer'),3::bigint,'A08 creates requested three repayment schedule items');
select is((select coalesce(sum(p.amount),0) from public.commitment_funding_plans p join public.financial_obligations o on o.id=p.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A08 different payer' and p.state='active'),60.00::numeric,'A08 funding plan closes Casa share 60');
select is((select count(*) from public.transactions where description='PR-A08 different payer'),1::bigint,'A08 creates one economic transaction');
select is((select coalesce(sum(f.amount),0) from public.financing_allocations f join public.transactions t on t.id=f.transaction_id where t.description='PR-A08 different payer' and f.mechanism='external'),100.00::numeric,'A08 canonical external financing preserves gross 100');
select is((select count(*) from public.transaction_payment_instruments i join public.transactions t on t.id=i.transaction_id where t.description='PR-A08 different payer'),0::bigint,'A08 does not invent Casa account/card instrument');

-- Limite de centavos: nenhuma parcela de devolução pode ter valor zero.
select throws_ok($$
  select public.create_externally_paid_expense_with_repayment_plan(
    '73000000-0000-4000-8000-000000000010','PR-A-cent-boundary',1.00,current_date,null,
    '73000000-0000-4000-8000-000000000021',
    '[{"member_id":"73000000-0000-4000-8000-000000000021","amount":"0.01","percentage":"1.0000"},{"party_id":"73000000-0000-4000-8000-000000000041","amount":"0.99","percentage":"99.0000"}]'::jsonb,
    '73000000-0000-4000-8000-000000000042','installments',2,current_date,
    '73000000-0000-4000-8000-000000000031',null,'pr-a-cent-boundary'
  )
$$,'22023','repayment installment count exceeds reimbursable cents','repayment rejects more installments than reimbursable cents');
select is((select count(*) from public.transactions where description='PR-A-cent-boundary'),0::bigint,'cent-boundary command rolls back economic transaction');
select is((select count(*) from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-A-cent-boundary'),0::bigint,'cent-boundary command rolls back payable');

reset role;
select * from finish();
rollback;
