-- Etapa 10CT: retry idempotency for economic facts and recurring-series commands.
-- Reuses financial_command_requests introduced in 064 so one uncertain intent creates one effect.

create or replace function public.create_income_fact_idempotent(
  p_household_id uuid,p_description text,p_amount numeric,p_expected_date date,p_category_id uuid,
  p_beneficiary_member_id uuid,p_planned_destination_account_id uuid,p_income_nature public.income_nature,
  p_economic_state public.economic_state,p_notes text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='create_income_fact';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.create_income_fact(p_household_id,p_description,p_amount,p_expected_date,p_category_id,p_beneficiary_member_id,p_planned_destination_account_id,p_income_nature,p_economic_state,p_notes);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.create_financial_transaction_idempotent(
  p_household_id uuid,p_type public.transaction_kind,p_description text,p_amount numeric,p_transaction_date date,p_category_id uuid,
  p_buyer_member_id uuid,p_instrument_kind public.payment_instrument_kind,p_account_id uuid,p_card_id uuid,
  p_splits jsonb,p_installment_count integer,p_notes text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='create_financial_transaction';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.create_financial_transaction(p_household_id,p_type,p_description,p_amount,p_transaction_date,p_category_id,p_buyer_member_id,p_instrument_kind,p_account_id,p_card_id,p_splits,p_installment_count,p_notes);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.create_recurring_income_rule_idempotent(
  p_household_id uuid,p_description text,p_amount numeric,p_start_date date,p_end_date date,p_frequency text,p_category_id uuid,
  p_beneficiary_member_id uuid,p_planned_destination_account_id uuid,p_income_nature public.income_nature,
  p_economic_state public.economic_state,p_notes text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='create_recurring_income_rule';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.create_recurring_income_rule(p_household_id,p_description,p_amount,p_start_date,p_end_date,p_frequency,p_category_id,p_beneficiary_member_id,p_planned_destination_account_id,p_income_nature,p_economic_state,p_notes);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.revise_recurring_income_rule_idempotent(
  p_household_id uuid,p_rule_id uuid,p_effective_from date,p_description text,p_amount numeric,p_frequency text,p_category_id uuid,
  p_beneficiary_member_id uuid,p_planned_destination_account_id uuid,p_income_nature public.income_nature,
  p_economic_state public.economic_state,p_end_date date,p_notes text,p_reason text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='revise_recurring_income_rule';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.revise_recurring_income_rule(p_household_id,p_rule_id,p_effective_from,p_description,p_amount,p_frequency,p_category_id,p_beneficiary_member_id,p_planned_destination_account_id,p_income_nature,p_economic_state,p_end_date,p_notes,p_reason);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.close_recurring_income_rule_idempotent(
  p_household_id uuid,p_rule_id uuid,p_effective_from date,p_reason text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='close_recurring_income_rule';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.close_recurring_income_rule(p_household_id,p_rule_id,p_effective_from,p_reason);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.create_recurring_expense_rule_from_transaction_idempotent(
  p_household_id uuid,p_template_transaction_id uuid,p_frequency text,p_interval_count integer,p_start_date date,p_end_date date,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='create_recurring_expense_rule_from_transaction';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.create_recurring_expense_rule_from_transaction(p_household_id,p_template_transaction_id,p_frequency,p_interval_count,p_start_date,p_end_date);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.revise_recurring_expense_rule_idempotent(
  p_household_id uuid,p_rule_id uuid,p_effective_from date,p_amount numeric,p_frequency text,p_interval_count integer,p_end_date date,p_reason text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='revise_recurring_expense_rule';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.revise_recurring_expense_rule(p_household_id,p_rule_id,p_effective_from,p_amount,p_frequency,p_interval_count,p_end_date,p_reason);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.close_recurring_expense_rule_idempotent(
  p_household_id uuid,p_rule_id uuid,p_effective_from date,p_reason text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='close_recurring_expense_rule';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.close_recurring_expense_rule(p_household_id,p_rule_id,p_effective_from,p_reason);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.confirm_recurring_expense_occurrence_idempotent(
  p_household_id uuid,p_occurrence_id uuid,p_confirmed_amount numeric,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='confirm_recurring_expense_occurrence';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.confirm_recurring_expense_occurrence(p_household_id,p_occurrence_id,p_confirmed_amount);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

revoke all on function public.create_income_fact_idempotent(uuid,text,numeric,date,uuid,uuid,uuid,public.income_nature,public.economic_state,text,text) from public,anon;
revoke all on function public.create_financial_transaction_idempotent(uuid,public.transaction_kind,text,numeric,date,uuid,uuid,public.payment_instrument_kind,uuid,uuid,jsonb,integer,text,text) from public,anon;
revoke all on function public.create_recurring_income_rule_idempotent(uuid,text,numeric,date,date,text,uuid,uuid,uuid,public.income_nature,public.economic_state,text,text) from public,anon;
revoke all on function public.revise_recurring_income_rule_idempotent(uuid,uuid,date,text,numeric,text,uuid,uuid,uuid,public.income_nature,public.economic_state,date,text,text,text) from public,anon;
revoke all on function public.close_recurring_income_rule_idempotent(uuid,uuid,date,text,text) from public,anon;
revoke all on function public.create_recurring_expense_rule_from_transaction_idempotent(uuid,uuid,text,integer,date,date,text) from public,anon;
revoke all on function public.revise_recurring_expense_rule_idempotent(uuid,uuid,date,numeric,text,integer,date,text,text) from public,anon;
revoke all on function public.close_recurring_expense_rule_idempotent(uuid,uuid,date,text,text) from public,anon;
revoke all on function public.confirm_recurring_expense_occurrence_idempotent(uuid,uuid,numeric,text) from public,anon;

grant execute on function public.create_income_fact_idempotent(uuid,text,numeric,date,uuid,uuid,uuid,public.income_nature,public.economic_state,text,text) to authenticated;
grant execute on function public.create_financial_transaction_idempotent(uuid,public.transaction_kind,text,numeric,date,uuid,uuid,public.payment_instrument_kind,uuid,uuid,jsonb,integer,text,text) to authenticated;
grant execute on function public.create_recurring_income_rule_idempotent(uuid,text,numeric,date,date,text,uuid,uuid,uuid,public.income_nature,public.economic_state,text,text) to authenticated;
grant execute on function public.revise_recurring_income_rule_idempotent(uuid,uuid,date,text,numeric,text,uuid,uuid,uuid,public.income_nature,public.economic_state,date,text,text,text) to authenticated;
grant execute on function public.close_recurring_income_rule_idempotent(uuid,uuid,date,text,text) to authenticated;
grant execute on function public.create_recurring_expense_rule_from_transaction_idempotent(uuid,uuid,text,integer,date,date,text) to authenticated;
grant execute on function public.revise_recurring_expense_rule_idempotent(uuid,uuid,date,numeric,text,integer,date,text,text) to authenticated;
grant execute on function public.close_recurring_expense_rule_idempotent(uuid,uuid,date,text,text) to authenticated;
grant execute on function public.confirm_recurring_expense_occurrence_idempotent(uuid,uuid,numeric,text) to authenticated;
