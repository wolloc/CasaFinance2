begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select has_view('public','financial_overdraft_positions','028 exposes LIS separately from cash');
select has_view('public','financial_card_health_positions','028 exposes objective card health');
select has_view('public','financial_projection_confidence_positions','028 exposes qualitative projection confidence');
select has_function('public','financial_household_health_position',array['uuid'],'028 exposes household health function');
select has_function('public','financial_attention_items',array['uuid'],'028 exposes actionable attention function');

select has_column('public','financial_overdraft_positions','overdraft_used','LIS used is explicit');
select has_column('public','financial_overdraft_positions','overdraft_available','LIS available is explicit');
select has_column('public','financial_overdraft_positions','overdraft_over_limit','LIS excess is explicit');
select has_column('public','financial_card_health_positions','card_health','card health classification is exposed');
select has_column('public','financial_card_health_positions','health_reason','card health reason is explainable');
select has_column('public','financial_projection_confidence_positions','confidence_state','confidence state is separate');
select has_column('public','financial_projection_confidence_positions','confidence_label','confidence label is UI-ready');

select function_privs_are('public','financial_household_health_position',array['uuid'],'anon',array[]::text[],'anon cannot execute household health');
select function_privs_are('public','financial_attention_items',array['uuid'],'anon',array[]::text[],'anon cannot execute attention');
select ok(has_function_privilege('authenticated','public.financial_household_health_position(uuid)','EXECUTE'),'authenticated can execute household health');
select ok(has_function_privilege('authenticated','public.financial_attention_items(uuid)','EXECUTE'),'authenticated can execute attention');

select ok(position('overdraft is debt capacity' in lower(obj_description('public.financial_overdraft_positions'::regclass)))>0,'LIS documentation preserves credit-not-cash rule');
select ok(position('separate from financial health' in lower(obj_description('public.financial_projection_confidence_positions'::regclass)))>0,'confidence documentation is separate from health');
select ok(position('actionable attention center' in lower(obj_description('public.financial_attention_items(uuid)'::regprocedure)))>0,'attention function documents actionable-only contract');

select * from finish();
rollback;
