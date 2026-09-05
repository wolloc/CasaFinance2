begin;

create extension if not exists pgtap with schema extensions;
select plan(38);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('26000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','wallace-026@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Wallace"}',now(),now()),
 ('26000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','gui-026@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Gui"}',now(),now()),
 ('26000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outside-026@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Outside"}',now(),now());
insert into public.households(id,name) values('26000000-0000-4000-8000-000000000010','Perspective'),('26000000-0000-4000-8000-000000000011','Outside');
insert into public.household_members(id,household_id,profile_id,role) values
 ('26000000-0000-4000-8000-000000000021','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000001','owner'),
 ('26000000-0000-4000-8000-000000000022','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000002','member'),
 ('26000000-0000-4000-8000-000000000023','26000000-0000-4000-8000-000000000011','26000000-0000-4000-8000-000000000003','owner');

insert into public.accounts(id,household_id,name,type,resource_restriction,overdraft_enabled,overdraft_limit) values
 ('26000000-0000-4000-8000-000000000031','26000000-0000-4000-8000-000000000010','Itau Wallace','checking',null,true,2000),
 ('26000000-0000-4000-8000-000000000032','26000000-0000-4000-8000-000000000010','Joint','checking',null,false,0),
 ('26000000-0000-4000-8000-000000000033','26000000-0000-4000-8000-000000000010','Negative','checking',null,true,2000),
 ('26000000-0000-4000-8000-000000000034','26000000-0000-4000-8000-000000000010','Reserve','savings','reserve',false,0),
 ('26000000-0000-4000-8000-000000000035','26000000-0000-4000-8000-000000000010','Investment','investment',null,false,0),
 ('26000000-0000-4000-8000-000000000036','26000000-0000-4000-8000-000000000010','Benefit','meal_benefit','meal_benefit',false,0),
 ('26000000-0000-4000-8000-000000000037','26000000-0000-4000-8000-000000000010','No owner','checking',null,false,0);
insert into public.account_ownerships(account_id,household_id,member_id) values
 ('26000000-0000-4000-8000-000000000031','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021'),
 ('26000000-0000-4000-8000-000000000032','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021'),
 ('26000000-0000-4000-8000-000000000032','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000022'),
 ('26000000-0000-4000-8000-000000000033','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021'),
 ('26000000-0000-4000-8000-000000000034','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021'),
 ('26000000-0000-4000-8000-000000000035','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021'),
 ('26000000-0000-4000-8000-000000000036','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021');
insert into public.account_balance_events(household_id,account_id,created_by_member_id,kind,amount,effective_date,description) values
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000031','26000000-0000-4000-8000-000000000021','opening',2000,current_date,'opening'),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000032','26000000-0000-4000-8000-000000000021','opening',1000,current_date,'opening'),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000033','26000000-0000-4000-8000-000000000021','opening',-350,current_date,'opening'),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000034','26000000-0000-4000-8000-000000000021','opening',900,current_date,'opening'),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000035','26000000-0000-4000-8000-000000000021','opening',800,current_date,'opening'),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000036','26000000-0000-4000-8000-000000000021','opening',700,current_date,'opening'),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000037','26000000-0000-4000-8000-000000000021','opening',99,current_date,'opening');

select is((select attributed_liquidity from public.financial_member_liquidity_positions where account_id='26000000-0000-4000-8000-000000000031' and member_id='26000000-0000-4000-8000-000000000021'),2000::numeric,'A individual account is fully attributed');
select results_eq($$select member_id,attributed_liquidity from public.financial_member_liquidity_positions where account_id='26000000-0000-4000-8000-000000000032' order by member_id$$,$$values('26000000-0000-4000-8000-000000000021'::uuid,500::numeric),('26000000-0000-4000-8000-000000000022'::uuid,500::numeric)$$,'B joint account is 50/50');
select is((select attributed_liquidity from public.financial_member_liquidity_positions where account_id='26000000-0000-4000-8000-000000000033'),-350::numeric,'C negative balance remains negative');
select is((select count(*) from public.financial_member_liquidity_positions where account_id in('26000000-0000-4000-8000-000000000034','26000000-0000-4000-8000-000000000035','26000000-0000-4000-8000-000000000036')),0::bigint,'N restricted, investment and benefit are excluded');
select results_eq($$select member_id,attributed_liquidity from public.financial_member_liquidity_positions where account_id='26000000-0000-4000-8000-000000000037'$$,$$values(null::uuid,99::numeric)$$,'invalid ownership stays unattributed');

insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day,default_payment_account_id) values
 ('26000000-0000-4000-8000-000000000040','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','Infinity',10000,1,10,'26000000-0000-4000-8000-000000000031'),
 ('26000000-0000-4000-8000-000000000041','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','No default',10000,1,10,null);
insert into public.transactions(id,household_id,created_by_member_id,buyer_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date) values
 ('26000000-0000-4000-8000-000000000050','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','26000000-0000-4000-8000-000000000021','expense','pending','confirmed','TV',2400,2400,2400,0,current_date,date_trunc('month',current_date)::date),
 ('26000000-0000-4000-8000-000000000051','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','26000000-0000-4000-8000-000000000021','expense','pending','confirmed','No route',200,200,200,0,current_date,date_trunc('month',current_date)::date);
insert into public.transaction_payment_instruments(household_id,transaction_id,kind,card_id) values
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000050','card','26000000-0000-4000-8000-000000000040'),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000051','card','26000000-0000-4000-8000-000000000041');
insert into public.economic_allocations(household_id,transaction_id,responsible_member_id,allocation_order,amount,percentage) values
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000050','26000000-0000-4000-8000-000000000022',1,2400,100),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000051','26000000-0000-4000-8000-000000000022',1,200,100);
insert into public.installment_plans(id,household_id,purchase_transaction_id,installment_count,total_amount) values('26000000-0000-4000-8000-000000000060','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000050',12,2400);
insert into public.installments(id,household_id,installment_plan_id,number,amount,competence_date,due_date)
select ('26000000-0000-4000-8000-'||lpad((600+n)::text,12,'0'))::uuid,'26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000060',n,200,(date_trunc('month',current_date)+(n||' month')::interval)::date,(date_trunc('month',current_date)+(n||' month')::interval+interval '9 days')::date from generate_series(1,12)n;

select is((select responsibility_amount from public.financial_member_commitment_responsibility_positions where source_installment_id='26000000-0000-4000-8000-000000000601' and member_id='26000000-0000-4000-8000-000000000022'),200::numeric,'D installment responsibility belongs to Gui');
select is((select coalesce(sum(responsibility_amount),0) from public.financial_member_commitment_responsibility_positions where source_installment_id='26000000-0000-4000-8000-000000000601' and member_id='26000000-0000-4000-8000-000000000021'),0::numeric,'card owner gets no economic responsibility');
select is((select amount from public.financial_member_funding_positions where commitment_key='installment:26000000-0000-4000-8000-000000000601' and funding_state='projected' and member_id='26000000-0000-4000-8000-000000000021'),200::numeric,'default individual account projects funding to Wallace');
select is((select amount from public.member_settlement_events where source_installment_id='26000000-0000-4000-8000-000000000601' and state='projected'),200::numeric,'default route creates projected Gui to Wallace settlement');
select is((select sum(remaining_amount) from public.financial_commitment_positions where source_transaction_id='26000000-0000-4000-8000-000000000050'),2400::numeric,'K installments appear once by financial month');
select is((select count(*) from public.financial_commitment_positions where source_transaction_id='26000000-0000-4000-8000-000000000050'),12::bigint,'J purchase and invoice are not duplicate commitments');
select results_eq($$select route_source,route_amount from public.financial_projected_funding_routes where source_transaction_id='26000000-0000-4000-8000-000000000051'$$,$$values('unattributed'::text,200::numeric)$$,'card without default is unattributed, not assigned to owner or buyer');

select set_config('request.jwt.claim.sub','26000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select lives_ok($$select public.set_commitment_funding_plan('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000032',80,'tv-override',null,'26000000-0000-4000-8000-000000000601')$$,'partial override can be created');
select results_eq($$select route_source,source_account_id,route_amount from public.financial_projected_funding_routes where source_installment_id='26000000-0000-4000-8000-000000000601' order by priority$$,$$values('explicit_override'::text,'26000000-0000-4000-8000-000000000032'::uuid,80::numeric),('instrument_default'::text,'26000000-0000-4000-8000-000000000031'::uuid,120::numeric)$$,'override wins and default receives residual');
select results_eq($$select member_id,amount from public.financial_member_funding_positions where commitment_key='installment:26000000-0000-4000-8000-000000000601' and funding_state='projected' order by member_id$$,$$values('26000000-0000-4000-8000-000000000021'::uuid,40::numeric),('26000000-0000-4000-8000-000000000021'::uuid,120::numeric),('26000000-0000-4000-8000-000000000022'::uuid,40::numeric)$$,'joint override is 50/50 and closes exact cents');
select is((select public.set_commitment_funding_plan('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000032',80,'tv-override',null,'26000000-0000-4000-8000-000000000601')),(select id from public.commitment_funding_plans where idempotency_key='tv-override'),'plan RPC retry is idempotent');
select throws_ok($$select public.set_commitment_funding_plan('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000032',81,'tv-override',null,'26000000-0000-4000-8000-000000000601')$$,'23505','idempotency key already used with different plan data','idempotency conflict rolls back');

reset role;
insert into public.financial_parties(id,household_id,name,created_by_member_id) values('26000000-0000-4000-8000-000000000070','26000000-0000-4000-8000-000000000010','Vendor','26000000-0000-4000-8000-000000000021');
insert into public.financial_obligations(id,household_id,created_by_member_id,kind,counterparty_id,original_amount,obligation_date,due_date,description) values('26000000-0000-4000-8000-000000000071','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','payable','26000000-0000-4000-8000-000000000070',90,current_date,current_date+10,'Standalone payable');
select is((select responsibility_amount from public.financial_member_commitment_responsibility_positions where source_obligation_id='26000000-0000-4000-8000-000000000071'),90::numeric,'payable without economic source exposes unattributed responsibility');
select is((select member_id from public.financial_member_commitment_responsibility_positions where source_obligation_id='26000000-0000-4000-8000-000000000071'),null::uuid,'payable responsibility is not invented');
select is((select route_source from public.financial_projected_funding_routes where source_obligation_id='26000000-0000-4000-8000-000000000071'),'unattributed','payable without override has no route');
select set_config('request.jwt.claim.sub','26000000-0000-4000-8000-000000000001',true);set local role authenticated;
select lives_ok($$select public.set_commitment_funding_plan('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000032',90,'payable-route',null,null,'26000000-0000-4000-8000-000000000071')$$,'payable override is accepted');
select is((select sum(amount) from public.financial_member_funding_positions where source_obligation_id='26000000-0000-4000-8000-000000000071' and funding_state='projected'),90::numeric,'payable override closes its projected funding');

reset role;
insert into public.member_settlement_events(id,household_id,created_by_member_id,debtor_member_id,creditor_member_id,amount,state,kind,financial_date,occurred_at,source_transaction_id) values('26000000-0000-4000-8000-000000000080','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','26000000-0000-4000-8000-000000000022','26000000-0000-4000-8000-000000000021',150,'realized','adjustment',current_date,now(),'26000000-0000-4000-8000-000000000051');
select is((select count(*) from public.financial_member_settlement_cash_flows),0::bigint,'G unscheduled settlement is position only');
insert into public.member_settlement_schedules(household_id,created_by_member_id,payer_member_id,receiver_member_id,amount,due_date,idempotency_key) values('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','26000000-0000-4000-8000-000000000022','26000000-0000-4000-8000-000000000021',150,current_date+30,'scheduled-150');
select results_eq($$select member_id,scheduled_inflow,scheduled_outflow from public.financial_member_settlement_cash_flows order by member_id$$,$$values('26000000-0000-4000-8000-000000000021'::uuid,150::numeric,0::numeric),('26000000-0000-4000-8000-000000000022'::uuid,0::numeric,150::numeric)$$,'H scheduled settlement is equal opposite cash flow');
select is((select count(*) from public.financial_member_true_income_positions where money_movement_id in(select id from public.money_movements where kind='member_settlement')),0::bigint,'I settlement is never true income');
select is((select count(*) from public.member_settlement_events where source_transaction_id is null and kind='responsibility_funding'),0::bigint,'O account ownership alone creates no settlement');

insert into public.categories(id,household_id,name,type) values('26000000-0000-4000-8000-000000000090','26000000-0000-4000-8000-000000000010','Salary 026','income');
insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date) values
 ('26000000-0000-4000-8000-000000000091','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','income','pending','confirmed','Wallace salary',1000,1000,1000,0,current_date,date_trunc('month',current_date)::date),
 ('26000000-0000-4000-8000-000000000092','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','transfer','paid','realized','Own transfer',50,50,50,50,current_date,date_trunc('month',current_date)::date,now());
insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,beneficiary_member_id,source_account_id,destination_account_id,category_id,related_transaction_id,movement_date,competence_date,realized_at) values
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','income','projected',1000,'Wallace salary','26000000-0000-4000-8000-000000000021',null,'26000000-0000-4000-8000-000000000032','26000000-0000-4000-8000-000000000090','26000000-0000-4000-8000-000000000091',current_date,date_trunc('month',current_date)::date,null),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','transfer','realized',50,'Own transfer',null,'26000000-0000-4000-8000-000000000031','26000000-0000-4000-8000-000000000032',null,null,current_date,date_trunc('month',current_date)::date,now());
select is((select reliable_remaining_amount from public.financial_member_true_income_positions where member_id='26000000-0000-4000-8000-000000000021'),1000::numeric,'L income remains attributed to Wallace even in a joint account');
select is((select count(*) from public.financial_member_true_income_positions where member_id='26000000-0000-4000-8000-000000000022'),0::bigint,'Wallace income never becomes Gui income');
select is((select count(*) from public.financial_member_true_income_positions where money_movement_id in(select id from public.money_movements where kind='transfer')),0::bigint,'M own transfer is not income');

insert into public.transactions(id,household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at) values
 ('26000000-0000-4000-8000-000000000093','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','expense','pending','confirmed','Half shared',300,300,300,0,current_date,date_trunc('month',current_date)::date,null),
 ('26000000-0000-4000-8000-000000000094','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','expense','pending','confirmed','Wallace joint',600,600,600,0,current_date,date_trunc('month',current_date)::date,null),
 ('26000000-0000-4000-8000-000000000095','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','adjustment','paid','realized','fund half',300,300,300,300,current_date,date_trunc('month',current_date)::date,now()),
 ('26000000-0000-4000-8000-000000000096','26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021','adjustment','paid','realized','fund joint',600,600,600,600,current_date,date_trunc('month',current_date)::date,now());
insert into public.economic_allocations(household_id,transaction_id,responsible_member_id,allocation_order,amount,percentage) values
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000093','26000000-0000-4000-8000-000000000021',1,150,50),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000093','26000000-0000-4000-8000-000000000022',2,150,50),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000094','26000000-0000-4000-8000-000000000021',1,600,100);
insert into public.funding_events(household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,amount,funded_at) values
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000093','26000000-0000-4000-8000-000000000095','26000000-0000-4000-8000-000000000021','26000000-0000-4000-8000-000000000031',300,now()),
 ('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000094','26000000-0000-4000-8000-000000000096','26000000-0000-4000-8000-000000000021','26000000-0000-4000-8000-000000000032',600,now());
select is((select amount from public.member_settlement_events where source_funding_event_id in(select id from public.funding_events where financed_transaction_id='26000000-0000-4000-8000-000000000093')),150::numeric,'E 50/50 expense funded by Wallace realizes Gui to Wallace 150');
select is((select amount from public.member_settlement_events where source_funding_event_id in(select id from public.funding_events where financed_transaction_id='26000000-0000-4000-8000-000000000094')),300::numeric,'F Wallace expense funded jointly realizes Wallace to Gui 300');

update public.cards set default_payment_account_id='26000000-0000-4000-8000-000000000032' where id='26000000-0000-4000-8000-000000000040';
select is((select sum(amount) from public.financial_member_funding_positions where source_installment_id='26000000-0000-4000-8000-000000000602' and funding_state='projected' and member_id='26000000-0000-4000-8000-000000000021'),100::numeric,'default change recalculates open future amount');
select is((select sum(amount) from public.financial_member_funding_positions where source_installment_id='26000000-0000-4000-8000-000000000602' and funding_state='projected' and member_id='26000000-0000-4000-8000-000000000022'),100::numeric,'changed default is 50/50');
select is((select count(*) from public.funding_events),2::bigint,'default changes never synthesize additional realized funding');

select set_config('request.jwt.claim.sub','26000000-0000-4000-8000-000000000003',true);set local role authenticated;
select is((select count(*) from public.commitment_funding_plans where household_id='26000000-0000-4000-8000-000000000010'),0::bigint,'RLS isolates funding plans');
select throws_ok($$select * from public.financial_member_monthly_projection('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021',date_trunc('month',current_date)::date,1)$$,'42501',null,'monthly projection rejects another household');

reset role;select set_config('request.jwt.claim.sub','26000000-0000-4000-8000-000000000001',true);set local role authenticated;
select is((select count(*) from public.financial_member_monthly_projection('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021',date_trunc('month',current_date)::date,4)),4::bigint,'individual projection returns requested horizon');
select is((select count(*) from public.financial_member_monthly_projection('26000000-0000-4000-8000-000000000010','26000000-0000-4000-8000-000000000021',date_trunc('month',current_date)::date,4) where projected_ending_liquidity<>opening_liquidity+expected_reliable_income_remaining+scheduled_settlement_inflow-projected_funding_remaining-scheduled_settlement_outflow),0::bigint,'P projection formula subtracts funding, never responsibility');

select * from finish();
rollback;
