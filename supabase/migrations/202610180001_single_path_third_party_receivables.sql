-- Keep third-party receivable creation in one canonical path.
-- funding_events materializes funded receivables. The legacy shared-expense
-- command must not create a second receivable for the same allocation.
-- Preserve the caller-provided due date by updating the receivables created
-- by the funding trigger after settle_direct_expense returns.

create or replace function public.create_and_settle_shared_expense(
 p_household_id uuid,p_description text,p_gross_amount numeric,p_transaction_date date,p_category_id uuid,p_buyer_member_id uuid,
 p_source_account_id uuid,p_funder_member_id uuid,p_splits jsonb,p_receivable_due_date date default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  tx uuid;
  split jsonb;
  party_id uuid;
begin
  perform public.require_active_member(p_household_id);

  tx:=public.create_financial_transaction(
    p_household_id,'expense',p_description,p_gross_amount,p_transaction_date,
    p_category_id,p_buyer_member_id,'account',p_source_account_id,null,p_splits,1,p_notes
  );

  perform public.settle_direct_expense(
    p_household_id,tx,p_source_account_id,p_funder_member_id,
    p_gross_amount,p_transaction_date::timestamptz
  );

  -- The funding trigger has already materialized one receivable per external
  -- economic allocation. Update its due date; do not insert another obligation.
  for split in select * from jsonb_array_elements(p_splits) loop
    if split ? 'party_id' then
      party_id:=(split->>'party_id')::uuid;
      update public.financial_obligations o
      set due_date=coalesce(p_receivable_due_date,o.due_date),
          updated_at=now()
      where o.household_id=p_household_id
        and o.source_transaction_id=tx
        and o.kind='receivable'
        and o.origin_kind='shared_expense'
        and o.counterparty_id=party_id;
    end if;
  end loop;

  return tx;
end $$;

revoke all on function public.create_and_settle_shared_expense(uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,date,text) from public,anon;
grant execute on function public.create_and_settle_shared_expense(uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,date,text) to authenticated;
