-- PR A hardening: external payer is a canonical financing mechanism, not an
-- account/card payment instrument. This forward-only correction makes the
-- already-existing external command compatible with transaction completeness.

create or replace function public.validate_basic_transaction_completeness()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  instrument_count integer;
  external_financing_count integer;
  target_transaction_id uuid;
  target_type public.transaction_kind;
begin
  if tg_table_name = 'transactions' then
    target_transaction_id:=new.id;
    target_type:=new.type;
  else
    target_transaction_id:=new.transaction_id;
    select type into target_type from public.transactions where id=target_transaction_id;
  end if;

  select count(*) into instrument_count
  from public.transaction_payment_instruments i
  where i.transaction_id=target_transaction_id;

  select count(*) into external_financing_count
  from public.financing_allocations f
  where f.transaction_id=target_transaction_id and f.mechanism='external';

  if target_type='expense' then
    if instrument_count>1 then
      raise exception 'expense transaction cannot have more than one payment instrument' using errcode='23514';
    end if;
    if instrument_count=0 and external_financing_count=0 then
      raise exception 'expense transaction requires a payment instrument or external financing' using errcode='23514';
    end if;
  elsif target_type='income' then
    if instrument_count<>0 or external_financing_count<>0 then
      raise exception 'income transaction cannot have an expense payment instrument or external financing' using errcode='23514';
    end if;
  end if;

  return new;
end;
$$;
revoke all on function public.validate_basic_transaction_completeness() from public,anon,authenticated;

create or replace function public.create_externally_paid_expense(
  p_household_id uuid,
  p_description text,
  p_amount numeric,
  p_transaction_date date,
  p_category_id uuid,
  p_buyer_member_id uuid,
  p_splits jsonb,
  p_payer_party_id uuid,
  p_needs_repayment boolean,
  p_due_date date default null,
  p_notes text default null,
  p_request_key text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  existing uuid;
  tx_id uuid;
  event_id uuid;
  intent public.external_payment_intent;
  occurred_at timestamptz;
  split jsonb;
  split_sum numeric:=0;
  pct_sum numeric:=0;
  allocation_order integer:=0;
  has_external_responsibility boolean:=false;
  op constant text := 'create_externally_paid_expense';
begin
  caller:=public.require_active_member(p_household_id);

  if p_request_key is null or length(trim(p_request_key))=0
  then raise exception 'request key is required' using errcode='22023'; end if;
  if p_amount is null or p_amount<=0 or p_transaction_date is null
     or length(trim(coalesce(p_description,'')))=0
  then raise exception 'invalid externally paid expense' using errcode='22023'; end if;
  if p_transaction_date>current_date
  then raise exception 'expense date cannot be in the future' using errcode='22023'; end if;
  if p_needs_repayment and p_due_date is null
  then raise exception 'repayment due date is required' using errcode='22023'; end if;
  if p_due_date is not null and p_due_date<p_transaction_date
  then raise exception 'repayment due date cannot precede expense date' using errcode='22023'; end if;
  if not exists(select 1 from public.household_members where id=p_buyer_member_id and household_id=p_household_id and deactivated_at is null)
  then raise exception 'active household buyer required' using errcode='23514'; end if;
  if p_category_id is not null and not exists(select 1 from public.categories where id=p_category_id and household_id=p_household_id and deactivated_at is null and type='expense')
  then raise exception 'active household expense category required' using errcode='23514'; end if;
  if not exists(select 1 from public.financial_parties where id=p_payer_party_id and household_id=p_household_id and deactivated_at is null)
  then raise exception 'active household external payer required' using errcode='23514'; end if;
  if jsonb_array_length(coalesce(p_splits,'[]'::jsonb))=0
  then raise exception 'expense requires economic allocations' using errcode='23514'; end if;

  existing:=public.financial_command_existing_or_lock(p_household_id,op,trim(p_request_key));
  if existing is not null then return existing; end if;

  select exists(select 1 from jsonb_array_elements(p_splits) s where s ? 'party_id')
  into has_external_responsibility;

  insert into public.transactions(
    household_id,created_by_member_id,buyer_member_id,category_id,type,status,economic_state,
    description,amount,estimated_amount,confirmed_amount,realized_amount,
    transaction_date,competence_date,notes
  ) values (
    p_household_id,caller.id,p_buyer_member_id,p_category_id,'expense','pending','confirmed',
    trim(p_description),p_amount,p_amount,p_amount,0,
    p_transaction_date,date_trunc('month',p_transaction_date)::date,p_notes
  ) returning id into tx_id;

  for split in select * from jsonb_array_elements(p_splits) loop
    allocation_order:=allocation_order+1;
    if (split ? 'member_id') = (split ? 'party_id')
    then raise exception 'each split requires exactly one member_id or party_id' using errcode='23514'; end if;
    if (split->>'amount')::numeric<=0 or (split->>'percentage')::numeric<=0
    then raise exception 'economic allocations must be positive' using errcode='23514'; end if;

    split_sum:=split_sum+(split->>'amount')::numeric;
    pct_sum:=pct_sum+(split->>'percentage')::numeric;

    insert into public.economic_allocations(
      household_id,transaction_id,responsible_member_id,responsible_party_id,
      allocation_order,percentage,amount
    ) values (
      p_household_id,tx_id,
      case when split ? 'member_id' then (split->>'member_id')::uuid end,
      case when split ? 'party_id' then (split->>'party_id')::uuid end,
      allocation_order,(split->>'percentage')::numeric,(split->>'amount')::numeric
    );

    if not has_external_responsibility then
      insert into public.transaction_splits(
        household_id,transaction_id,responsible_member_id,percentage,amount
      ) values (
        p_household_id,tx_id,(split->>'member_id')::uuid,
        (split->>'percentage')::numeric,(split->>'amount')::numeric
      );
    end if;
  end loop;

  if split_sum<>p_amount or pct_sum<>100
  then raise exception 'economic splits must equal transaction amount and 100 percent' using errcode='23514'; end if;

  -- External payer is financing, not a Casa account/card instrument.
  insert into public.financing_allocations(
    household_id,transaction_id,mechanism,component_kind,amount
  ) values (p_household_id,tx_id,'external','principal',p_amount);

  intent:=case when p_needs_repayment then 'reimbursement'::public.external_payment_intent else 'gift'::public.external_payment_intent end;
  occurred_at:=(p_transaction_date::timestamp + time '12:00') at time zone 'UTC';

  event_id:=public.record_external_expense_payment(
    p_household_id,tx_id,p_payer_party_id,intent,p_amount,occurred_at,
    trim(p_request_key)||':external',case when p_needs_repayment then p_due_date else null end,p_notes
  );

  perform public.financial_command_store(p_household_id,op,trim(p_request_key),tx_id);
  return tx_id;
end
$$;
revoke all on function public.create_externally_paid_expense(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,boolean,date,text,text) from public,anon;
grant execute on function public.create_externally_paid_expense(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,boolean,date,text,text) to authenticated;

comment on function public.create_externally_paid_expense(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,boolean,date,text,text) is
  'Creates one economic expense financed by an external party. The transaction has canonical economic allocations plus an external financing allocation; no Casa cash/payment instrument is invented.';

create or replace function public.create_externally_paid_expense_with_repayment_plan(
  p_household_id uuid,
  p_description text,
  p_amount numeric,
  p_transaction_date date,
  p_category_id uuid,
  p_buyer_member_id uuid,
  p_splits jsonb,
  p_payer_party_id uuid,
  p_repayment_mode text,
  p_installment_count integer,
  p_first_due_date date,
  p_planned_source_account_id uuid,
  p_notes text default null,
  p_request_key text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  existing uuid;
  tx_id uuid;
  obligation_id uuid;
  repayable_amount numeric(19,2);
  count_value integer;
  total_cents bigint;
  base_cents bigint;
  remainder integer;
  n integer;
  item_cents bigint;
  op constant text := 'create_externally_paid_expense_with_repayment_plan';
begin
  caller:=public.require_active_member(p_household_id);
  if p_request_key is null or length(trim(p_request_key))=0
  then raise exception 'request key is required' using errcode='22023'; end if;
  if p_amount is null or p_amount<=0 or p_transaction_date is null
     or length(trim(coalesce(p_description,'')))=0
  then raise exception 'invalid externally paid expense' using errcode='22023'; end if;
  if p_transaction_date>current_date
  then raise exception 'expense date cannot be in the future' using errcode='22023'; end if;
  if p_repayment_mode not in ('one_time','installments')
  then raise exception 'invalid repayment mode' using errcode='22023'; end if;
  count_value:=case when p_repayment_mode='one_time' then 1 else p_installment_count end;
  if count_value is null or count_value<1 or count_value>120
  then raise exception 'invalid repayment installment count' using errcode='22023'; end if;
  if p_repayment_mode='installments' and count_value<2
  then raise exception 'installment repayment requires at least 2 installments' using errcode='22023'; end if;
  if p_first_due_date is null or p_first_due_date<p_transaction_date
  then raise exception 'invalid first repayment date' using errcode='22023'; end if;
  if not exists(select 1 from public.financial_parties where id=p_payer_party_id and household_id=p_household_id and deactivated_at is null)
  then raise exception 'active household external payer required' using errcode='23514'; end if;
  if not exists(select 1 from public.accounts where id=p_planned_source_account_id and household_id=p_household_id and deactivated_at is null)
  then raise exception 'active household planned source account required' using errcode='23514'; end if;

  existing:=public.financial_command_existing_or_lock(p_household_id,op,trim(p_request_key));
  if existing is not null then return existing; end if;

  tx_id:=public.create_externally_paid_expense(
    p_household_id,p_description,p_amount,p_transaction_date,p_category_id,p_buyer_member_id,
    p_splits,p_payer_party_id,true,p_first_due_date,p_notes,trim(p_request_key)||':expense'
  );

  select o.id,o.original_amount into obligation_id,repayable_amount
  from public.financial_obligations o
  where o.household_id=p_household_id and o.source_transaction_id=tx_id
    and o.kind='payable' and o.origin_kind='reimbursement'
    and o.counterparty_id=p_payer_party_id
  order by o.created_at desc limit 1;
  if obligation_id is null or repayable_amount is null or repayable_amount<=0
  then raise exception 'repayment obligation was not created' using errcode='23514'; end if;

  total_cents:=round(repayable_amount*100)::bigint;
  if count_value>total_cents then
    raise exception 'repayment installment count exceeds reimbursable cents' using errcode='22023';
  end if;

  base_cents:=floor(total_cents::numeric/count_value)::bigint;
  remainder:=(total_cents-base_cents*count_value)::integer;
  for n in 1..count_value loop
    item_cents:=base_cents+case when n<=remainder then 1 else 0 end;
    insert into public.obligation_repayment_schedule_items(
      household_id,obligation_id,created_by_member_id,number,amount,due_date
    ) values (
      p_household_id,obligation_id,caller.id,n,item_cents::numeric/100,
      (p_first_due_date+make_interval(months => n-1))::date
    );
  end loop;

  perform public.set_commitment_funding_plan(
    p_household_id,p_planned_source_account_id,repayable_amount,
    trim(p_request_key)||':funding',null,null,obligation_id,null,null,p_notes
  );

  perform public.financial_command_store(p_household_id,op,trim(p_request_key),tx_id);
  return tx_id;
end
$$;
revoke all on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) from public,anon;
grant execute on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) to authenticated;

comment on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) is
  'Creates external financing plus a Casa-only reimbursement payable. Schedule items and the funding plan close exactly the reimbursable amount and never persist zero-value installments.';
