-- #270 phase A: canonical reference-month context for the Casa dashboard.
-- Historical months are reconstructed from dated canonical ledger facts.
-- No projection snapshot is persisted and legacy accounts.opening_balance is not reused.

create or replace function public.financial_available_cash_at_date(
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

  -- A historical cash value before the configured cutover would pretend that
  -- legacy data is complete. NULL means "not covered by canonical tracking".
  if v_tracking_start is null or p_as_of_date<v_tracking_start then
    return null;
  end if;

  with eligible_accounts as (
    select a.id
      from public.accounts a
     where a.household_id=p_household_id
       and a.type in ('cash','checking','savings','digital_wallet')
       and a.resource_restriction is null
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
       and m.movement_date between v_tracking_start and p_as_of_date

    union all

    select (-m.amount)::numeric(19,2)
      from public.money_movements m
      join eligible_accounts a on a.id=m.source_account_id
     where m.household_id=p_household_id
       and m.state='realized'
       and m.movement_date between v_tracking_start and p_as_of_date
  )
  select coalesce(sum(l.amount),0)::numeric(19,2)
    into v_amount
    from legs l;

  return v_amount;
end
$$;

comment on function public.financial_available_cash_at_date(uuid,date) is
  'Canonical household available cash as of a tracked date. Uses non-reversed balance events plus realized money-movement legs, respects the household financial cutover, excludes restricted resources, benefits, investments and credit, and never reads legacy opening_balance. Returns NULL before canonical tracking starts.';

revoke all on function public.financial_available_cash_at_date(uuid,date)
  from public,anon;
grant execute on function public.financial_available_cash_at_date(uuid,date)
  to authenticated;

create or replace function public.financial_reference_month_context(
  p_household_id uuid,
  p_reference_month date
)
returns table (
  household_id uuid,
  reference_month date,
  household_current_month date,
  period_kind text,
  tracking_started_on date,
  coverage_state text,
  tracked_period_start date,
  period_end date,
  historical_opening_cash numeric(19,2),
  historical_closing_cash numeric(19,2),
  can_navigate boolean
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
#variable_conflict use_column
declare
  v_reference_month date:=date_trunc('month',p_reference_month)::date;
  v_period_end date;
  v_tracking_start date;
  v_timezone text;
  v_household_today date;
  v_current_month date;
  v_period_kind text;
  v_coverage text;
  v_tracked_period_start date;
  v_opening numeric(19,2);
  v_closing numeric(19,2);
  v_can_navigate boolean;
begin
  if p_household_id is null or p_reference_month is null then
    raise exception 'household and reference month are required' using errcode='22004';
  end if;
  if p_reference_month<>v_reference_month then
    raise exception 'reference month must be the first day of a month' using errcode='22023';
  end if;
  if not public.is_active_household_member(p_household_id) then
    raise exception 'active household membership required' using errcode='42501';
  end if;

  select h.financial_tracking_started_on,h.timezone
    into v_tracking_start,v_timezone
    from public.households h
   where h.id=p_household_id
     and h.deleted_at is null;

  if not found then
    raise exception 'active household required' using errcode='23514';
  end if;

  v_household_today:=(current_timestamp at time zone v_timezone)::date;
  v_current_month:=date_trunc('month',v_household_today)::date;
  v_period_end:=(v_reference_month+interval '1 month'-interval '1 day')::date;

  v_period_kind:=case
    when v_reference_month<v_current_month then 'past'
    when v_reference_month=v_current_month then 'current'
    else 'future'
  end;

  v_coverage:=case
    when v_tracking_start is null then 'unconfigured'
    when v_period_end<v_tracking_start then 'unavailable'
    when v_reference_month<v_tracking_start then 'partial'
    else 'full'
  end;

  v_can_navigate:=v_tracking_start is not null and v_period_end>=v_tracking_start;
  v_tracked_period_start:=case
    when not v_can_navigate then null
    else greatest(v_reference_month,v_tracking_start)
  end;

  -- Only closed months expose historical cash. Current and future months keep
  -- using current-position/projection read models and cannot be mislabeled as facts.
  if v_period_kind='past' and v_can_navigate then
    v_closing:=public.financial_available_cash_at_date(p_household_id,v_period_end);

    -- A full first month that starts exactly on the cutover uses confirmed
    -- opening-position events. A partial first month returns NULL because no
    -- canonical pre-cutover opening exists; later months use prior-day close.
    if v_reference_month=v_tracking_start then
      -- When tracking starts on day one, onboarding opening events are the
      -- confirmed beginning-of-month position. Movements on that date are not
      -- part of the opening balance.
      select coalesce(sum(e.amount),0)::numeric(19,2)
        into v_opening
        from public.account_balance_events e
        join public.accounts a
          on a.id=e.account_id
         and a.household_id=e.household_id
       where e.household_id=p_household_id
         and e.kind='opening'
         and e.reversed_at is null
         and e.effective_date=v_tracking_start
         and a.type in ('cash','checking','savings','digital_wallet')
         and a.resource_restriction is null;
    elsif v_reference_month>v_tracking_start then
      v_opening:=public.financial_available_cash_at_date(
        p_household_id,
        (v_reference_month-interval '1 day')::date
      );
    end if;
  end if;

  return query
  select p_household_id,v_reference_month,v_current_month,v_period_kind,
         v_tracking_start,v_coverage,v_tracked_period_start,v_period_end,
         v_opening,v_closing,v_can_navigate;
end
$$;

comment on function public.financial_reference_month_context(uuid,date) is
  'Reference-month semantics for Dashboard navigation. Past/current/future are explicit; historical cash is exposed only for closed tracked months. Partial/unavailable coverage is surfaced instead of reusing current balances or forecasts as historical facts.';

revoke all on function public.financial_reference_month_context(uuid,date)
  from public,anon;
grant execute on function public.financial_reference_month_context(uuid,date)
  to authenticated;
