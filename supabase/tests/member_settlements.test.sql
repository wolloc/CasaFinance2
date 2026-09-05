begin;

create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('23000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-a@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Member A"}',now(),now()),
 ('23000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-b@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Member B"}',now(),now()),
 ('23000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Outsider"}',now(),now());
insert into public.households(id,name) values
 ('23000000-0000-4000-8000-000000000010','Settlement house'),
 ('23000000-0000-4000-8000-000000000011','Other house');
insert into public.household_members(id,household_id,profile_id,role) values
 ('23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000001','owner'),
 ('23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000002','member'),
 ('23000000-0000-4000-8000-000000000023','23000000-0000-4000-8000-000000000011','23000000-0000-4000-8000-000000000003','owner');
insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('23000000-0000-4000-8000-000000000031','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','A source','checking'),
 ('23000000-0000-4000-8000-000000000032','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','B destination','checking');
insert into public.account_ownerships(account_id,household_id,member_id) values
 ('23000000-0000-4000-8000-000000000031','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021'),
 ('23000000-0000-4000-8000-000000000032','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022');

insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date)
values
 ('23000000-0000-4000-8000-000000000051','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','expense','pending','confirmed','Origin A',500,500,500,0,current_date,date_trunc('month',current_date)::date),
 ('23000000-0000-4000-8000-000000000052','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','expense','pending','confirmed','Origin B',80,80,80,0,current_date,date_trunc('month',current_date)::date);

-- Preserve opposite gross origins: B owes A 500 while A owes B 80.
insert into public.member_settlement_events(id,household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,occurred_at,source_transaction_id)
values
 ('23000000-0000-4000-8000-000000000041','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',500,'realized','adjustment',current_date,now(),'23000000-0000-4000-8000-000000000051'),
 ('23000000-0000-4000-8000-000000000042','23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000022',80,'realized','adjustment',current_date,now(),'23000000-0000-4000-8000-000000000052');

select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),500::numeric,'gross B to A is preserved');
select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000021'),80::numeric,'opposite gross A to B is preserved');
select is((select net_position from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),420::numeric,'net is informational only');
select throws_ok($$insert into public.member_settlement_events(household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date) values('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000021','23000000-0000-4000-8000-000000000021',1,'projected','adjustment',current_date)$$,'23514',null,'self-settlement is rejected');

select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.create_member_settlement_schedule('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',300,current_date+30,'schedule-1','future payment')$$,'schedule can be created');
select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),500::numeric,'schedule does not reduce realized debt');
select is((select scheduled_settlement_amount from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),300::numeric,'schedule is exposed separately');
select is((select public.create_member_settlement_schedule('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',300,current_date+30,'schedule-1','future payment')),(select id from public.member_settlement_schedules where idempotency_key='schedule-1'),'schedule retry is idempotent');
select throws_ok($$select public.create_member_settlement_schedule('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',301,current_date+30,'schedule-1','future payment')$$,'23505','idempotency key already used with different schedule data','idempotency conflict is strict');

select lives_ok($$select public.settle_member_position('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',200,'23000000-0000-4000-8000-000000000032','23000000-0000-4000-8000-000000000031')$$,'partial settlement succeeds');
select is((select realized_outstanding from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),300::numeric,'partial settlement leaves 300');
select is((select count(*) from public.transactions),2::bigint,'settlement creates no income or expense transaction');
select is((select count(*) from public.money_movements where kind='member_settlement'),1::bigint,'settlement creates one neutral money movement');
select throws_ok($$select public.settle_member_position('23000000-0000-4000-8000-000000000010','23000000-0000-4000-8000-000000000022','23000000-0000-4000-8000-000000000021',301,'23000000-0000-4000-8000-000000000032','23000000-0000-4000-8000-000000000031')$$,'23514','settlement exceeds realized outstanding position','over-settlement is rejected');
select is((select count(*) from public.money_movements where kind='member_settlement'),1::bigint,'rejected over-settlement is atomic');

select lives_ok($$select public.cancel_member_settlement_schedule('23000000-0000-4000-8000-000000000010',(select id from public.member_settlement_schedules where idempotency_key='schedule-1'))$$,'schedule can be cancelled');
select is((select count(*) from public.member_settlement_schedules where idempotency_key='schedule-1'),1::bigint,'cancel preserves schedule history');
select is((select coalesce(scheduled_settlement_amount,0) from public.financial_member_settlement_positions where debtor_member_id='23000000-0000-4000-8000-000000000022'),0::numeric,'cancelled schedule has no future impact');

select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000003',true);
select is((select count(*) from public.member_settlement_events where household_id='23000000-0000-4000-8000-000000000010'),0::bigint,'RLS hides another household ledger');

-- Functional reconciliation fixtures live in a separate household so the
-- existing ledger/schedule regression totals above remain isolated.
reset role;
insert into public.households(id,name) values ('23000000-0000-4000-8000-000000000012','Reconciliation house');
insert into public.household_members(id,household_id,profile_id,role) values
 ('23000000-0000-4000-8000-000000000024','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000001','owner'),
 ('23000000-0000-4000-8000-000000000025','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000002','member');
insert into public.accounts(id,household_id,owner_member_id,name,type) values
 ('23000000-0000-4000-8000-000000000033','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000024','Individual owner W','checking'),
 ('23000000-0000-4000-8000-000000000034','23000000-0000-4000-8000-000000000012',null,'Joint','checking');
insert into public.account_ownerships(account_id,household_id,member_id) values
 ('23000000-0000-4000-8000-000000000033','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000024'),
 ('23000000-0000-4000-8000-000000000034','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000024'),
 ('23000000-0000-4000-8000-000000000034','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000025');

-- Four economic events and four neutral funding transaction references.
insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date)
select id,'23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000024',kind::public.transaction_kind,'pending','confirmed',description,amount,amount,amount,0,current_date,date_trunc('month',current_date)::date
from (values
 ('23000000-0000-4000-8000-000000000061'::uuid,'expense','Shared',300::numeric),
 ('23000000-0000-4000-8000-000000000062'::uuid,'expense','Equal',300::numeric),
 ('23000000-0000-4000-8000-000000000063'::uuid,'expense','Owner differs from funder',300::numeric),
 ('23000000-0000-4000-8000-000000000064'::uuid,'expense','Joint funding',600::numeric),
 ('23000000-0000-4000-8000-000000000071'::uuid,'adjustment','Funding shared',300::numeric),
 ('23000000-0000-4000-8000-000000000072'::uuid,'adjustment','Funding equal',300::numeric),
 ('23000000-0000-4000-8000-000000000073'::uuid,'adjustment','Funding by Gui',300::numeric),
 ('23000000-0000-4000-8000-000000000074'::uuid,'adjustment','Funding joint',600::numeric)
) v(id,kind,description,amount);
insert into public.economic_allocations(household_id,transaction_id,responsible_member_id,allocation_order,amount,percentage) values
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000061','23000000-0000-4000-8000-000000000024',1,150,50),
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000061','23000000-0000-4000-8000-000000000025',2,150,50),
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000062','23000000-0000-4000-8000-000000000024',1,300,100),
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000063','23000000-0000-4000-8000-000000000025',1,300,100),
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000064','23000000-0000-4000-8000-000000000024',1,600,100);
insert into public.funding_events(household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,amount,funded_at) values
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000061','23000000-0000-4000-8000-000000000071','23000000-0000-4000-8000-000000000024','23000000-0000-4000-8000-000000000033',300,now()),
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000062','23000000-0000-4000-8000-000000000072','23000000-0000-4000-8000-000000000024','23000000-0000-4000-8000-000000000033',300,now()),
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000063','23000000-0000-4000-8000-000000000073','23000000-0000-4000-8000-000000000025','23000000-0000-4000-8000-000000000033',300,now()),
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000064','23000000-0000-4000-8000-000000000074','23000000-0000-4000-8000-000000000024','23000000-0000-4000-8000-000000000034',600,now());

select is((select amount from public.member_settlement_events where source_transaction_id='23000000-0000-4000-8000-000000000061'),150::numeric,'shared expense realizes Gui to Wallace 150');
select is((select count(*) from public.member_settlement_events where source_transaction_id='23000000-0000-4000-8000-000000000062'),0::bigint,'funding equal to responsibility creates no settlement');
select is((select count(*) from public.member_settlement_events where source_transaction_id='23000000-0000-4000-8000-000000000063'),0::bigint,'individual account owner never replaces canonical funding member');
select is((select amount from public.member_settlement_events where source_transaction_id='23000000-0000-4000-8000-000000000064' and debtor_member_id='23000000-0000-4000-8000-000000000024'),300::numeric,'joint account splits liquidity funding 50/50');

insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day)
values ('23000000-0000-4000-8000-000000000080','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000024','Wallace card',10000,1,10);
insert into public.transactions(id,household_id,created_by_member_id,buyer_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date)
values
 ('23000000-0000-4000-8000-000000000081','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000024','23000000-0000-4000-8000-000000000025','expense','pending','confirmed','Card Gui',2400,2400,2400,0,current_date,date_trunc('month',current_date)::date),
 ('23000000-0000-4000-8000-000000000082','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000024','23000000-0000-4000-8000-000000000025','expense','pending','confirmed','Card half',2400,2400,2400,0,current_date,date_trunc('month',current_date)::date),
 ('23000000-0000-4000-8000-000000000083','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000024','23000000-0000-4000-8000-000000000025','expense','pending','confirmed','Card Wallace',2400,2400,2400,0,current_date,date_trunc('month',current_date)::date);
insert into public.transaction_payment_instruments(household_id,transaction_id,kind,card_id)
select '23000000-0000-4000-8000-000000000012',id,'card','23000000-0000-4000-8000-000000000080' from unnest(array['23000000-0000-4000-8000-000000000081'::uuid,'23000000-0000-4000-8000-000000000082'::uuid,'23000000-0000-4000-8000-000000000083'::uuid]) id;
insert into public.economic_allocations(household_id,transaction_id,responsible_member_id,allocation_order,amount,percentage) values
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000081','23000000-0000-4000-8000-000000000025',1,2400,100),
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000082','23000000-0000-4000-8000-000000000024',1,1200,50),
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000082','23000000-0000-4000-8000-000000000025',2,1200,50),
 ('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000083','23000000-0000-4000-8000-000000000024',1,2400,100);
insert into public.installment_plans(id,household_id,purchase_transaction_id,installment_count,total_amount) values
 ('23000000-0000-4000-8000-000000000091','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000081',12,2400),
 ('23000000-0000-4000-8000-000000000092','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000082',12,2400),
 ('23000000-0000-4000-8000-000000000093','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000083',12,2400);
insert into public.installments(household_id,installment_plan_id,number,amount,competence_date,due_date)
select '23000000-0000-4000-8000-000000000012',p.id,n,200,(date_trunc('month',current_date)+(n||' month')::interval)::date,(date_trunc('month',current_date)+(n||' month')::interval+interval '9 day')::date
from (values ('23000000-0000-4000-8000-000000000091'::uuid),('23000000-0000-4000-8000-000000000092'::uuid),('23000000-0000-4000-8000-000000000093'::uuid)) p(id) cross join generate_series(1,12) n;

select results_eq($$select count(*),sum(amount)::bigint from public.member_settlement_events where source_transaction_id='23000000-0000-4000-8000-000000000081' and state='projected'$$,$$values(12::bigint,2400::bigint)$$,'card with Gui responsibility creates 12 projected settlements of 200');
select results_eq($$select count(*),sum(amount)::bigint from public.member_settlement_events where source_transaction_id='23000000-0000-4000-8000-000000000082' and state='projected'$$,$$values(12::bigint,1200::bigint)$$,'all 50/50 allocations create 12 projected settlements of 100');
select is((select count(*) from public.member_settlement_events where source_transaction_id='23000000-0000-4000-8000-000000000083'),0::bigint,'card owner fully responsible creates no member settlement');

-- A partial invoice payment must not realize the whole installment. Completing
-- it later converts the one projected origin without doubling the position.
insert into public.card_invoices(id,household_id,card_id,competence_date,closing_date,due_date,total_amount)
values ('23000000-0000-4000-8000-000000000094','23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000080',date_trunc('month',current_date)::date,current_date,current_date+10,200);
update public.installments set invoice_id='23000000-0000-4000-8000-000000000094'
 where installment_plan_id='23000000-0000-4000-8000-000000000091' and number=1;
select set_config('request.jwt.claim.sub','23000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.pay_card_invoice('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000094','23000000-0000-4000-8000-000000000033','23000000-0000-4000-8000-000000000024',100,now());
select is((select state::text from public.member_settlement_events e join public.installments i on i.id=e.source_installment_id where i.installment_plan_id='23000000-0000-4000-8000-000000000091' and i.number=1),'projected','partial card funding conservatively preserves projected state');
select public.pay_card_invoice('23000000-0000-4000-8000-000000000012','23000000-0000-4000-8000-000000000094','23000000-0000-4000-8000-000000000033','23000000-0000-4000-8000-000000000024',100,now());
select results_eq($$select count(*),sum(amount)::bigint from public.member_settlement_events e join public.installments i on i.id=e.source_installment_id where i.installment_plan_id='23000000-0000-4000-8000-000000000091' and i.number=1 and e.state='realized'$$,$$values(1::bigint,200::bigint)$$,'full funding realizes one origin without doubling amount');
select public.reconcile_member_settlements('23000000-0000-4000-8000-000000000081');
select results_eq($$select count(*),sum(amount)::bigint from public.member_settlement_events where source_transaction_id='23000000-0000-4000-8000-000000000081' and state in ('projected','realized')$$,$$values(12::bigint,2400::bigint)$$,'explicit reconciliation retry is idempotent');

select * from finish();
rollback;
