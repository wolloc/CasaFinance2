-- Go-live etapa 2: reconciliação explícita de contas legadas na data de corte.
-- Nenhum saldo/titular legado é promovido automaticamente para fonte canônica.

create or replace function public.set_household_financial_tracking_start(
  p_household_id uuid,
  p_started_on date
) returns date
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  current_start date;
  household_timezone text;
  household_today date;
begin
  perform public.require_active_member(p_household_id);

  select financial_tracking_started_on, timezone
    into current_start, household_timezone
  from public.households
  where id=p_household_id and deleted_at is null
  for update;

  if not found then
    raise exception 'active household required' using errcode='23514';
  end if;

  household_today := (current_timestamp at time zone household_timezone)::date;
  if p_started_on is null or p_started_on>household_today then
    raise exception 'financial tracking start must be today or earlier in household timezone' using errcode='22023';
  end if;

  if current_start is not null and current_start<>p_started_on then
    raise exception 'financial tracking start is immutable after configuration' using errcode='23514';
  end if;

  update public.households
     set financial_tracking_started_on=coalesce(financial_tracking_started_on,p_started_on),
         updated_at=now()
   where id=p_household_id
  returning financial_tracking_started_on into current_start;

  return current_start;
end
$$;

revoke all on function public.set_household_financial_tracking_start(uuid,date) from public,anon,authenticated;

create or replace view public.financial_account_balances with (security_invoker=true) as
with balance_events as (
  select e.household_id,e.account_id,sum(e.amount) amount
  from public.account_balance_events e
  join public.households h on h.id=e.household_id
  where e.reversed_at is null
    and (h.financial_tracking_started_on is null or e.effective_date>=h.financial_tracking_started_on)
  group by e.household_id,e.account_id
), movements as (
  select household_id,account_id,sum(amount) amount from (
    select m.household_id,m.destination_account_id account_id,m.amount
    from public.money_movements m
    join public.households h on h.id=m.household_id
    where m.state='realized'
      and m.destination_account_id is not null
      and (h.financial_tracking_started_on is null or m.movement_date>=h.financial_tracking_started_on)
    union all
    select m.household_id,m.source_account_id account_id,-m.amount
    from public.money_movements m
    join public.households h on h.id=m.household_id
    where m.state='realized'
      and m.source_account_id is not null
      and (h.financial_tracking_started_on is null or m.movement_date>=h.financial_tracking_started_on)
  ) legs
  group by household_id,account_id
)
select a.household_id,a.id account_id,a.name,a.type,a.resource_restriction,a.cash_location,
       coalesce(b.amount,0)+coalesce(m.amount,0) current_balance,
       case when a.resource_restriction is not null or a.type='meal_benefit' then true else false end is_restricted,
       case when a.type='investment' then true else false end is_investment
from public.accounts a
left join balance_events b on b.account_id=a.id and b.household_id=a.household_id
left join movements m on m.account_id=a.id and m.household_id=a.household_id
where a.deactivated_at is null;

revoke all on public.financial_account_balances from public,anon;
grant select on public.financial_account_balances to authenticated;

create or replace function public.reconcile_existing_accounts_at_cutoff(
  p_household_id uuid,
  p_started_on date,
  p_accounts jsonb
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  configured_start date;
  active_account_count integer;
  supplied_account_count integer;
  item jsonb;
  v_account_id uuid;
  opening_amount numeric(19,2);
  owner_ids uuid[];
begin
  caller:=public.require_active_member(p_household_id);

  select financial_tracking_started_on
    into configured_start
  from public.households
  where id=p_household_id and deleted_at is null
  for update;

  if not found then
    raise exception 'active household required' using errcode='23514';
  end if;
  if configured_start is not null then
    raise exception 'legacy cutover is only available before financial tracking starts' using errcode='23514';
  end if;
  if p_accounts is null or jsonb_typeof(p_accounts)<>'array' then
    raise exception 'accounts payload must be an array' using errcode='22023';
  end if;

  select count(*) into active_account_count
  from public.accounts
  where household_id=p_household_id and deactivated_at is null;

  supplied_account_count:=jsonb_array_length(p_accounts);
  if active_account_count=0 or supplied_account_count<>active_account_count then
    raise exception 'all active household accounts must be reconciled together' using errcode='23514';
  end if;

  if exists(
    select 1
    from (
      select (value->>'account_id')::uuid account_id,count(*) occurrences
      from jsonb_array_elements(p_accounts)
      group by (value->>'account_id')::uuid
    ) duplicated
    where duplicated.occurrences<>1
  ) then
    raise exception 'each active account must appear exactly once' using errcode='23514';
  end if;

  if exists(
    select 1
    from jsonb_array_elements(p_accounts) supplied
    left join public.accounts a
      on a.id=(supplied->>'account_id')::uuid
     and a.household_id=p_household_id
     and a.deactivated_at is null
    where a.id is null
  ) then
    raise exception 'all supplied accounts must be active in household' using errcode='23514';
  end if;

  if exists(
    select 1
    from public.accounts a
    where a.household_id=p_household_id
      and a.deactivated_at is null
      and not exists(
        select 1
        from jsonb_array_elements(p_accounts) supplied
        where (supplied->>'account_id')::uuid=a.id
      )
  ) then
    raise exception 'all active household accounts must be reconciled together' using errcode='23514';
  end if;

  if exists(
    select 1
    from public.account_balance_events e
    join public.accounts a
      on a.id=e.account_id
     and a.household_id=e.household_id
    where e.household_id=p_household_id
      and a.deactivated_at is null
      and e.kind='opening'
      and e.reversed_at is null
  ) then
    raise exception 'legacy cutover cannot reinterpret an account that already has canonical opening' using errcode='23514';
  end if;

  perform public.set_household_financial_tracking_start(p_household_id,p_started_on);

  for item in select value from jsonb_array_elements(p_accounts)
  loop
    v_account_id:=(item->>'account_id')::uuid;
    opening_amount:=(item->>'opening_amount')::numeric(19,2);

    if opening_amount is null then
      raise exception 'opening amount is required for every active account' using errcode='22023';
    end if;
    if item->'owner_member_ids' is null or jsonb_typeof(item->'owner_member_ids')<>'array' then
      raise exception 'owner member ids are required for every active account' using errcode='22023';
    end if;

    select array_agg(owner_value::uuid order by owner_order)
      into owner_ids
    from jsonb_array_elements_text(item->'owner_member_ids') with ordinality owners(owner_value,owner_order);

    if coalesce(cardinality(owner_ids),0) not between 1 and 2 then
      raise exception 'one or two account owners are required' using errcode='22023';
    end if;

    perform public.set_account_ownerships(p_household_id,v_account_id,owner_ids);
    perform public.record_account_opening_position(
      p_household_id,v_account_id,opening_amount,p_started_on,'Posição inicial confirmada no corte'
    );

  end loop;

  return p_household_id;
end
$$;

create or replace function public.reconcile_existing_accounts_at_cutoff_idempotent(
  p_household_id uuid,
  p_started_on date,
  p_accounts jsonb,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  existing uuid;
  result uuid;
  op constant text:='reconcile_existing_accounts_at_cutoff';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then return existing; end if;

  result:=public.reconcile_existing_accounts_at_cutoff(p_household_id,p_started_on,p_accounts);
  perform public.financial_command_store(p_household_id,op,p_request_key,result);
  return result;
end
$$;

revoke all on function public.reconcile_existing_accounts_at_cutoff(uuid,date,jsonb) from public,anon,authenticated;
revoke all on function public.reconcile_existing_accounts_at_cutoff_idempotent(uuid,date,jsonb,text) from public,anon;
grant execute on function public.reconcile_existing_accounts_at_cutoff_idempotent(uuid,date,jsonb,text) to authenticated;

comment on function public.reconcile_existing_accounts_at_cutoff(uuid,date,jsonb) is
  'Reconcilia atomicamente contas legadas na data de corte usando saldos e titulares confirmados pelo usuário. Não copia opening_balance/owner_member_id; o read model de saldo ignora efeitos anteriores ao corte e preserva o próprio dia de início e tudo que veio depois.';
