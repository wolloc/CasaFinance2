-- Fix the remaining PL/pgSQL ambiguity in expense commitment correction.
-- "amount" is also a local variable, so aggregate the allocation column
-- through an explicit table alias.

create or replace function public.correct_expense_roles(
  p_household_id uuid,
  p_transaction_id uuid,
  p_buyer_member_id uuid,
  p_responsibility jsonb,
  p_reason text,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp as $$
declare
  caller public.household_members;
  tx public.transactions;
  existing public.expense_role_correction_events;
  before_json jsonb;
  normalized_after jsonb:='[]'::jsonb;
  item jsonb;
  member_id uuid;
  pct numeric;
  pct_total numeric:=0;
  current_effective numeric;
  cents bigint;
  base_cents bigint;
  remainder bigint;
  idx integer:=0;
  item_count integer;
  amount numeric;
  event_id uuid;
begin
  caller:=public.require_active_member(p_household_id);

  if length(trim(coalesce(p_reason,'')))=0
     or length(trim(coalesce(p_request_key,'')))=0
     or jsonb_typeof(p_responsibility)<>'array'
     or jsonb_array_length(p_responsibility) not between 1 and 2
  then
    raise exception 'invalid role correction command' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_household_id::text||':expense-role:'||trim(p_request_key),
      0
    )
  );

  select * into existing
  from public.expense_role_correction_events
  where household_id=p_household_id
    and request_key=trim(p_request_key);

  if existing.id is not null then
    return existing.id;
  end if;

  select * into tx
  from public.transactions
  where id=p_transaction_id
    and household_id=p_household_id
    and type='expense'
    and deleted_at is null
  for update;

  if tx.id is null or tx.economic_state in ('cancelled','reversed') then
    raise exception 'active expense required' using errcode='23514';
  end if;

  if not exists(
    select 1
    from public.household_members hm
    where hm.id=p_buyer_member_id
      and hm.household_id=p_household_id
      and hm.deactivated_at is null
  ) then
    raise exception 'buyer must be active in household' using errcode='23514';
  end if;

  if exists(
    select 1
    from public.economic_allocations ea
    where ea.transaction_id=tx.id
      and ea.responsible_party_id is not null
  ) then
    raise exception 'third-party responsibility requires a dedicated correction route'
      using errcode='0A000';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'member_id',ea.responsible_member_id,
        'percentage',ea.percentage,
        'amount',ea.amount
      )
      order by ea.allocation_order
    ),
    '[]'::jsonb
  )
  into before_json
  from public.economic_allocations ea
  where ea.transaction_id=tx.id;

  item_count:=jsonb_array_length(p_responsibility);

  for item in select * from jsonb_array_elements(p_responsibility) loop
    idx:=idx+1;
    member_id:=(item->>'member_id')::uuid;
    pct:=(item->>'percentage')::numeric;

    if pct<=0
       or pct>100
       or not exists(
         select 1
         from public.household_members hm
         where hm.id=member_id
           and hm.household_id=p_household_id
           and hm.deactivated_at is null
       )
    then
      raise exception 'invalid responsible member or percentage'
        using errcode='23514';
    end if;

    if exists(
      select 1
      from jsonb_array_elements(p_responsibility) x
      where (x->>'member_id')::uuid=member_id
      group by (x->>'member_id')
      having count(*)>1
    ) then
      raise exception 'responsible members must be distinct' using errcode='23514';
    end if;

    pct_total:=pct_total+pct;
  end loop;

  if pct_total<>100 then
    raise exception 'responsibility percentages must total 100' using errcode='23514';
  end if;

  select coalesce(sum(ea.amount),0)
  into current_effective
  from public.economic_allocations ea
  where ea.transaction_id=tx.id;

  if current_effective<=0 then
    current_effective:=public.financial_effective_total_amount(
      tx.economic_state,
      tx.estimated_amount,
      tx.confirmed_amount,
      tx.realized_amount,
      tx.amount
    );
  end if;

  cents:=round(current_effective*100);

  delete from public.transaction_splits where transaction_id=tx.id;
  delete from public.economic_allocations where transaction_id=tx.id;

  idx:=0;
  remainder:=cents;

  for item in select * from jsonb_array_elements(p_responsibility) loop
    idx:=idx+1;
    member_id:=(item->>'member_id')::uuid;
    pct:=(item->>'percentage')::numeric;

    base_cents:=case
      when idx=item_count then remainder
      else floor(cents*pct/100)
    end;

    remainder:=remainder-base_cents;
    amount:=base_cents::numeric/100;

    insert into public.economic_allocations(
      household_id,transaction_id,responsible_member_id,allocation_order,percentage,amount
    )
    values(p_household_id,tx.id,member_id,idx,pct,amount);

    insert into public.transaction_splits(
      household_id,transaction_id,responsible_member_id,percentage,amount
    )
    values(p_household_id,tx.id,member_id,pct,amount);

    normalized_after:=normalized_after||jsonb_build_array(
      jsonb_build_object('member_id',member_id,'percentage',pct,'amount',amount)
    );
  end loop;

  -- Buyer, payment method, funding and cash history are intentionally untouched.
  update public.transactions
  set updated_at=now()
  where id=tx.id;

  insert into public.expense_role_correction_events(
    household_id,transaction_id,before_buyer_member_id,after_buyer_member_id,
    before_responsibility,after_responsibility,reason,request_key,created_by_member_id
  )
  values(
    p_household_id,tx.id,tx.buyer_member_id,tx.buyer_member_id,
    before_json,normalized_after,trim(p_reason),trim(p_request_key),caller.id
  )
  returning id into event_id;

  perform public.reconcile_member_settlements(tx.id);

  return event_id;
end $$;
