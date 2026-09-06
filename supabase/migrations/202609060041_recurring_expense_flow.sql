-- Etapa 10Y: recorrencia canonica de gastos a partir de um fato ja configurado.
-- Preserva comprador, instrumento e responsabilidade economica do gasto-modelo.

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

create or replace function public.ensure_household_recurring_expense_horizon(
  p_household_id uuid,
  p_through_date date
) returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  r public.recurring_rules;
  occurrence_date date;
  n integer;
  created_count integer:=0;
  max_steps integer:=240;
begin
  caller:=public.require_active_member(p_household_id);
  for r in
    select rr.* from public.recurring_rules rr
    join public.transactions t on t.id=rr.template_transaction_id and t.household_id=rr.household_id
    where rr.household_id=p_household_id and rr.deactivated_at is null and rr.income_nature is null and t.type='expense' and t.deleted_at is null
  loop
    for n in 0..max_steps loop
      occurrence_date:=case r.frequency
        when 'weekly' then (r.start_date + (n*r.interval_count*7))::date
        when 'monthly' then (r.start_date + make_interval(months=>n*r.interval_count))::date
        when 'yearly' then (r.start_date + make_interval(years=>n*r.interval_count))::date
      end;
      exit when occurrence_date>p_through_date;
      if r.end_date is not null and occurrence_date>r.end_date then exit; end if;
      if not exists(select 1 from public.recurring_occurrences where household_id=p_household_id and recurring_rule_id=r.id and competence_date=occurrence_date) then
        perform public.generate_recurring_occurrence(p_household_id,r.id,occurrence_date);
        created_count:=created_count+1;
      end if;
    end loop;
  end loop;
  return created_count;
end
$$;

revoke all on function public.create_recurring_expense_rule_from_transaction(uuid,uuid,text,integer,date,date) from public,anon;
revoke all on function public.ensure_household_recurring_expense_horizon(uuid,date) from public,anon;
grant execute on function public.create_recurring_expense_rule_from_transaction(uuid,uuid,text,integer,date,date) to authenticated;
grant execute on function public.ensure_household_recurring_expense_horizon(uuid,date) to authenticated;

comment on function public.create_recurring_expense_rule_from_transaction(uuid,uuid,text,integer,date,date) is
  'Creates a recurring expense series from an existing canonical expense. Buyer, payment instrument and economic allocations are preserved by generate_recurring_occurrence; no funder is inferred.';
