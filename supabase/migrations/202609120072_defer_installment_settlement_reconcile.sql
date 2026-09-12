-- Avoid recalculating member settlements after every installment row while a
-- card installment plan is still being assembled.
--
-- The existing trigger remains authoritative for later installment updates.
-- On INSERT, reconciliation runs only when the plan already contains all of its
-- expected installments, so a new N-installment purchase reconciles once instead
-- of N times.

create or replace function public.trigger_reconcile_member_settlements()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  tx_id uuid;
  plan_id uuid;
  expected_count integer;
  actual_count integer;
begin
  if tg_table_name='economic_allocations' then
    tx_id:=coalesce(new.transaction_id,old.transaction_id);
  elsif tg_table_name='installments' then
    plan_id:=coalesce(new.installment_plan_id,old.installment_plan_id);

    select p.purchase_transaction_id,p.installment_count
      into tx_id,expected_count
      from public.installment_plans p
     where p.id=plan_id;

    if tx_id is null then
      return null;
    end if;

    if tg_op='INSERT' then
      select count(*)::integer
        into actual_count
        from public.installments i
       where i.installment_plan_id=plan_id;

      if actual_count<expected_count then
        return null;
      end if;
    end if;
  else
    tx_id:=coalesce(new.financed_transaction_id,old.financed_transaction_id);
  end if;

  perform public.reconcile_member_settlements(tx_id);
  return null;
end
$$;

revoke all on function public.trigger_reconcile_member_settlements()
from public,anon,authenticated;
