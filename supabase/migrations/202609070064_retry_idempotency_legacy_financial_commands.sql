-- Etapa 10CS: retry idempotency for legacy financial commands.
-- A committed command whose response is lost must not create a second economic/cash effect.

create table if not exists public.financial_command_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  operation text not null check (length(trim(operation))>0),
  request_key text not null check (length(trim(request_key))>0),
  result_id uuid not null,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(household_id,operation,request_key)
);

alter table public.financial_command_requests enable row level security;
drop policy if exists financial_command_requests_select_active_member on public.financial_command_requests;
create policy financial_command_requests_select_active_member on public.financial_command_requests
  for select to authenticated using (public.is_active_household_member(household_id));
revoke all on public.financial_command_requests from public,anon,authenticated;
grant select on public.financial_command_requests to authenticated;

create or replace function public.financial_command_existing_or_lock(
  p_household_id uuid,p_operation text,p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare existing uuid;
begin
  perform public.require_active_member(p_household_id);
  if length(trim(coalesce(p_operation,'')))=0 or length(trim(coalesce(p_request_key,'')))=0 then
    raise exception 'operation and request key are required' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':'||trim(p_operation)||':'||trim(p_request_key),0));
  select result_id into existing from public.financial_command_requests
   where household_id=p_household_id and operation=trim(p_operation) and request_key=trim(p_request_key);
  return existing;
end $$;
revoke all on function public.financial_command_existing_or_lock(uuid,text,text) from public,anon,authenticated;

create or replace function public.financial_command_store(
  p_household_id uuid,p_operation text,p_request_key text,p_result_id uuid
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare caller public.household_members;
begin
  caller:=public.require_active_member(p_household_id);
  if p_result_id is null then raise exception 'result id is required' using errcode='22023'; end if;
  insert into public.financial_command_requests(household_id,operation,request_key,result_id,created_by_member_id)
  values(p_household_id,trim(p_operation),trim(p_request_key),p_result_id,caller.id)
  on conflict(household_id,operation,request_key) do nothing;
  return p_result_id;
end $$;
revoke all on function public.financial_command_store(uuid,text,text,uuid) from public,anon,authenticated;

create or replace function public.pay_card_invoice_idempotent(
  p_household_id uuid,p_invoice_id uuid,p_source_account_id uuid,p_funder_member_id uuid,
  p_amount numeric,p_paid_at timestamptz,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='pay_card_invoice';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.pay_card_invoice(p_household_id,p_invoice_id,p_source_account_id,p_funder_member_id,p_amount,p_paid_at);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.settle_income_idempotent(
  p_household_id uuid,p_transaction_id uuid,p_destination_account_id uuid,p_beneficiary_member_id uuid,
  p_amount numeric,p_received_at timestamptz,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='settle_income';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.settle_income(p_household_id,p_transaction_id,p_destination_account_id,p_beneficiary_member_id,p_amount,p_received_at);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.settle_direct_expense_idempotent(
  p_household_id uuid,p_transaction_id uuid,p_source_account_id uuid,p_funder_member_id uuid,
  p_amount numeric,p_paid_at timestamptz,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='settle_direct_expense';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.settle_direct_expense(p_household_id,p_transaction_id,p_source_account_id,p_funder_member_id,p_amount,p_paid_at);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.create_transfer_idempotent(
  p_household_id uuid,p_source_account_id uuid,p_destination_account_id uuid,p_amount numeric,
  p_date date,p_description text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='create_transfer';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.create_transfer(p_household_id,p_source_account_id,p_destination_account_id,p_amount,p_date,p_description);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.settle_member_position_idempotent(
  p_household_id uuid,p_payer_member_id uuid,p_receiver_member_id uuid,p_amount numeric,
  p_source_account_id uuid,p_destination_account_id uuid,p_notes text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='settle_member_position';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.settle_member_position(p_household_id,p_payer_member_id,p_receiver_member_id,p_amount,p_source_account_id,p_destination_account_id,now(),p_notes,null);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.settle_financial_obligation_idempotent(
  p_household_id uuid,p_obligation_id uuid,p_account_id uuid,p_amount numeric,p_occurred_at timestamptz,
  p_funder_member_id uuid,p_notes text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='settle_financial_obligation';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.settle_financial_obligation(p_household_id,p_obligation_id,p_account_id,p_amount,p_occurred_at,p_funder_member_id,p_notes);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.write_off_receivable_idempotent(
  p_household_id uuid,p_obligation_id uuid,p_amount numeric,p_loss_date date,p_splits jsonb,
  p_category_id uuid,p_notes text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='write_off_receivable';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.write_off_receivable(p_household_id,p_obligation_id,p_amount,p_loss_date,p_splits,p_category_id,p_notes);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.create_loan_principal_idempotent(
  p_household_id uuid,p_direction text,p_counterparty_id uuid,p_account_id uuid,p_amount numeric,
  p_occurred_at date,p_due_date date,p_description text,p_notes text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='create_loan_principal';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.create_loan_principal(p_household_id,p_direction,p_counterparty_id,p_account_id,p_amount,p_occurred_at,p_due_date,p_description,p_notes);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.record_investment_performance_idempotent(
  p_household_id uuid,p_account_id uuid,p_kind public.investment_performance_kind,p_amount numeric,
  p_effective_date date,p_description text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='record_investment_performance';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.record_investment_performance(p_household_id,p_account_id,p_kind,p_amount,p_effective_date,p_description);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.create_and_settle_direct_expense_idempotent(
  p_household_id uuid,p_description text,p_amount numeric,p_transaction_date date,p_category_id uuid,
  p_buyer_member_id uuid,p_source_account_id uuid,p_funder_member_id uuid,p_splits jsonb,p_paid_at timestamptz,
  p_notes text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='create_and_settle_direct_expense';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.create_and_settle_direct_expense(p_household_id,p_description,p_amount,p_transaction_date,p_category_id,p_buyer_member_id,p_source_account_id,p_funder_member_id,p_splits,p_paid_at,p_notes);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.create_and_settle_shared_expense_idempotent(
  p_household_id uuid,p_description text,p_gross_amount numeric,p_transaction_date date,p_category_id uuid,
  p_buyer_member_id uuid,p_source_account_id uuid,p_funder_member_id uuid,p_splits jsonb,p_receivable_due_date date,
  p_notes text,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='create_and_settle_shared_expense';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.create_and_settle_shared_expense(p_household_id,p_description,p_gross_amount,p_transaction_date,p_category_id,p_buyer_member_id,p_source_account_id,p_funder_member_id,p_splits,p_receivable_due_date,p_notes);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

create or replace function public.settle_recurring_expense_occurrence_idempotent(
  p_household_id uuid,p_occurrence_id uuid,p_source_account_id uuid,p_funder_member_id uuid,
  p_amount numeric,p_paid_at timestamptz,p_request_key text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; existing uuid; op constant text:='settle_recurring_expense_occurrence';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key); if existing is not null then return existing; end if;
  result:=public.settle_recurring_expense_occurrence(p_household_id,p_occurrence_id,p_source_account_id,p_funder_member_id,p_amount,p_paid_at);
  perform public.financial_command_store(p_household_id,op,p_request_key,result); return result;
end $$;

revoke all on function public.pay_card_invoice_idempotent(uuid,uuid,uuid,uuid,numeric,timestamptz,text) from public,anon;
revoke all on function public.settle_income_idempotent(uuid,uuid,uuid,uuid,numeric,timestamptz,text) from public,anon;
revoke all on function public.settle_direct_expense_idempotent(uuid,uuid,uuid,uuid,numeric,timestamptz,text) from public,anon;
revoke all on function public.create_transfer_idempotent(uuid,uuid,uuid,numeric,date,text,text) from public,anon;
revoke all on function public.settle_member_position_idempotent(uuid,uuid,uuid,numeric,uuid,uuid,text,text) from public,anon;
revoke all on function public.settle_financial_obligation_idempotent(uuid,uuid,uuid,numeric,timestamptz,uuid,text,text) from public,anon;
revoke all on function public.write_off_receivable_idempotent(uuid,uuid,numeric,date,jsonb,uuid,text,text) from public,anon;
revoke all on function public.create_loan_principal_idempotent(uuid,text,uuid,uuid,numeric,date,date,text,text,text) from public,anon;
revoke all on function public.record_investment_performance_idempotent(uuid,uuid,public.investment_performance_kind,numeric,date,text,text) from public,anon;
revoke all on function public.create_and_settle_direct_expense_idempotent(uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,timestamptz,text,text) from public,anon;
revoke all on function public.create_and_settle_shared_expense_idempotent(uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,date,text,text) from public,anon;
revoke all on function public.settle_recurring_expense_occurrence_idempotent(uuid,uuid,uuid,uuid,numeric,timestamptz,text) from public,anon;

grant execute on function public.pay_card_invoice_idempotent(uuid,uuid,uuid,uuid,numeric,timestamptz,text) to authenticated;
grant execute on function public.settle_income_idempotent(uuid,uuid,uuid,uuid,numeric,timestamptz,text) to authenticated;
grant execute on function public.settle_direct_expense_idempotent(uuid,uuid,uuid,uuid,numeric,timestamptz,text) to authenticated;
grant execute on function public.create_transfer_idempotent(uuid,uuid,uuid,numeric,date,text,text) to authenticated;
grant execute on function public.settle_member_position_idempotent(uuid,uuid,uuid,numeric,uuid,uuid,text,text) to authenticated;
grant execute on function public.settle_financial_obligation_idempotent(uuid,uuid,uuid,numeric,timestamptz,uuid,text,text) to authenticated;
grant execute on function public.write_off_receivable_idempotent(uuid,uuid,numeric,date,jsonb,uuid,text,text) to authenticated;
grant execute on function public.create_loan_principal_idempotent(uuid,text,uuid,uuid,numeric,date,date,text,text,text) to authenticated;
grant execute on function public.record_investment_performance_idempotent(uuid,uuid,public.investment_performance_kind,numeric,date,text,text) to authenticated;
grant execute on function public.create_and_settle_direct_expense_idempotent(uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,timestamptz,text,text) to authenticated;
grant execute on function public.create_and_settle_shared_expense_idempotent(uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,date,text,text) to authenticated;
grant execute on function public.settle_recurring_expense_occurrence_idempotent(uuid,uuid,uuid,uuid,numeric,timestamptz,text) to authenticated;
