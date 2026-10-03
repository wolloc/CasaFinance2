-- Casa Finance: benefit credits can be registered from Nova Entrada.
-- A benefit credit is an entry into a restricted benefit resource, not household cash
-- and not true income for projection purposes.

create or replace function public.create_income_fact(
  p_household_id uuid,
  p_description text,
  p_amount numeric,
  p_expected_date date,
  p_category_id uuid,
  p_beneficiary_member_id uuid,
  p_planned_destination_account_id uuid,
  p_income_nature public.income_nature,
  p_economic_state public.economic_state default 'forecast',
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx_id uuid;
  is_benefit_credit boolean:=p_income_nature::text='benefit_credit';
begin
  caller:=public.require_active_member(p_household_id);

  if p_amount<=0 or length(trim(coalesce(p_description,'')))=0 or p_expected_date is null then
    raise exception 'positive amount, description and expected date are required' using errcode='22023';
  end if;
  if p_income_nature is null then
    raise exception 'income nature is required' using errcode='22004';
  end if;
  if p_economic_state not in ('forecast','confirmed') then
    raise exception 'income creation state must be forecast or confirmed' using errcode='22023';
  end if;

  if is_benefit_credit then
    if p_category_id is not null then
      raise exception 'benefit credit does not use income categories' using errcode='22023';
    end if;
    if not exists(
      select 1 from public.accounts
      where id=p_planned_destination_account_id
        and household_id=p_household_id
        and deactivated_at is null
        and type='meal_benefit'
    ) then
      raise exception 'active benefit destination required' using errcode='23514';
    end if;
  else
    if p_category_id is not null and not exists(
      select 1 from public.categories
      where id=p_category_id and household_id=p_household_id and type='income' and deactivated_at is null
    ) then
      raise exception 'active household income category required when informed' using errcode='23514';
    end if;
    if not exists(
      select 1 from public.accounts
      where id=p_planned_destination_account_id
        and household_id=p_household_id
        and deactivated_at is null
        and type in ('cash','checking','savings','digital_wallet')
        and resource_restriction is null
    ) then
      raise exception 'active unrestricted transactional destination required' using errcode='23514';
    end if;
  end if;

  if not exists(
    select 1
    from public.household_members
    where id=p_beneficiary_member_id and household_id=p_household_id and deactivated_at is null
  ) then
    raise exception 'active household beneficiary required' using errcode='23514';
  end if;

  if not exists(
    select 1
    from public.account_ownerships ownership
    where ownership.household_id=p_household_id
      and ownership.account_id=p_planned_destination_account_id
      and ownership.member_id=p_beneficiary_member_id
  ) then
    raise exception 'income destination account must belong to beneficiary'
      using errcode='23514';
  end if;

  insert into public.transactions(
    household_id,created_by_member_id,category_id,type,status,economic_state,
    description,amount,estimated_amount,confirmed_amount,realized_amount,
    transaction_date,competence_date,notes,income_nature
  ) values(
    p_household_id,caller.id,p_category_id,'income','pending',p_economic_state,
    trim(p_description),p_amount,p_amount,
    case when p_economic_state='confirmed' then p_amount end,
    0,p_expected_date,date_trunc('month',p_expected_date)::date,
    nullif(trim(coalesce(p_notes,'')),''),p_income_nature
  ) returning id into tx_id;

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,
    beneficiary_member_id,destination_account_id,category_id,related_transaction_id,
    movement_date,competence_date
  ) values(
    p_household_id,caller.id,'income','projected',p_amount,trim(p_description),
    p_beneficiary_member_id,p_planned_destination_account_id,p_category_id,tx_id,
    p_expected_date,date_trunc('month',p_expected_date)::date
  );

  return tx_id;
end
$$;

create or replace function public.settle_income(
  p_household_id uuid,
  p_transaction_id uuid,
  p_destination_account_id uuid,
  p_beneficiary_member_id uuid,
  p_amount numeric,
  p_received_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx public.transactions;
  movement_id uuid;
  is_benefit_credit boolean;
begin
  caller:=public.require_active_member(p_household_id);

  select * into tx
  from public.transactions
  where id=p_transaction_id
    and household_id=p_household_id
    and type='income'
    and deleted_at is null
  for update;

  if tx.id is null
     or tx.economic_state in ('cancelled','reversed')
     or p_amount<=0
     or tx.realized_amount+p_amount>coalesce(tx.confirmed_amount,tx.amount)
  then
    raise exception 'invalid income settlement' using errcode='23514';
  end if;

  is_benefit_credit:=tx.income_nature::text='benefit_credit';

  if not exists(
       select 1 from public.accounts a
       where a.id=p_destination_account_id
         and a.household_id=p_household_id
         and a.deactivated_at is null
         and (
           (is_benefit_credit and a.type='meal_benefit')
           or
           (not is_benefit_credit and a.type in ('cash','checking','savings','digital_wallet') and a.resource_restriction is null)
         )
     )
     or not exists(
       select 1 from public.household_members
       where id=p_beneficiary_member_id and household_id=p_household_id and deactivated_at is null
     )
  then
    raise exception 'destination and beneficiary must belong to household' using errcode='23514';
  end if;

  if not exists(
    select 1
    from public.account_ownerships ownership
    where ownership.household_id=p_household_id
      and ownership.account_id=p_destination_account_id
      and ownership.member_id=p_beneficiary_member_id
  ) then
    raise exception 'income destination account must belong to beneficiary' using errcode='23514';
  end if;

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,
    beneficiary_member_id,destination_account_id,category_id,related_transaction_id,
    movement_date,competence_date,realized_at
  )
  values(
    p_household_id,caller.id,'income','realized',p_amount,tx.description,
    p_beneficiary_member_id,p_destination_account_id,tx.category_id,tx.id,
    p_received_at::date,date_trunc('month',p_received_at)::date,p_received_at
  )
  returning id into movement_id;

  update public.transactions
  set
    realized_amount=realized_amount+p_amount,
    economic_state=case
      when realized_amount+p_amount=coalesce(confirmed_amount,amount)
        then 'realized'::public.economic_state
      else 'confirmed'::public.economic_state
    end,
    status=case
      when realized_amount+p_amount=coalesce(confirmed_amount,amount)
        then 'received'::public.transaction_state
      else 'pending'::public.transaction_state
    end,
    settled_at=case
      when realized_amount+p_amount=coalesce(confirmed_amount,amount) then p_received_at
      else null
    end,
    updated_at=now()
  where id=tx.id;

  return movement_id;
end
$$;

revoke all on function public.create_income_fact(uuid,text,numeric,date,uuid,uuid,uuid,public.income_nature,public.economic_state,text) from public,anon,authenticated;
grant execute on function public.create_income_fact(uuid,text,numeric,date,uuid,uuid,uuid,public.income_nature,public.economic_state,text) to authenticated;
revoke all on function public.settle_income(uuid,uuid,uuid,uuid,numeric,timestamptz) from public,anon;
grant execute on function public.settle_income(uuid,uuid,uuid,uuid,numeric,timestamptz) to authenticated;

comment on function public.create_income_fact(uuid,text,numeric,date,uuid,uuid,uuid,public.income_nature,public.economic_state,text) is
  'Creates true income or a benefit credit. Benefit credits land in restricted benefit resources and remain excluded from household true-income/cash projection.';
comment on function public.settle_income(uuid,uuid,uuid,uuid,numeric,timestamptz) is
  'Realizes true income or a benefit credit. Benefit credits update only the restricted benefit resource balance.';

