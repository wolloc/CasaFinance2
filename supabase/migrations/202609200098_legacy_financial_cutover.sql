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
  account_id uuid;
  opening_amount numeric(19,2);
  owner_ids uuid[];
  prior_canonical_balance numeric(19,2);
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
    account_id:=(item->>'account_id')::uuid;
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

    select coalesce(current_balance,0)::numeric(19,2)
      into prior_canonical_balance
    from public.financial_account_balances
    where household_id=p_household_id and account_id=account_id;

    prior_canonical_balance:=coalesce(prior_canonical_balance,0);

    perform public.set_account_ownerships(p_household_id,account_id,owner_ids);
    perform public.record_account_opening_position(
      p_household_id,account_id,opening_amount,p_started_on,'Posição inicial confirmada no corte'
    );

    if prior_canonical_balance<>0 then
      insert into public.account_balance_events(
        household_id,account_id,created_by_member_id,kind,amount,effective_date,description
      ) values(
        p_household_id,account_id,caller.id,'adjustment',-prior_canonical_balance,p_started_on,
        'Neutralização do histórico canônico anterior ao corte'
      );
    end if;
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
  'Reconcilia atomicamente contas legadas na data de corte usando saldos e titulares confirmados pelo usuário. Não copia opening_balance/owner_member_id e neutraliza apenas o efeito canônico já existente antes do corte.';
