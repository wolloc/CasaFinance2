begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select has_type('public','external_payment_intent','external payer intent enum exists');
select has_table('public','external_payment_events','external payment fact table exists');
select has_column('public','financial_obligations','command_key','obligations support idempotent commands');

select has_function(
  'public','create_borrowed_loan',
  array['uuid','uuid','uuid','numeric','timestamp with time zone','date','text','text','text'],
  'borrowed-loan command exists'
);
select has_function(
  'public','record_external_expense_payment',
  array['uuid','uuid','uuid','external_payment_intent','numeric','timestamp with time zone','text','date','text'],
  'external payer command exists'
);
select has_function(
  'public','settle_direct_expense',
  array['uuid','uuid','uuid','uuid','numeric','timestamp with time zone'],
  'direct expense settlement remains available'
);

select ok(
  has_table_privilege('authenticated','public.external_payment_events','SELECT'),
  'authenticated can read external payment facts'
);
select ok(
  not has_table_privilege('authenticated','public.external_payment_events','INSERT'),
  'authenticated cannot bypass RPC with direct external-payment insert'
);
select ok(
  not has_table_privilege('anon','public.external_payment_events','SELECT'),
  'anon cannot read external payment facts'
);

select ok(
  has_function_privilege('authenticated','public.create_borrowed_loan(uuid,uuid,uuid,numeric,timestamptz,date,text,text,text)','EXECUTE'),
  'authenticated can execute borrowed-loan command'
);
select ok(
  has_function_privilege('authenticated','public.record_external_expense_payment(uuid,uuid,uuid,external_payment_intent,numeric,timestamptz,text,date,text)','EXECUTE'),
  'authenticated can execute external payer command'
);
select ok(
  not has_function_privilege('anon','public.create_borrowed_loan(uuid,uuid,uuid,numeric,timestamptz,date,text,text,text)','EXECUTE'),
  'anon cannot execute borrowed-loan command'
);
select ok(
  not has_function_privilege('anon','public.record_external_expense_payment(uuid,uuid,uuid,external_payment_intent,numeric,timestamptz,text,date,text)','EXECUTE'),
  'anon cannot execute external payer command'
);

select ok(
  position('never as income' in lower(obj_description('public.create_borrowed_loan(uuid,uuid,uuid,numeric,timestamptz,date,text,text,text)'::regprocedure)))>0,
  'borrowed-loan documentation preserves the no-income rule'
);

select * from finish();
rollback;
