-- Release 1: expense recurrence is monthly only (every month, interval 1).
--
-- Product scope:
-- - new/revised expense series repeat monthly on the same economic anchor day;
-- - existing legacy non-monthly rows remain readable/deactivatable, but cannot be
--   created or revised outside the Release 1 contract;
-- - account-based occurrences keep the economic anchor and move only the planned
--   financial due date according to the national business-day calendar.
--
-- Performance:
-- recurring occurrence assembly copies economic allocations row by row. Avoid
-- reconciling member settlements while the allocation set is incomplete, and do
-- not fire UPDATE triggers when rescaling would keep the same cent amounts.

create or replace function public.rescale_economic_allocations(
  p_transaction_id uuid,
  p_new_amount numeric
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if p_new_amount<=0 then
    raise exception 'positive allocation total required' using errcode='22023';
  end if;

  if not exists(
    select 1
    from public.economic_allocations
    where transaction_id=p_transaction_id
  ) then
    return;
  end if;

  if (
    select sum(percentage)
    from public.economic_allocations
    where transaction_id=p_transaction_id
  )<>100 then
    raise exception 'allocation percentages must total 100' using errcode='23514';
  end if;

  with calculated as (
    select
      id,
      floor(round(p_new_amount*100)*percentage/100)::bigint base_cents,
      row_number() over(
        order by
          (round(p_new_amount*100)*percentage/100)
          -floor(round(p_new_amount*100)*percentage/100) desc,
          allocation_order
      ) priority
    from public.economic_allocations
    where transaction_id=p_transaction_id
  ), totals as (
    select
      round(p_new_amount*100)::bigint target_cents,
      sum(base_cents)::bigint base_total
    from calculated
  ), final as (
    select
      c.id,
      (
        c.base_cents
        +case when c.priority<=t.target_cents-t.base_total then 1 else 0 end
      )::numeric/100 amount
    from calculated c
    cross join totals t
  )
  update public.economic_allocations a
     set amount=f.amount
    from final f
   where a.id=f.id
     and a.amount is distinct from f.amount;

  update public.transaction_splits s
     set amount=a.amount
    from public.economic_allocations a
   where s.transaction_id=p_transaction_id
     and a.transaction_id=s.transaction_id
     and a.responsible_member_id=s.responsible_member_id
     and s.amount is distinct from a.amount;
end
$$;

revoke all on function public.rescale_economic_allocations(uuid,numeric)
from public,anon,authenticated;

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
  allocation_percentage numeric;
  allocation_amount numeric;
  expected_amount numeric;
begin
  if tg_table_name='economic_allocations' then
    tx_id:=coalesce(new.transaction_id,old.transaction_id);

    -- INSERT/UPDATE can be part of one atomic allocation assembly/rescale.
    -- Reconcile only when the transaction has a complete 100% allocation whose
    -- cent amount already matches the transaction's canonical effective total.
    if tg_op in ('INSERT','UPDATE') then
      select
        coalesce(sum(a.percentage),0),
        coalesce(sum(a.amount),0)
        into allocation_percentage,allocation_amount
      from public.economic_allocations a
      where a.transaction_id=tx_id;

      select public.financial_effective_total_amount(
               t.economic_state,
               t.estimated_amount,
               t.confirmed_amount,
               t.realized_amount,
               t.amount
             )
        into expected_amount
      from public.transactions t
      where t.id=tx_id
        and t.deleted_at is null;

      if expected_amount is null
         or allocation_percentage<>100
         or round(allocation_amount,2)<>round(expected_amount,2)
      then
        return null;
      end if;
    end if;

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

create or replace function public.enforce_release1_monthly_expense_recurrence()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  template_type public.transaction_kind;
begin
  if new.income_nature is null
     and new.template_transaction_id is not null
  then
    select t.type
      into template_type
    from public.transactions t
    where t.id=new.template_transaction_id
      and t.household_id=new.household_id
      and t.deleted_at is null;

    if template_type='expense'
       and (new.frequency<>'monthly' or new.interval_count<>1)
    then
      raise exception 'Release 1 expense recurrence must be monthly with interval 1'
        using errcode='0A000';
    end if;
  end if;

  return new;
end
$$;

revoke all on function public.enforce_release1_monthly_expense_recurrence()
from public,anon,authenticated;

drop trigger if exists recurring_rules_release1_monthly_expense
on public.recurring_rules;

create trigger recurring_rules_release1_monthly_expense
before insert or update of
  frequency,
  interval_count,
  template_transaction_id,
  income_nature
on public.recurring_rules
for each row
execute function public.enforce_release1_monthly_expense_recurrence();

comment on function public.enforce_release1_monthly_expense_recurrence() is
  'Release 1 guard: new/revised expense recurrence is monthly only, interval 1. Legacy non-monthly expense rows remain readable and may be closed without rewriting history.';

comment on function public.trigger_reconcile_member_settlements() is
  'Reconciles settlements only when allocation/installment assembly is complete, avoiding transient recurring-expense recalculations without changing financial semantics.';
