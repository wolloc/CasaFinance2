-- UX de homologação:
-- 1) nome de membro local à Casa;
-- 2) categoria opcional para renda, inclusive recorrente.
-- Mudança aditiva e compatível com os fluxos existentes.

alter table public.household_members
  add column if not exists display_name text;

alter table public.household_members
  drop constraint if exists household_members_display_name_length;
alter table public.household_members
  add constraint household_members_display_name_length
  check (display_name is null or (char_length(trim(display_name)) between 1 and 80));

create or replace function public.set_household_member_display_name(
  p_household_id uuid,
  p_member_id uuid,
  p_display_name text
) returns text
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  target public.household_members;
  normalized text:=nullif(trim(p_display_name),'');
begin
  caller:=public.require_active_member(p_household_id);
  if normalized is null then
    raise exception 'display name is required' using errcode='22023';
  end if;
  if char_length(normalized)>80 then
    raise exception 'display name is too long' using errcode='22023';
  end if;

  select * into target
  from public.household_members
  where id=p_member_id
    and household_id=p_household_id
    and deactivated_at is null
  for update;

  if target.id is null then
    raise exception 'active household member required' using errcode='23514';
  end if;
  if caller.id<>target.id and caller.role<>'owner' then
    raise exception 'only the household owner can rename another member' using errcode='42501';
  end if;

  update public.household_members
  set display_name=normalized
  where id=target.id;

  return normalized;
end
$$;

revoke all on function public.set_household_member_display_name(uuid,uuid,text) from public,anon;
grant execute on function public.set_household_member_display_name(uuid,uuid,text) to authenticated;

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
  if p_category_id is not null and not exists(
    select 1 from public.categories
    where id=p_category_id and household_id=p_household_id and type='income' and deactivated_at is null
  ) then
    raise exception 'active household income category required when informed' using errcode='23514';
  end if;
  if not exists(
    select 1 from public.household_members
    where id=p_beneficiary_member_id and household_id=p_household_id and deactivated_at is null
  ) then
    raise exception 'active household beneficiary required' using errcode='23514';
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

create or replace function public.correct_income_fact(
  p_household_id uuid,
  p_transaction_id uuid,
  p_description text,
  p_amount numeric,
  p_expected_date date,
  p_category_id uuid,
  p_reason text,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx public.transactions;
  movement public.money_movements;
  event_id uuid;
  before_payload jsonb;
  after_payload jsonb;
begin
  caller:=public.require_active_member(p_household_id);
  if p_amount<=0 or p_expected_date is null or length(trim(coalesce(p_description,'')))=0
     or length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'invalid income correction command' using errcode='22023'; end if;
  if p_category_id is not null and not exists(
    select 1 from public.categories
    where id=p_category_id and household_id=p_household_id and type='income' and deactivated_at is null
  ) then
    raise exception 'active household income category required when informed' using errcode='23514';
  end if;

  select * into tx from public.transactions
  where id=p_transaction_id and household_id=p_household_id and type='income' and deleted_at is null
  for update;
  if tx.id is null then raise exception 'income not found' using errcode='23514'; end if;
  if tx.economic_state not in ('forecast','confirmed') or tx.realized_amount<>0 or tx.status<>'pending'
  then raise exception 'only unrealized pending income can be corrected' using errcode='0A000'; end if;
  if exists(select 1 from public.recurring_occurrences r where r.household_id=p_household_id and r.transaction_id=tx.id)
  then raise exception 'recurring income must be changed through recurring series management' using errcode='0A000'; end if;

  select * into movement from public.money_movements m
   where m.household_id=p_household_id and m.related_transaction_id=tx.id and m.kind='income' and m.state='projected'
   order by m.created_at limit 1 for update;
  if movement.id is null or exists(
    select 1 from public.money_movements m
    where m.household_id=p_household_id and m.related_transaction_id=tx.id and m.kind='income'
      and m.state='projected' and m.id<>movement.id
  ) then raise exception 'income projected cash leg is not uniquely resolvable' using errcode='0A000'; end if;

  before_payload:=jsonb_build_object('description',tx.description,'amount',tx.amount,'expected_date',tx.transaction_date,'category_id',tx.category_id);
  after_payload:=jsonb_build_object('description',trim(p_description),'amount',p_amount,'expected_date',p_expected_date,'category_id',p_category_id);

  insert into public.transaction_adjustment_events(
    household_id,source_transaction_id,kind,before_payload,after_payload,reason,request_key,created_by_member_id
  ) values(
    p_household_id,tx.id,'correction',before_payload,after_payload,trim(p_reason),trim(p_request_key),caller.id
  ) returning id into event_id;

  update public.transactions set
    description=trim(p_description),amount=p_amount,
    estimated_amount=case when tx.economic_state='forecast' then p_amount else estimated_amount end,
    confirmed_amount=case when tx.economic_state='confirmed' then p_amount else confirmed_amount end,
    transaction_date=p_expected_date,competence_date=date_trunc('month',p_expected_date)::date,
    category_id=p_category_id,updated_at=now()
  where id=tx.id;

  update public.money_movements set
    amount=p_amount,description=trim(p_description),category_id=p_category_id,
    movement_date=p_expected_date,competence_date=date_trunc('month',p_expected_date)::date
  where id=movement.id;

  return event_id;
end
$$;

create or replace function public.create_recurring_income_rule(
  p_household_id uuid,
  p_description text,
  p_amount numeric,
  p_start_date date,
  p_end_date date,
  p_frequency text,
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
  rule_id uuid;
  initial_horizon date;
begin
  caller:=public.require_active_member(p_household_id);
  if p_amount<=0 or length(trim(coalesce(p_description,'')))=0 or p_start_date is null then
    raise exception 'positive amount, description and start date are required' using errcode='22023';
  end if;
  if p_frequency not in ('monthly','yearly') then raise exception 'frequency must be monthly or yearly' using errcode='22023'; end if;
  if p_end_date is not null and p_end_date<p_start_date then raise exception 'end date must not precede start date' using errcode='22023'; end if;
  if p_income_nature is null or p_economic_state not in ('forecast','confirmed') then
    raise exception 'income nature and valid confidence are required' using errcode='22023';
  end if;
  if p_category_id is not null and not exists(
    select 1 from public.categories
    where id=p_category_id and household_id=p_household_id and type='income' and deactivated_at is null
  ) then
    raise exception 'active household income category required when informed' using errcode='23514';
  end if;
  if not exists(select 1 from public.household_members where id=p_beneficiary_member_id and household_id=p_household_id and deactivated_at is null)
  then raise exception 'active household beneficiary required' using errcode='23514'; end if;
  if not exists(
    select 1 from public.accounts
    where id=p_planned_destination_account_id and household_id=p_household_id
      and deactivated_at is null and type in ('cash','checking','savings','digital_wallet')
      and resource_restriction is null
  ) then raise exception 'active unrestricted transactional destination required' using errcode='23514'; end if;

  insert into public.recurring_rules(
    household_id,created_by_member_id,template_transaction_id,frequency,interval_count,
    start_date,end_date,next_occurrence_date,amount_mode,estimated_amount,
    income_description,income_category_id,income_beneficiary_member_id,
    income_destination_account_id,income_nature,income_economic_state,income_notes
  ) values(
    p_household_id,caller.id,null,p_frequency,1,p_start_date,p_end_date,p_start_date,'fixed',p_amount,
    trim(p_description),p_category_id,p_beneficiary_member_id,p_planned_destination_account_id,
    p_income_nature,p_economic_state,nullif(trim(coalesce(p_notes,'')),'')
  ) returning id into rule_id;

  initial_horizon:=least(coalesce(p_end_date,(current_date+interval '12 months')::date),(current_date+interval '12 months')::date);
  if initial_horizon<p_start_date then initial_horizon:=p_start_date; end if;
  perform public.materialize_recurring_income_occurrences(p_household_id,rule_id,initial_horizon);
  return rule_id;
end
$$;

create or replace function public.materialize_recurring_income_occurrences(
  p_household_id uuid,
  p_rule_id uuid,
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
  tx_id uuid;
  created_count integer:=0;
  n integer;
  max_steps integer:=240;
begin
  caller:=public.require_active_member(p_household_id);
  select * into r from public.recurring_rules
  where id=p_rule_id and household_id=p_household_id and deactivated_at is null
  for update;

  if r.id is null or r.income_nature is null or r.income_beneficiary_member_id is null
     or r.income_destination_account_id is null or r.income_economic_state not in ('forecast','confirmed') then
    raise exception 'active recurring income rule required' using errcode='23514';
  end if;
  if p_through_date<r.start_date then return 0; end if;

  for n in 0..max_steps loop
    occurrence_date:=case r.frequency
      when 'monthly' then (r.start_date + make_interval(months=>n*r.interval_count))::date
      when 'yearly' then (r.start_date + make_interval(years=>n*r.interval_count))::date
      else null end;

    if occurrence_date is null then
      raise exception 'recurring income supports monthly or yearly frequency' using errcode='22023';
    end if;
    exit when occurrence_date>p_through_date;
    if r.end_date is not null and occurrence_date>r.end_date then exit; end if;

    if exists(
      select 1 from public.recurring_occurrences
      where household_id=p_household_id and recurring_rule_id=r.id and competence_date=occurrence_date
    ) then continue; end if;

    insert into public.transactions(
      household_id,created_by_member_id,category_id,type,status,economic_state,
      description,amount,estimated_amount,confirmed_amount,realized_amount,
      transaction_date,competence_date,notes,income_nature
    ) values(
      p_household_id,caller.id,r.income_category_id,'income','pending',r.income_economic_state,
      r.income_description,r.estimated_amount,r.estimated_amount,
      case when r.income_economic_state='confirmed' then r.estimated_amount end,
      0,occurrence_date,date_trunc('month',occurrence_date)::date,r.income_notes,r.income_nature
    ) returning id into tx_id;

    insert into public.money_movements(
      household_id,created_by_member_id,kind,state,amount,description,
      beneficiary_member_id,destination_account_id,category_id,related_transaction_id,
      movement_date,competence_date
    ) values(
      p_household_id,caller.id,'income','projected',r.estimated_amount,r.income_description,
      r.income_beneficiary_member_id,r.income_destination_account_id,r.income_category_id,tx_id,
      occurrence_date,date_trunc('month',occurrence_date)::date
    );

    insert into public.recurring_occurrences(
      household_id,recurring_rule_id,transaction_id,competence_date,status,
      estimated_amount,confirmed_amount,confirmed_at
    ) values(
      p_household_id,r.id,tx_id,occurrence_date,'planned',r.estimated_amount,
      case when r.income_economic_state='confirmed' then r.estimated_amount end,
      case when r.income_economic_state='confirmed' then now() end
    );
    created_count:=created_count+1;
  end loop;

  update public.recurring_rules
  set next_occurrence_date=(
    select min(x.d) from (
      select case r.frequency
        when 'monthly' then (r.start_date + make_interval(months=>g*r.interval_count))::date
        else (r.start_date + make_interval(years=>g*r.interval_count))::date end d
      from generate_series(0,max_steps) g
    ) x
    where x.d>p_through_date and (r.end_date is null or x.d<=r.end_date)
  ),updated_at=now()
  where id=r.id;

  return created_count;
end
$$;

revoke all on function public.create_income_fact(uuid,text,numeric,date,uuid,uuid,uuid,public.income_nature,public.economic_state,text) from public,anon;
revoke all on function public.correct_income_fact(uuid,uuid,text,numeric,date,uuid,text,text) from public,anon;
revoke all on function public.create_recurring_income_rule(uuid,text,numeric,date,date,text,uuid,uuid,uuid,public.income_nature,public.economic_state,text) from public,anon;
revoke all on function public.materialize_recurring_income_occurrences(uuid,uuid,date) from public,anon;
grant execute on function public.create_income_fact(uuid,text,numeric,date,uuid,uuid,uuid,public.income_nature,public.economic_state,text) to authenticated;
grant execute on function public.correct_income_fact(uuid,uuid,text,numeric,date,uuid,text,text) to authenticated;
grant execute on function public.create_recurring_income_rule(uuid,text,numeric,date,date,text,uuid,uuid,uuid,public.income_nature,public.economic_state,text) to authenticated;
grant execute on function public.materialize_recurring_income_occurrences(uuid,uuid,date) to authenticated;
