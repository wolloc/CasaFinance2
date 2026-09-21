begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('8a000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pr-j-opening@example.invalid',crypt('test-only',gen_salt('bf')),now(),'{}','{"display_name":"Abertura PR J"}',now(),now());
insert into public.households(id,name) values ('8a000000-0000-4000-8000-000000000010','Casa PR J');
insert into public.household_members(id,household_id,profile_id,role) values ('8a000000-0000-4000-8000-000000000021','8a000000-0000-4000-8000-000000000010','8a000000-0000-4000-8000-000000000001','owner');

-- Align current_date with the household clock so this test remains stable around UTC midnight.
select set_config('TimeZone',(select timezone from public.households where id='8a000000-0000-4000-8000-000000000010'),true);

set local role authenticated;
select set_config('request.jwt.claim.sub','8a000000-0000-4000-8000-000000000001',true);

select is(
  has_function_privilege('authenticated','public.set_household_financial_tracking_start(uuid,date)','EXECUTE'),
  false,
  'J01 data de corte só pode ser definida por comandos atômicos de onboarding'
);

select lives_ok($$
  select public.create_account_with_opening_position_idempotent(
    '8a000000-0000-4000-8000-000000000010','Conta inicial','checking','Banco PR J',
    array['8a000000-0000-4000-8000-000000000021'::uuid],3000,current_date,null,'j-account-checking'
  )
$$,'J02 conta com posição inicial é criada pelo comando canônico');
select lives_ok($$
  select public.create_account_with_opening_position_idempotent(
    '8a000000-0000-4000-8000-000000000010','Carteira inicial','cash',null,
    array['8a000000-0000-4000-8000-000000000021'::uuid],200,current_date,null,'j-account-cash'
  )
$$,'J03 carteira com posição inicial é criada pelo comando canônico');
select lives_ok($$
  select public.create_account_with_opening_position_idempotent(
    '8a000000-0000-4000-8000-000000000010','Reserva inicial','investment',null,
    array['8a000000-0000-4000-8000-000000000021'::uuid],10000,current_date,'reserve','j-account-investment'
  )
$$,'J04 investimento com posição inicial é criado pelo comando canônico');
select lives_ok($$
  select public.create_account_with_opening_position_idempotent(
    '8a000000-0000-4000-8000-000000000010','VA inicial','meal_benefit',null,
    array['8a000000-0000-4000-8000-000000000021'::uuid],350,current_date,null,'j-account-benefit'
  )
$$,'J05 benefício com posição inicial é criado como recurso restrito');

select is((select current_balance from public.financial_account_balances where household_id='8a000000-0000-4000-8000-000000000010' and name='Conta inicial'),3000::numeric,'J06 conta reconhece R$ 3.000 sem entrada');
select is((select current_balance from public.financial_account_balances where household_id='8a000000-0000-4000-8000-000000000010' and name='Carteira inicial'),200::numeric,'J07 carteira reconhece R$ 200 sem entrada');
select is((select current_balance from public.financial_account_balances where household_id='8a000000-0000-4000-8000-000000000010' and name='Reserva inicial'),10000::numeric,'J08 investimento reconhece patrimônio inicial sem renda');
select is((select count(*) from public.account_balance_events where household_id='8a000000-0000-4000-8000-000000000010' and kind='opening'),4::bigint,'J09 cada recurso tem posição inicial rastreável');
select is((select count(*) from public.financial_true_income_positions where household_id='8a000000-0000-4000-8000-000000000010'),0::bigint,'J10 posição inicial não cria receita');
select is((select count(*) from public.money_movements where household_id='8a000000-0000-4000-8000-000000000010'),0::bigint,'J11 posições iniciais não criam movimento de caixa');
select is((select count(*) from public.funding_events where household_id='8a000000-0000-4000-8000-000000000010'),0::bigint,'J12 posições iniciais não criam funding');

insert into public.cards(id,household_id,owner_member_id,name,credit_limit,closing_day,due_day)
values
 ('8a000000-0000-4000-8000-000000000041','8a000000-0000-4000-8000-000000000010','8a000000-0000-4000-8000-000000000021','Cartão sem dívida',15000,20,28),
 ('8a000000-0000-4000-8000-000000000042','8a000000-0000-4000-8000-000000000010','8a000000-0000-4000-8000-000000000021','Cartão histórico',15000,20,28),
 ('8a000000-0000-4000-8000-000000000043','8a000000-0000-4000-8000-000000000010','8a000000-0000-4000-8000-000000000021','Cartão agregado',1000,20,28);

select is((select available_limit from public.financial_card_exposure_positions where card_id='8a000000-0000-4000-8000-000000000041'),15000::numeric,'J13 cartão sem dívida começa com todo o limite disponível');

select lives_ok($$
  select public.record_opening_card_purchase_idempotent(
    '8a000000-0000-4000-8000-000000000010','8a000000-0000-4000-8000-000000000042',
    'Compra histórica parcelada',(current_date-interval '4 months')::date,1000,null,
    '8a000000-0000-4000-8000-000000000021',
    '[{"member_id":"8a000000-0000-4000-8000-000000000021","amount":"1000.00","percentage":"100.0000"}]'::jsonb,
    12,2,'Compra anterior ao uso do Casa','j-card-history'
  )
$$,'J14 compra parcelada histórica cria um único fato econômico');
select is((select count(*) from public.transactions where household_id='8a000000-0000-4000-8000-000000000010' and description='Compra histórica parcelada' and type='expense'),1::bigint,'J15 compra histórica permanece um único evento econômico');
select is((select transaction_date<financial_tracking_started_on from public.transactions t join public.households h on h.id=t.household_id where t.household_id='8a000000-0000-4000-8000-000000000010' and t.description='Compra histórica parcelada'),true,'J16 compra histórica não entra como gasto do mês de início');
select is((select sum(opening_settled_amount) from public.installments i join public.installment_plans p on p.id=i.installment_plan_id join public.transactions t on t.id=p.purchase_transaction_id where t.description='Compra histórica parcelada'),166.68::numeric,'J17 duas de doze parcelas anteriores ficam baixadas como abertura, sem pagamento no período');
select is((select total_exposure from public.financial_card_exposure_positions where card_id='8a000000-0000-4000-8000-000000000042'),833.32::numeric,'J18 somente dez de doze parcelas ainda abertas comprometem o limite');

select lives_ok($$
  select public.record_opening_card_balance_adjustment_idempotent(
    '8a000000-0000-4000-8000-000000000010','8a000000-0000-4000-8000-000000000043',
    300,'Saldo já existente da fatura','j-card-aggregate'
  )
$$,'J19 ajuste agregado de abertura de cartão é registrado');
select is((select count(*) from public.transactions where household_id='8a000000-0000-4000-8000-000000000010' and description='Saldo já existente da fatura' and type='adjustment'),1::bigint,'J20 ajuste agregado não cria despesa');
select is((select count(*) from public.economic_allocations a join public.transactions t on t.id=a.transaction_id where t.description='Saldo já existente da fatura'),0::bigint,'J21 ajuste agregado não inventa responsabilidade');
select is((select total_exposure from public.financial_card_exposure_positions where card_id='8a000000-0000-4000-8000-000000000043'),300::numeric,'J22 ajuste agregado representa somente exposição aberta');
select is((select count(*) from public.money_movements where household_id='8a000000-0000-4000-8000-000000000010'),0::bigint,'J23 compromissos de cartão de abertura ainda não criam caixa');

select lives_ok($$
  select public.pay_card_invoice_idempotent(
    '8a000000-0000-4000-8000-000000000010',
    (select invoice_id from public.transactions where household_id='8a000000-0000-4000-8000-000000000010' and description='Saldo já existente da fatura'),
    (select account_id from public.financial_account_balances where household_id='8a000000-0000-4000-8000-000000000010' and name='Conta inicial'),
    '8a000000-0000-4000-8000-000000000021',100,now(),'j-card-aggregate-payment'
  )
$$,'J24 pagamento posterior da fatura de abertura usa a liquidação canônica');
select is((select total_exposure from public.financial_card_exposure_positions where card_id='8a000000-0000-4000-8000-000000000043'),200::numeric,'J25 pagamento parcial libera somente o limite pago');

select lives_ok($$
  select public.record_opening_card_purchase_idempotent(
    '8a000000-0000-4000-8000-000000000010','8a000000-0000-4000-8000-000000000042',
    'Compra histórica parcelada',(current_date-interval '4 months')::date,1000,null,
    '8a000000-0000-4000-8000-000000000021',
    '[{"member_id":"8a000000-0000-4000-8000-000000000021","amount":"1000.00","percentage":"100.0000"}]'::jsonb,
    4,2,'Compra anterior ao uso do Casa','j-card-history'
  )
$$,'J26 repetição idempotente da abertura não cria outra compra');
select is((select count(*) from public.transactions where household_id='8a000000-0000-4000-8000-000000000010' and description='Compra histórica parcelada' and type='expense'),1::bigint,'J27 abertura histórica não duplica despesa econômica');

reset role;
select * from finish();
rollback;
