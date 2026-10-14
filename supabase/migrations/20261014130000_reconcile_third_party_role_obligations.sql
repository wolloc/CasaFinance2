-- Reconcile third-party receivables after expense-role corrections.
-- The correction path historically rewrote economic_allocations without recreating
-- the canonical financial_obligation for an external responsible party.

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
  party_id uuid;
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
  participant_key text;
begin
  caller:=public.require_active_member(p_household_id);
  if length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0
     or jsonb_typeof(p_responsibility)<>'array' or jsonb_array_length(p_responsibility) not between 1 and 3
  then raise exception 'invalid role correction command' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':expense-role:'||trim(p_request_key),0));

  select * into existing from public.expense_role_correction_events where household_id=p_household_id and request_key=trim(p_request_key);
  if existing.id is not null then return existing.id; end if;

  select * into tx from public.transactions where id=p_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null for update;
  if tx.id is null or tx.economic_state in ('cancelled','reversed') then raise exception 'active expense required' using errcode='23514'; end if;

  if not exists(select 1 from public.household_members hm where hm.id=p_buyer_member_id and hm.household_id=p_household_id and hm.deactivated_at is null) then
    raise exception 'buyer must be active in household' using errcode='23514';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('member_id',ea.responsible_member_id,'party_id',ea.responsible_party_id,'percentage',ea.percentage,'amount',ea.amount) order by ea.allocation_order),'[]'::jsonb)
  into before_json from public.economic_allocations ea where ea.transaction_id=tx.id;

  item_count:=jsonb_array_length(p_responsibility);

  for item in select * from jsonb_array_elements(p_responsibility) loop
    idx:=idx+1;
    member_id:=nullif(item->>'member_id','')::uuid;
    party_id:=nullif(item->>'party_id','')::uuid;
    pct:=(item->>'percentage')::numeric;

    if ((member_id is null) = (party_id is null)) or pct<=0 or pct>100 then
      raise exception 'each responsibility item must contain exactly one active member or third party' using errcode='23514';
    end if;

    if member_id is not null and not exists(select 1 from public.household_members hm where hm.id=member_id and hm.household_id=p_household_id and hm.deactivated_at is null) then
      raise exception 'invalid responsible member' using errcode='23514';
    end if;

    if party_id is not null and not exists(select 1 from public.financial_parties fp where fp.id=party_id and fp.household_id=p_household_id and fp.deactivated_at is null) then
      raise exception 'invalid responsible third party' using errcode='23514';
    end if;

    participant_key:=coalesce('member:'||member_id::text,'party:'||party_id::text);
    if (select count(*) from jsonb_array_elements(p_responsibility) x where coalesce(
      case when nullif(x->>'member_id','') is not null then 'member:'||(x->>'member_id') end,
      case when nullif(x->>'party_id','') is not null then 'party:'||(x->>'party_id') end
    )=participant_key)>1 then
      raise exception 'responsibility participants must be distinct' using errcode='23514';
    end if;

    pct_total:=pct_total+pct;
  end loop;

  if pct_total<>100 then raise exception 'responsibility percentages must total 100' using errcode='23514'; end if;

  select coalesce(sum(ea.amount),0) into current_effective from public.economic_allocations ea where ea.transaction_id=tx.id;
  if current_effective<=0 then current_effective:=public.financial_effective_total_amount(tx.economic_state,tx.estimated_amount,tx.confirmed_amount,tx.realized_amount,tx.amount); end if;

  cents:=round(current_effective*100);
  delete from public.transaction_splits where transaction_id=tx.id;
  delete from public.economic_allocations where transaction_id=tx.id;

  idx:=0; remainder:=cents;
  for item in select * from jsonb_array_elements(p_responsibility) loop
    idx:=idx+1;
    member_id:=nullif(item->>'member_id','')::uuid;
    party_id:=nullif(item->>'party_id','')::uuid;
    pct:=(item->>'percentage')::numeric;
    base_cents:=case when idx=item_count then remainder else floor(cents*pct/100) end;
    remainder:=remainder-base_cents;
    amount:=base_cents::numeric/100;

    insert into public.economic_allocations(household_id,transaction_id,responsible_member_id,responsible_party_id,allocation_order,percentage,amount)
    values(p_household_id,tx.id,member_id,party_id,idx,pct,amount);

    if member_id is not null then
      insert into public.transaction_splits(household_id,transaction_id,responsible_member_id,percentage,amount)
      values(p_household_id,tx.id,member_id,pct,amount);
    else
      if not exists (
        select 1 from public.financial_obligations fo
        where fo.household_id=p_household_id and fo.source_transaction_id=tx.id
          and fo.counterparty_id=party_id and fo.kind='receivable'
          and fo.state not in ('cancelled','written_off')
      ) then
        perform public.create_financial_obligation(
          p_household_id,'receivable','shared_expense',party_id,amount,
          tx.transaction_date,tx.due_date,'Valor de terceiro: '||tx.description,
          tx.id,tx.invoice_id,null,null
        );
      end if;
    end if;

    normalized_after:=normalized_after||jsonb_build_array(jsonb_build_object('member_id',member_id,'party_id',party_id,'percentage',pct,'amount',amount));
  end loop;

  update public.transactions set updated_at=now() where id=tx.id;
  insert into public.expense_role_correction_events(household_id,transaction_id,before_buyer_member_id,after_buyer_member_id,before_responsibility,after_responsibility,reason,request_key,created_by_member_id)
  values(p_household_id,tx.id,tx.buyer_member_id,tx.buyer_member_id,before_json,normalized_after,trim(p_reason),trim(p_request_key),caller.id)
  returning id into event_id;

  perform public.reconcile_member_settlements(tx.id);
  return event_id;
end $$;



revoke all on function public.correct_expense_roles(uuid,uuid,uuid,jsonb,text,text) from public,anon;
grant execute on function public.correct_expense_roles(uuid,uuid,uuid,jsonb,text,text) to authenticated;

-- Backfill only missing open/partially-settled receivables represented by the
-- current economic allocations. The migration runs without an authenticated
-- session, so this backfill inserts the canonical row directly.

insert into public.financial_obligations(
  household_id,created_by_member_id,kind,origin_kind,counterparty_id,
  source_transaction_id,invoice_id,original_amount,obligation_date,due_date,
  description,notes
)
select
  ea.household_id,
  coalesce(t.buyer_member_id,(
    select hm.id from public.household_members hm
    where hm.household_id=ea.household_id and hm.deactivated_at is null
    order by hm.created_at limit 1
  )),
  'receivable','shared_expense',ea.responsible_party_id,
  ea.transaction_id,t.invoice_id,ea.amount,t.transaction_date,t.due_date,
  'Valor de terceiro: '||t.description,null
from public.economic_allocations ea
join public.transactions t on t.id=ea.transaction_id
where ea.responsible_party_id is not null
  and t.type='expense'
  and t.deleted_at is null
  and not exists (
    select 1 from public.financial_obligations fo
    where fo.household_id=ea.household_id
      and fo.source_transaction_id=ea.transaction_id
      and fo.counterparty_id=ea.responsible_party_id
      and fo.kind='receivable'
      and fo.state not in ('cancelled','written_off')
  );