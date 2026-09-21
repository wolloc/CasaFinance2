-- Release 1: make projected member settlements deterministic after a card
-- purchase is fully assembled. Migration 072 defers per-installment reconciliation
-- for performance, so the idempotent creation command closes the loop once all
-- installments and economic allocations exist.

create or replace function public.create_financial_transaction_idempotent(
  p_household_id uuid,
  p_type public.transaction_kind,
  p_description text,
  p_amount numeric,
  p_transaction_date date,
  p_category_id uuid,
  p_buyer_member_id uuid,
  p_instrument_kind public.payment_instrument_kind,
  p_account_id uuid,
  p_card_id uuid,
  p_splits jsonb,
  p_installment_count integer,
  p_notes text,
  p_request_key text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  result uuid;
  existing uuid;
  op constant text:='create_financial_transaction';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then
    return existing;
  end if;

  result:=public.create_financial_transaction(
    p_household_id,p_type,p_description,p_amount,p_transaction_date,p_category_id,
    p_buyer_member_id,p_instrument_kind,p_account_id,p_card_id,p_splits,
    p_installment_count,p_notes
  );

  -- Card projections depend on the complete installment schedule plus economic
  -- allocations. Reconcile once, after the command has assembled the purchase.
  if p_type='expense' and p_instrument_kind='card' and p_installment_count>1 then
    perform public.reconcile_member_settlements(result);
  end if;

  perform public.financial_command_store(p_household_id,op,p_request_key,result);
  return result;
end $$;

revoke all on function public.create_financial_transaction_idempotent(
  uuid,public.transaction_kind,text,numeric,date,uuid,uuid,
  public.payment_instrument_kind,uuid,uuid,jsonb,integer,text,text
) from public,anon;

grant execute on function public.create_financial_transaction_idempotent(
  uuid,public.transaction_kind,text,numeric,date,uuid,uuid,
  public.payment_instrument_kind,uuid,uuid,jsonb,integer,text,text
) to authenticated;
