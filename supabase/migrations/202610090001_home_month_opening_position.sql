-- Casa Home: canonical opening position for the selected month.
-- Unlike the cash-only historical read, this includes usable meal benefits so
-- the opening figure uses the same resource scope as the household projection.
create or replace function public.financial_household_opening_position_at_date(
  p_household_id uuid,
  p_as_of_date date
)
returns numeric
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  v_tracking_start date;
  v_amount numeric(19,2);
begin
  if p_household_id is null or p_as_of_date is null then
    raise exception 'household and as-of date are required' using errcode='22004';
  end if;

  if not public.is_active_household_member(p_household_id) then
    raise exception 'active household membership required' using errcode='42501';
  end if;

  select h.financial_tracking_started_on
    into v_tracking_start
    from public.households h
   where h.id=p_household_id
     and h.deleted_at is null;

  if not found then
    raise exception 'active household required' using errcode='23514';
  end if;

  -- Before canonical tracking starts, the historical position is unknown.
  if v_tracking_start is null or p_as_of_date<v_tracking_start then
    return null;
  end if;

  with eligible_accounts as (
    select a.id
      from public.accounts a
     where a.household_id=p_household_id
       and a.type in ('cash','checking','savings','digital_wallet','meal_benefit')
       and (a.resource_restriction is null or a.resource_restriction='meal_benefit')
  ),
  legs as (
    select e.amount::numeric(19,2) as amount
      from public.account_balance_events e
      join eligible_accounts a on a.id=e.account_id
     where e.household_id=p_household_id
       and e.reversed_at is null
       and e.effective_date between v_tracking_start and p_as_of_date

    union all

    select m.amount::numeric(19,2)
      from public.money_movements m
      join eligible_accounts a on a.id=m.destination_account_id
     where m.household_id=p_household_id
       and m.state='realized'
       and m.movement_date>=v_tracking_start
       and m.movement_date<p_as_of_date

    union all

    select (-m.amount)::numeric(19,2)
      from public.money_movements m
      join eligible_accounts a on a.id=m.source_account_id
     where m.household_id=p_household_id
       and m.state='realized'
       and m.movement_date<p_as_of_date
  )
  select coalesce(sum(l.amount),0)::numeric(19,2)
    into v_amount
    from legs l;

  return v_amount;
end
$$;

comment on function public.financial_household_opening_position_at_date(uuid,date) is
  'Household opening position at the start of a date, based on canonical balance events and realized movement legs before that date. Includes usable meal benefits to match the household projection, excludes investments, reserves, restricted resources and credit, and returns NULL before financial tracking starts.';

revoke all on function public.financial_household_opening_position_at_date(uuid,date)
  from public,anon;
grant execute on function public.financial_household_opening_position_at_date(uuid,date)
  to authenticated;
