-- Member-aware transfers: one neutral cash movement can also update the
-- continuous net position between two household members.
-- No income or expense is created.

create or replace function public.create_member_position_transfer(
  p_household_id uuid,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text default 'Transferência entre membros'
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx uuid;
  movement uuid;
  source_owner uuid;
  destination_owner uuid;
  source_owner_count integer;
  destination_owner_count integer;
begin
  caller:=public.require_active_member(p_household_id);

  if p_amount<=0 or p_source_account_id=p_destination_account_id or p_date is null then
    raise exception 'invalid member position transfer' using errcode='22023';
  end if;

  if not exists(
    select 1 from public.accounts
    where id=p_source_account_id and household_id=p_household_id and deactivated_at is null
  ) or not exists(
    select 1 from public.accounts
    where id=p_destination_account_id and household_id=p_household_id and deactivated_at is null
  ) then
    raise exception 'active household accounts required' using errcode='23514';
  end if;

  select count(*),(array_agg(ao.member_id order by ao.member_id))[1]
    into source_owner_count,source_owner
  from public.account_ownerships ao
  join public.household_members hm on hm.id=ao.member_id
   and hm.household_id=p_household_id and hm.deactivated_at is null
  where ao.household_id=p_household_id and ao.account_id=p_source_account_id;

  select count(*),(array_agg(ao.member_id order by ao.member_id))[1]
    into destination_owner_count,destination_owner
  from public.account_ownerships ao
  join public.household_members hm on hm.id=ao.member_id
   and hm.household_id=p_household_id and hm.deactivated_at is null
  where ao.household_id=p_household_id and ao.account_id=p_destination_account_id;

  if source_owner_count<>1 or destination_owner_count<>1 or source_owner=destination_owner then
    raise exception 'member position transfer requires two individually owned accounts from distinct members' using errcode='23514';
  end if;

  insert into public.transactions(
    household_id,created_by_member_id,type,status,description,amount,
    transaction_date,competence_date,settled_at
  ) values(
    p_household_id,caller.id,'transfer','paid',coalesce(nullif(trim(p_description),''),'Transferência entre membros'),
    p_amount,p_date,date_trunc('month',p_date)::date,p_date::timestamptz
  ) returning id into tx;

  insert into public.transfers(
    household_id,transaction_id,source_account_id,destination_account_id,settled_at
  ) values(
    p_household_id,tx,p_source_account_id,p_destination_account_id,p_date::timestamptz
  );

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,
    source_account_id,destination_account_id,movement_date,competence_date,realized_at
  ) values(
    p_household_id,caller.id,'member_settlement','realized',p_amount,
    coalesce(nullif(trim(p_description),''),'Transferência entre membros'),
    p_source_account_id,p_destination_account_id,p_date,date_trunc('month',p_date)::date,p_date::timestamptz
  ) returning id into movement;

  -- Money that moved from A to B means B now holds value that belongs to A.
  -- Representing that as an opposite directed position makes the net naturally
  -- reduce, reach zero, or cross zero without a second cash movement.
  insert into public.member_settlement_events(
    household_id,created_by_member_id,debtor_member_id,creditor_member_id,
    amount,state,kind,financial_date,occurred_at,source_money_movement_id,notes
  ) values(
    p_household_id,caller.id,destination_owner,source_owner,p_amount,
    'realized','adjustment',p_date,p_date::timestamptz,movement,
    'Transferência entre recursos de membros diferentes considerada na posição entre vocês'
  );

  return tx;
end;
$$;

create or replace function public.create_member_position_transfer_idempotent(
  p_household_id uuid,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text,
  p_request_key text
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  result uuid;
  existing uuid;
  op constant text:='member_position_transfer';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then return existing; end if;

  result:=public.create_member_position_transfer(
    p_household_id,p_source_account_id,p_destination_account_id,p_amount,p_date,p_description
  );

  perform public.financial_command_store(p_household_id,op,p_request_key,result);
  return result;
end;
$$;

revoke all on function public.create_member_position_transfer(uuid,uuid,uuid,numeric,date,text) from public,anon;
revoke all on function public.create_member_position_transfer_idempotent(uuid,uuid,uuid,numeric,date,text,text) from public,anon;
grant execute on function public.create_member_position_transfer(uuid,uuid,uuid,numeric,date,text) to authenticated;
grant execute on function public.create_member_position_transfer_idempotent(uuid,uuid,uuid,numeric,date,text,text) to authenticated;

comment on function public.create_member_position_transfer(uuid,uuid,uuid,numeric,date,text) is
  'Moves cash once between two individually owned household accounts and updates the continuous member position without creating income or expense.';
