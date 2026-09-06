-- Etapa 10AJ: gestão auditável de renda unitária.
-- Corrige/cancela o fato econômico e sua perna de caixa apenas projetada de forma atômica.

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
  if not exists(select 1 from public.categories where id=p_category_id and household_id=p_household_id and type='income' and deactivated_at is null)
  then raise exception 'active household income category required' using errcode='23514'; end if;

  select * into tx from public.transactions where id=p_transaction_id and household_id=p_household_id and type='income' and deleted_at is null for update;
  if tx.id is null then raise exception 'income not found' using errcode='23514'; end if;
  if tx.economic_state not in ('forecast','confirmed') or tx.realized_amount<>0 or tx.status<>'pending'
  then raise exception 'only unrealized pending income can be corrected' using errcode='0A000'; end if;
  if exists(select 1 from public.recurring_occurrences r where r.household_id=p_household_id and r.transaction_id=tx.id)
  then raise exception 'recurring income must be changed through recurring series management' using errcode='0A000'; end if;

  select * into movement from public.money_movements m
   where m.household_id=p_household_id and m.related_transaction_id=tx.id and m.kind='income' and m.state='projected'
   order by m.created_at limit 1 for update;
  if movement.id is null or exists(select 1 from public.money_movements m where m.household_id=p_household_id and m.related_transaction_id=tx.id and m.kind='income' and m.state='projected' and m.id<>movement.id)
  then raise exception 'income projected cash leg is not uniquely resolvable' using errcode='0A000'; end if;

  before_payload:=jsonb_build_object('description',tx.description,'amount',tx.amount,'expected_date',tx.transaction_date,'category_id',tx.category_id);
  after_payload:=jsonb_build_object('description',trim(p_description),'amount',p_amount,'expected_date',p_expected_date,'category_id',p_category_id);

  insert into public.transaction_adjustment_events(household_id,source_transaction_id,kind,before_payload,after_payload,reason,request_key,created_by_member_id)
  values(p_household_id,tx.id,'correction',before_payload,after_payload,trim(p_reason),trim(p_request_key),caller.id)
  returning id into event_id;

  update public.transactions set
    description=trim(p_description),amount=p_amount,
    estimated_amount=case when tx.economic_state='forecast' then p_amount else estimated_amount end,
    confirmed_amount=case when tx.economic_state='confirmed' then p_amount else confirmed_amount end,
    transaction_date=p_expected_date,competence_date=date_trunc('month',p_expected_date)::date,category_id=p_category_id,updated_at=now()
  where id=tx.id;

  update public.money_movements set
    amount=p_amount,description=trim(p_description),category_id=p_category_id,
    movement_date=p_expected_date,competence_date=date_trunc('month',p_expected_date)::date,updated_at=now()
  where id=movement.id;

  return event_id;
end $$;

create or replace function public.cancel_income_fact(
  p_household_id uuid,
  p_transaction_id uuid,
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
begin
  caller:=public.require_active_member(p_household_id);
  if length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'reason and request key are required' using errcode='22023'; end if;

  select * into tx from public.transactions where id=p_transaction_id and household_id=p_household_id and type='income' and deleted_at is null for update;
  if tx.id is null then raise exception 'income not found' using errcode='23514'; end if;
  if tx.economic_state not in ('forecast','confirmed') or tx.realized_amount<>0 or tx.status<>'pending'
  then raise exception 'only unrealized pending income can be cancelled' using errcode='0A000'; end if;
  if exists(select 1 from public.recurring_occurrences r where r.household_id=p_household_id and r.transaction_id=tx.id)
  then raise exception 'recurring income must be changed through recurring series management' using errcode='0A000'; end if;

  select * into movement from public.money_movements m
   where m.household_id=p_household_id and m.related_transaction_id=tx.id and m.kind='income' and m.state='projected'
   order by m.created_at limit 1 for update;
  if movement.id is null then raise exception 'projected income movement not found' using errcode='0A000'; end if;

  insert into public.transaction_adjustment_events(household_id,source_transaction_id,kind,before_payload,after_payload,reason,request_key,created_by_member_id)
  values(p_household_id,tx.id,'cancellation',jsonb_build_object('economic_state',tx.economic_state,'status',tx.status,'amount',tx.amount),jsonb_build_object('economic_state','cancelled','status','cancelled','amount',tx.amount),trim(p_reason),trim(p_request_key),caller.id)
  returning id into event_id;

  update public.transactions set economic_state='cancelled',status='cancelled',updated_at=now() where id=tx.id;
  update public.money_movements set state='cancelled',updated_at=now() where id=movement.id;
  return event_id;
end $$;

revoke all on function public.correct_income_fact(uuid,uuid,text,numeric,date,uuid,text,text) from public,anon;
grant execute on function public.correct_income_fact(uuid,uuid,text,numeric,date,uuid,text,text) to authenticated;
revoke all on function public.cancel_income_fact(uuid,uuid,text,text) from public,anon;
grant execute on function public.cancel_income_fact(uuid,uuid,text,text) to authenticated;

comment on function public.correct_income_fact(uuid,uuid,text,numeric,date,uuid,text,text) is 'Audited correction of one unrealized non-recurring true-income fact and its unique projected cash leg.';
comment on function public.cancel_income_fact(uuid,uuid,text,text) is 'Audited cancellation of one unrealized non-recurring true-income fact; projected cash leg is cancelled, never realized or deleted.';
