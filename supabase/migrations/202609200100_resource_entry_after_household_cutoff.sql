-- A Casa has one immutable financial tracking start, while a resource can join later.
-- Its opening event is the resource's first controlled position and is not income/cash movement.

create or replace function public.create_account_with_opening_position(
  p_household_id uuid,
  p_name text,
  p_type public.account_kind,
  p_institution text,
  p_owner_member_ids uuid[],
  p_opening_amount numeric,
  p_effective_date date,
  p_resource_restriction text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  account_id uuid;
  owner_count integer;
  household_start date;
begin
  caller:=public.require_active_member(p_household_id);
  if nullif(trim(p_name),'') is null or p_opening_amount is null or p_effective_date is null then
    raise exception 'account name, opening amount and effective date are required' using errcode='22023';
  end if;
  if p_effective_date>current_date then
    raise exception 'resource tracking start must be today or earlier' using errcode='22023';
  end if;

  select financial_tracking_started_on into household_start
  from public.households
  where id=p_household_id and deleted_at is null
  for update;
  if not found then raise exception 'active household required' using errcode='23514'; end if;

  if household_start is null then
    household_start:=public.set_household_financial_tracking_start(p_household_id,p_effective_date);
  elsif p_effective_date<household_start then
    raise exception 'resource tracking cannot start before household financial tracking' using errcode='23514';
  end if;

  owner_count:=coalesce(array_length(p_owner_member_ids,1),0);
  if owner_count<1 or owner_count>2
     or (select count(distinct member_id) from unnest(p_owner_member_ids) member_id)<>owner_count
     or exists(
       select 1 from unnest(p_owner_member_ids) member_id
       where not exists(
         select 1 from public.household_members m
         where m.id=member_id and m.household_id=p_household_id and m.deactivated_at is null
       )
     ) then
    raise exception 'one or two active household owners are required' using errcode='23514';
  end if;
  if p_resource_restriction is not null and p_resource_restriction not in ('meal_benefit','reserve') then
    raise exception 'invalid account resource restriction' using errcode='22023';
  end if;
  if p_type='meal_benefit'::public.account_kind and coalesce(p_resource_restriction,'meal_benefit')<>'meal_benefit' then
    raise exception 'meal benefit must remain restricted' using errcode='23514';
  end if;

  insert into public.accounts(
    household_id,owner_member_id,name,type,institution,opening_balance,opened_at,resource_restriction
  ) values(
    p_household_id,
    case when owner_count=1 then p_owner_member_ids[1] else null end,
    trim(p_name),p_type,nullif(trim(coalesce(p_institution,'')),''),0,p_effective_date,
    case when p_type='meal_benefit'::public.account_kind then 'meal_benefit' else p_resource_restriction end
  ) returning id into account_id;

  insert into public.account_ownerships(account_id,household_id,member_id)
  select account_id,p_household_id,member_id from unnest(p_owner_member_ids) member_id;

  insert into public.account_balance_events(
    household_id,account_id,created_by_member_id,kind,amount,effective_date,description
  ) values(
    p_household_id,account_id,caller.id,'opening',p_opening_amount,p_effective_date,
    case when p_effective_date=household_start then 'Posição inicial' else 'Posição inicial do recurso' end
  );
  return account_id;
end
$$;

revoke all on function public.create_account_with_opening_position(uuid,text,public.account_kind,text,uuid[],numeric,date,text) from public,anon;
grant execute on function public.create_account_with_opening_position(uuid,text,public.account_kind,text,uuid[],numeric,date,text) to authenticated;
