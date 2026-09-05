begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_view('public','financial_card_health_positions','029 keeps the canonical card-health view');
select has_function('public','financial_household_health_position',array['uuid'],'029 replaces household health interpretation');
select has_function('public','financial_attention_items',array['uuid'],'029 replaces attention interpretation');

select view_owner_is('public','financial_card_health_positions',current_user,'card-health view remains owned by migration executor');
select function_lang_is('public','financial_household_health_position',array['uuid'],'plpgsql','household health stays plpgsql');
select function_lang_is('public','financial_attention_items',array['uuid'],'plpgsql','attention stays plpgsql');

select lives_ok(
  $$select pg_get_viewdef('public.financial_card_health_positions'::regclass,true)$$,
  'card-health definition is readable after correction'
);

select lives_ok(
  $$select pg_get_functiondef('public.financial_attention_items(uuid)'::regprocedure)$$,
  'attention function definition is readable after correction'
);

select * from finish();
rollback;
