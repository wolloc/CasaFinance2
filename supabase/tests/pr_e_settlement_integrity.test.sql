begin;

create extension if not exists pgtap with schema extensions;
select plan(37);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('79000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-e-wallace@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace PR E"}',now(),now());

insert into public.households(id,name)
values ('79000000-0000-4000-8000-000000000010','Casa PR E');

insert into public.household_members(id,household_id,profile_id,role)
values ('79000000-0000-4000-8000-000000000021','79000000-0000-4000-8000-000000000010','79000000-0000-4000-8000-000000000001','owner');

insert into public.accounts(id,household_id,owner_member_id,name,type) values
  ('79000000-0000-4000-8000-000000000031','79000000-0000-4000-8000-000000000010','79000000-0000-4000-8000-000000000021','Conta PR E','checking');
insert into public.account_ownerships(account_id,household_id,member_id)
values ('79000000-0000-4000-8000-000000000031','79000000-0000-4000-8000-000000000010','79000000-0000-4000-8000-000000000021');

insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day) values
  ('79000000-0000-4000-8000-000000000041','79000000-0000-4000-8000-000000000010','79000000-0000-4000-8000-000000000021','PR-E Full',10000,20,28),
  ('79000000-0000-4000-8000-000000000042','79000000-0000-4000-8000-000000000010','79000000-0000-4000-8000-000000000021','PR-E Partial',10000,20,28);

insert into public.financial_parties(id,household_id,kind,name,created_by_member_id)
values ('79000000-0000-4000-8000-000000000051','79000000-0000-4000-8000-000000000010','person','Robson PR E','79000000-0000-4000-8000-000000000021');

set local role authenticated;
select set_config('request.jwt.claim.sub','79000000-0000-4000-8000-000000000001',true);

-- A17: pagamento integral de fatura. A compra continua sendo a única despesa.
select lives_ok($$
  select public.create_financial_transaction_idempotent(
    '79000000-0000-4000-8000-000000000010','expense','PR-E A17 full invoice',100.00,current_date,null,
    '79000000-0000-4000-8000-000000000021','card',null,'79000000-0000-4000-8000-000000000041',
    '[{"member_id":"79000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    1,null,'pr-e-a17-create'
  )
$$,'A17 card purchase succeeds');
select lives_ok($$
  select public.pay_card_invoice_idempotent(
    '79000000-0000-4000-8000-000000000010',
    (select invoice_id from public.transactions where description='PR-E A17 full invoice'),
    '79000000-0000-4000-8000-000000000031','79000000-0000-4000-8000-000000000021',
    100.00,now(),'pr-e-a17-pay'
  )
$$,'A17 full invoice payment succeeds');
select is((select count(*) from public.transactions where description='PR-E A17 full invoice' and type='expense'),1::bigint,'A17 original expense exists exactly once');
select is((select count(*) from public.transactions where household_id='79000000-0000-4000-8000-000000000010' and type='invoice_payment' and amount=100.00),1::bigint,'A17 settlement is invoice_payment, not expense');
select is((select count(*) from public.money_movements m join public.transactions t on t.invoice_id=m.invoice_id where t.description='PR-E A17 full invoice' and m.kind='invoice_payment'),1::bigint,'A17 creates one cash outflow');
select is((select sum(m.amount) from public.money_movements m join public.transactions t on t.invoice_id=m.invoice_id where t.description='PR-E A17 full invoice' and m.kind='invoice_payment'),100.00::numeric,'A17 cash outflow is exactly 100');
select is((select count(*) from public.card_invoice_payments p join public.transactions t on t.invoice_id=p.invoice_id where t.description='PR-E A17 full invoice'),1::bigint,'A17 has one canonical invoice payment record');
select is((select sum(f.amount) from public.funding_events f join public.transactions t on t.id=f.financed_transaction_id where t.description='PR-E A17 full invoice' and f.invoice_id is not null),100.00::numeric,'A17 funding closes underlying card purchase by 100');
select is((select remaining_amount from public.financial_card_invoice_positions p join public.transactions t on t.invoice_id=p.invoice_id where t.description='PR-E A17 full invoice'),0::numeric,'A17 invoice remaining is zero');
select is((select state::text from public.financial_card_invoice_positions p join public.transactions t on t.invoice_id=p.invoice_id where t.description='PR-E A17 full invoice'),'paid'::text,'A17 invoice position is paid');
select is((select coalesce(sum(remaining_amount),0) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-E A17 full invoice')),0::numeric,'A17 underlying commitment has no remaining amount');

-- A18: pagamento parcial de fatura mantém somente o saldo ainda não liquidado.
select lives_ok($$
  select public.create_financial_transaction_idempotent(
    '79000000-0000-4000-8000-000000000010','expense','PR-E A18 partial invoice',100.00,current_date,null,
    '79000000-0000-4000-8000-000000000021','card',null,'79000000-0000-4000-8000-000000000042',
    '[{"member_id":"79000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    1,null,'pr-e-a18-create'
  )
$$,'A18 card purchase succeeds');
select lives_ok($$
  select public.pay_card_invoice_idempotent(
    '79000000-0000-4000-8000-000000000010',
    (select invoice_id from public.transactions where description='PR-E A18 partial invoice'),
    '79000000-0000-4000-8000-000000000031','79000000-0000-4000-8000-000000000021',
    40.00,now(),'pr-e-a18-pay'
  )
$$,'A18 partial invoice payment succeeds');
select is((select count(*) from public.transactions where description='PR-E A18 partial invoice' and type='expense'),1::bigint,'A18 original expense exists exactly once');
select is((select count(*) from public.money_movements m join public.transactions t on t.invoice_id=m.invoice_id where t.description='PR-E A18 partial invoice' and m.kind='invoice_payment'),1::bigint,'A18 creates one cash outflow');
select is((select sum(m.amount) from public.money_movements m join public.transactions t on t.invoice_id=m.invoice_id where t.description='PR-E A18 partial invoice' and m.kind='invoice_payment'),40.00::numeric,'A18 cash outflow is exactly 40');
select is((select sum(f.amount) from public.funding_events f join public.transactions t on t.id=f.financed_transaction_id where t.description='PR-E A18 partial invoice' and f.invoice_id is not null),40.00::numeric,'A18 funding records exactly 40');
select is((select paid_amount from public.financial_card_invoice_positions p join public.transactions t on t.invoice_id=p.invoice_id where t.description='PR-E A18 partial invoice'),40.00::numeric,'A18 invoice paid amount is 40');
select is((select remaining_amount from public.financial_card_invoice_positions p join public.transactions t on t.invoice_id=p.invoice_id where t.description='PR-E A18 partial invoice'),60.00::numeric,'A18 invoice remaining is 60');
select is((select coalesce(sum(remaining_amount),0) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-E A18 partial invoice')),60.00::numeric,'A18 underlying commitment keeps only 60 remaining');
select is((select count(*) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-E A18 partial invoice') and economic_type='invoice_payment'),0::bigint,'A18 invoice payment is not a second Gastos commitment');

-- A19: terceiro pagou R$100, obrigação 2x50; devolução parcial de R$60.
select lives_ok($$
  select public.create_externally_paid_expense_with_repayment_plan(
    '79000000-0000-4000-8000-000000000010','PR-E A19 external reimbursement',100.00,current_date,null,
    '79000000-0000-4000-8000-000000000021',
    '[{"member_id":"79000000-0000-4000-8000-000000000021","amount":"100.00","percentage":"100.0000"}]'::jsonb,
    '79000000-0000-4000-8000-000000000051','installments',2,current_date,
    '79000000-0000-4000-8000-000000000031',null,'pr-e-a19-create'
  )
$$,'A19 external expense and repayment schedule succeed');
select lives_ok($$
  select public.settle_financial_obligation_idempotent(
    '79000000-0000-4000-8000-000000000010',
    (select o.id from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-E A19 external reimbursement' and o.kind='payable'),
    '79000000-0000-4000-8000-000000000031',60.00,now(),
    '79000000-0000-4000-8000-000000000021',null,'pr-e-a19-pay'
  )
$$,'A19 partial obligation payment succeeds');
select is((select count(*) from public.transactions where description='PR-E A19 external reimbursement' and type='expense'),1::bigint,'A19 original expense remains exactly once');
select is((select count(*) from public.money_movements m join public.financial_obligations o on o.id=m.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-E A19 external reimbursement' and m.kind='payable_payment'),1::bigint,'A19 creates one payable cash outflow');
select is((select sum(m.amount) from public.money_movements m join public.financial_obligations o on o.id=m.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-E A19 external reimbursement' and m.kind='payable_payment'),60.00::numeric,'A19 cash outflow is exactly 60');
select is((select sum(e.amount) from public.obligation_events e join public.financial_obligations o on o.id=e.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-E A19 external reimbursement' and e.kind='payment'),60.00::numeric,'A19 obligation event records 60 payment');
select is((select outstanding_amount from public.financial_obligation_balances b join public.financial_obligations o on o.id=b.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-E A19 external reimbursement' and o.kind='payable'),40.00::numeric,'A19 obligation remaining is 40');
select is((select o.state::text from public.financial_obligations o join public.transactions t on t.id=o.source_transaction_id where t.description='PR-E A19 external reimbursement' and o.kind='payable'),'partially_settled'::text,'A19 obligation is partially settled');
select is((select sum(f.amount) from public.funding_events f join public.transactions t on t.id=f.financed_transaction_id where t.description='PR-E A19 external reimbursement' and f.invoice_id is null),60.00::numeric,'A19 settlement funding records 60 against original expense');
select is((select count(*) from public.transactions where household_id='79000000-0000-4000-8000-000000000010' and type='expense' and description='Liquidação de obrigação'),0::bigint,'A19 obligation liquidation does not create expense');
select is((select realized_amount from public.obligation_repayment_schedule_positions p join public.financial_obligations o on o.id=p.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-E A19 external reimbursement' and p.number=1),50.00::numeric,'A19 first scheduled repayment is fully realized FIFO');
select is((select remaining_amount from public.obligation_repayment_schedule_positions p join public.financial_obligations o on o.id=p.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-E A19 external reimbursement' and p.number=1),0.00::numeric,'A19 first scheduled repayment has zero remaining');
select is((select realized_amount from public.obligation_repayment_schedule_positions p join public.financial_obligations o on o.id=p.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-E A19 external reimbursement' and p.number=2),10.00::numeric,'A19 second scheduled repayment realizes 10 FIFO');
select is((select remaining_amount from public.obligation_repayment_schedule_positions p join public.financial_obligations o on o.id=p.obligation_id join public.transactions t on t.id=o.source_transaction_id where t.description='PR-E A19 external reimbursement' and p.number=2),40.00::numeric,'A19 second scheduled repayment keeps 40 remaining');
select is((select coalesce(sum(remaining_amount),0) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-E A19 external reimbursement') and source_obligation_id is not null),40.00::numeric,'A19 commitments keep exactly 40 remaining');
select is((select count(*) from public.financial_commitment_positions where source_transaction_id=(select id from public.transactions where description='PR-E A19 external reimbursement') and economic_type='expense'),0::bigint,'A19 repayment schedule is not represented as new economic expense');

select * from finish();
rollback;
