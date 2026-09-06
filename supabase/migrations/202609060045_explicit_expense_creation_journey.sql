-- Etapa 10AD: explicit expense creation journey.
-- When a direct expense is already paid, creation + Funding + Caixa must be atomic.
-- Buyer, responsibility, account holder and funder remain independent.

create or replace function public.create_and_settle_direct_expense(
  p_household_id uuid,
  p_description text,
  p_amount numeric,
  p_transaction_date date,
  p_category_id uuid,
  p_buyer_member_id uuid,
  p_source_account_id uuid,
  p_funder_member_id uuid,
  p_splits jsonb,
  p_paid_at timestamptz,
  p_notes text default null
) returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  tx uuid;
begin
  perform public.require_active_member(p_household_id);
  if p_amount is null or p_amount<=0 then raise exception 'amount must be positive' using errcode='23514'; end if;
  if p_paid_at is null then raise exception 'paid_at is required' using errcode='23514'; end if;

  tx:=public.create_financial_transaction(
    p_household_id,'expense',p_description,p_amount,p_transaction_date,p_category_id,
    p_buyer_member_id,'account',p_source_account_id,null,p_splits,1,p_notes
  );

  perform public.settle_direct_expense(
    p_household_id,tx,p_source_account_id,p_funder_member_id,p_amount,p_paid_at
  );

  return tx;
end;
$$;

comment on function public.create_and_settle_direct_expense(uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,timestamptz,text) is
  'Atomic direct-expense creation when cash already left. Creates one economic expense, then realizes Funding + Caixa through settle_direct_expense. Never infers funder from buyer, instrument or account ownership.';

revoke all on function public.create_and_settle_direct_expense(uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,timestamptz,text) from public,anon;
grant execute on function public.create_and_settle_direct_expense(uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,timestamptz,text) to authenticated;
