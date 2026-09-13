begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('76000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-c-wallace@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace PR C"}',now(),now()),
 ('76000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-c-guilherme@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Guilherme PR C"}',now(),now());

insert into public.households(id,name) values ('76000000-0000-4000-8000-000000000010','Casa PR C');
insert into public.household_members(id,household_id,profile_id,role) values
 ('76000000-0000-4000-8000-000000000021','76000000-0000-4000-8000-000000000010','76000000-0000-4000-8000-000000000001','owner'),
 ('76000000-0000-4000-8000-000000000022','76000000-0000-4000-8000-000000000010','76000000-0000-4000-8000-000000000002','member');
insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('76000000-0000-4000-8000-000000000031','76000000-0000-4000-8000-000000000010','76000000-0000-4000-8000-000000000021','Conta PR C','checking');
insert into public.account_ownerships(account_id,household_id,member_id) values
 ('76000000-0000-4000-8000-000000000031','76000000-0000-4000-8000-000000000010','76000000-0000-4000-8000-000000000021');
insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day,default_payment_account_id) values
 ('76000000-0000-4000-8000-000000000041','76000000-0000-4000-8000-000000000010','76000000-0000-4000-8000-000000000021','Cartão PR C',10000,20,28,'76000000-0000-4000-8000-000000000031');
insert into public.financial_parties(id,household_id,kind,name,created_by_member_id) values
 ('76000000-0000-4000-8000-000000000051','76000000-0000-4000-8000-000000000010','person','Terceiro PR C','76000000-0000-4000-8000-000000000021'),
 ('76000000-0000-4000-8000-000000000052','76000000-0000-4000-8000-000000000010','person','Pagador PR C','76000000-0000-4000-8000-000000000021');

set local role authenticated;
select set_config('request.jwt.claim.sub','76000000-0000-4000-8000-000000000001',true);

-- Cartão 12x: também funciona como reprodução controlada do timeout observado em staging.
select is(
  public.create_financial_transaction_idempotent(
    '76000000-0000-4000-8000-000000000010','expense','PR-C card 12x',120.00,current_date,null,
    '76000000-0000-4000-8000-000000000021','card',null,'76000000-0000-4000-8000-000000000041',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"120.00","percentage":"100.0000"}]'::jsonb,12,null,'pr-c-card-12x'
  ),
  public.create_financial_transaction_idempotent(
    '76000000-0000-4000-8000-000000000010','expense','PR-C card 12x',120.00,current_date,null,
    '76000000-0000-4000-8000-000000000021','card',null,'76000000-0000-4000-8000-000000000041',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"120.00","percentage":"100.0000"}]'::jsonb,12,null,'pr-c-card-12x'
  ),
  'C01 same request key returns the same 12x card transaction'
);
select is((select count(*) from public.transactions where description='PR-C card 12x'),1::bigint,'C02 12x card creates one economic transaction');
select is((select count(*) from public.installments i join public.installment_plans p on p.id=i.installment_plan_id join public.transactions t on t.id=p.purchase_transaction_id where t.description='PR-C card 12x'),12::bigint,'C03 12x card creates exactly twelve installments and did not reproduce the staging timeout in isolated CI');

-- Pagamento imediato por conta.
select is(
  public.create_and_settle_direct_expense_idempotent(
    '76000000-0000-4000-8000-000000000010','PR-C direct',80.00,current_date,null,
    '76000000-0000-4000-8000-000000000021','76000000-0000-4000-8000-000000000031','76000000-0000-4000-8000-000000000021',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"80.00","percentage":"100.0000"}]'::jsonb,
    (current_date::timestamp + time '12:00') at time zone 'UTC',null,'pr-c-direct'
  ),
  public.create_and_settle_direct_expense_idempotent(
    '76000000-0000-4000-8000-000000000010','PR-C direct',80.00,current_date,null,
    '76000000-0000-4000-8000-000000000021','76000000-0000-4000-8000-000000000031','76000000-0000-4000-8000-000000000021',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"80.00","percentage":"100.0000"}]'::jsonb,
    (current_date::timestamp + time '12:00') at time zone 'UTC',null,'pr-c-direct'
  ),
  'C04 direct account replay returns the same result'
);
select is((select count(*) from public.transactions where description='PR-C direct'),1::bigint,'C05 direct account creates one economic expense');
select is((select count(*) from public.money_movements m join public.transactions t on t.id=m.related_transaction_id where t.description='PR-C direct' and m.kind='expense_payment'),1::bigint,'C06 direct account creates one cash movement');
select is((select count(*) from public.funding_events f join public.transactions t on t.id=f.financed_transaction_id where t.description='PR-C direct'),1::bigint,'C07 direct account creates one funding event');

-- Conta paga gasto com responsabilidade mista membro + terceiro.
select is(
  public.create_and_settle_shared_expense_idempotent(
    '76000000-0000-4000-8000-000000000010','PR-C shared',100.00,current_date,null,
    '76000000-0000-4000-8000-000000000021','76000000-0000-4000-8000-000000000031','76000000-0000-4000-8000-000000000021',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"60.00","percentage":"60.0000"},{"party_id":"76000000-0000-4000-8000-000000000051","amount":"40.00","percentage":"40.0000"}]'::jsonb,
    null,null,'pr-c-shared'
  ),
  public.create_and_settle_shared_expense_idempotent(
    '76000000-0000-4000-8000-000000000010','PR-C shared',100.00,current_date,null,
    '76000000-0000-4000-8000-000000000021','76000000-0000-4000-8000-000000000031','76000000-0000-4000-8000-000000000021',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"60.00","percentage":"60.0000"},{"party_id":"76000000-0000-4000-8000-000000000051","amount":"40.00","percentage":"40.0000"}]'::jsonb,
    null,null,'pr-c-shared'
  ),
  'C08 shared responsibility replay returns the same result'
);
select is((select count(*) from public.transactions where description='PR-C shared'),1::bigint,'C09 shared path creates one economic expense');
select is((select count(*) from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-C shared' and o.kind='receivable'),1::bigint,'C10 shared path creates one receivable');
select is((select coalesce(sum(f.amount),0) from public.funding_events f join public.transactions t on t.id=f.financed_transaction_id where t.description='PR-C shared'),100.00::numeric,'C11 shared path funds gross amount exactly once');

-- PIX financiado por cartão com encargos.
select is(
  public.create_simple_card_pix_expense(
    '76000000-0000-4000-8000-000000000010','PR-C card pix',100.00,8.00,current_date,null,
    '76000000-0000-4000-8000-000000000021','76000000-0000-4000-8000-000000000041',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"8.00","percentage":"100.0000"}]'::jsonb,
    2,null,'pr-c-card-pix'
  ),
  public.create_simple_card_pix_expense(
    '76000000-0000-4000-8000-000000000010','PR-C card pix',100.00,8.00,current_date,null,
    '76000000-0000-4000-8000-000000000021','76000000-0000-4000-8000-000000000041',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"8.00","percentage":"100.0000"}]'::jsonb,
    2,null,'pr-c-card-pix'
  ),
  'C12 card PIX replay returns the same principal transaction'
);
select is((select count(*) from public.transactions where description='PR-C card pix'),1::bigint,'C13 card PIX principal exists once');
select is((select count(*) from public.transactions where description='Encargos financeiros PIX no cartão — PR-C card pix'),1::bigint,'C14 card PIX financial charge exists once');
select is((select count(*) from public.transaction_links l join public.transactions t on t.id=l.source_transaction_id where t.description='PR-C card pix' and l.kind='fee'),1::bigint,'C15 card PIX principal-to-charge link exists once');

-- Terceiro paga sem devolução.
select is(
  public.create_externally_paid_expense(
    '76000000-0000-4000-8000-000000000010','PR-C external gift',70.00,current_date,null,
    '76000000-0000-4000-8000-000000000021',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"70.00","percentage":"100.0000"}]'::jsonb,
    '76000000-0000-4000-8000-000000000052',false,null,null,'pr-c-external-gift'
  ),
  public.create_externally_paid_expense(
    '76000000-0000-4000-8000-000000000010','PR-C external gift',70.00,current_date,null,
    '76000000-0000-4000-8000-000000000021',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"70.00","percentage":"100.0000"}]'::jsonb,
    '76000000-0000-4000-8000-000000000052',false,null,null,'pr-c-external-gift'
  ),
  'C16 external non-repayable replay returns the same transaction'
);
select is((select count(*) from public.transactions where description='PR-C external gift'),1::bigint,'C17 external non-repayable creates one economic expense');
select is((select count(*) from public.external_payment_events e join public.transactions t on t.id=e.source_transaction_id where t.description='PR-C external gift'),1::bigint,'C18 external non-repayable creates one funding event');

-- Terceiro paga com plano de devolução.
select is(
  public.create_externally_paid_expense_with_repayment_plan(
    '76000000-0000-4000-8000-000000000010','PR-C external repay',90.00,current_date,null,
    '76000000-0000-4000-8000-000000000021',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"90.00","percentage":"100.0000"}]'::jsonb,
    '76000000-0000-4000-8000-000000000052','installments',2,current_date,
    '76000000-0000-4000-8000-000000000031',null,'pr-c-external-repay'
  ),
  public.create_externally_paid_expense_with_repayment_plan(
    '76000000-0000-4000-8000-000000000010','PR-C external repay',90.00,current_date,null,
    '76000000-0000-4000-8000-000000000021',
    '[{"member_id":"76000000-0000-4000-8000-000000000021","amount":"90.00","percentage":"100.0000"}]'::jsonb,
    '76000000-0000-4000-8000-000000000052','installments',2,current_date,
    '76000000-0000-4000-8000-000000000031',null,'pr-c-external-repay'
  ),
  'C19 external repayment replay returns the same transaction'
);
select is((select count(*) from public.transactions where description='PR-C external repay'),1::bigint,'C20 external repayment creates one economic expense');
select is((select count(*) from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-C external repay' and o.kind='payable'),1::bigint,'C21 external repayment creates one payable');
select is((select count(*) from public.obligation_repayment_schedule_items s join public.financial_obligations o on o.id=s.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-C external repay'),2::bigint,'C22 external repayment creates exactly two schedule items');
select is((select count(*) from public.commitment_funding_plans p join public.financial_obligations o on o.id=p.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-C external repay' and p.state='active'),1::bigint,'C23 external repayment creates one funding plan');

reset role;
select * from finish();
rollback;
