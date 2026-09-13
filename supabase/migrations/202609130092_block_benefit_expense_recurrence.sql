-- Regra de produto: VA/VR/benefício é recurso restrito e seus usos não podem
-- originar séries recorrentes. Cada uso deve ser registrado quando acontecer.
-- Forward-only: endurece o comando canônico sem alterar migrations históricas.

create or replace function public.create_recurring_expense_rule_from_transaction(
  p_household_id uuid,
  p_template_transaction_id uuid,
  p_frequency text,
  p_interval_count integer,
  p_start_date date,
  p_end_date date default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx public.transactions;
  rule_id uuid;
begin
  caller:=public.require_active_member(p_household_id);
  select * into tx from public.transactions
   where id=p_template_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null
   for update;
  if tx.id is null or tx.economic_state in ('cancelled','reversed') then
    raise exception 'active household expense template required' using errcode='23514';
  end if;
  if p_frequency not in ('weekly','monthly','yearly') or p_interval_count<1 then
    raise exception 'invalid recurring expense frequency' using errcode='22023';
  end if;
  if p_start_date is null or p_start_date<=tx.transaction_date then
    raise exception 'first recurring occurrence must be after the source expense date' using errcode='22023';
  end if;
  if p_end_date is not null and p_end_date<p_start_date then
    raise exception 'end date must not precede start date' using errcode='22023';
  end if;
  if not exists(select 1 from public.economic_allocations where transaction_id=tx.id) then
    raise exception 'expense template requires explicit economic responsibility' using errcode='23514';
  end if;
  if (select coalesce(sum(percentage),0) from public.economic_allocations where transaction_id=tx.id)<>100 then
    raise exception 'expense template responsibility must total 100 percent' using errcode='23514';
  end if;
  if exists(
    select 1
    from public.transaction_payment_instruments pi
    join public.accounts a
      on a.id=pi.account_id
     and a.household_id=pi.household_id
    where pi.household_id=p_household_id
      and pi.transaction_id=tx.id
      and pi.kind='account'
      and a.type='meal_benefit'
  ) then
    raise exception 'benefit expenses cannot become recurring series' using errcode='0A000';
  end if;

  insert into public.recurring_rules(
    household_id,created_by_member_id,template_transaction_id,frequency,interval_count,start_date,end_date,next_occurrence_date,amount_mode,estimated_amount
  ) values(
    p_household_id,caller.id,tx.id,p_frequency,p_interval_count,p_start_date,p_end_date,p_start_date,
    case when tx.economic_state='forecast' then 'estimated' else 'fixed' end,
    coalesce(tx.confirmed_amount,tx.estimated_amount,tx.amount)
  ) returning id into rule_id;
  return rule_id;
end
$$;

revoke all on function public.create_recurring_expense_rule_from_transaction(uuid,uuid,text,integer,date,date) from public,anon;
grant execute on function public.create_recurring_expense_rule_from_transaction(uuid,uuid,text,integer,date,date) to authenticated;

comment on function public.create_recurring_expense_rule_from_transaction(uuid,uuid,text,integer,date,date) is
  'Creates a recurring expense series from an existing canonical expense while rejecting benefit-funded templates. Buyer, payment instrument and economic allocations are preserved; no funder is inferred.';
