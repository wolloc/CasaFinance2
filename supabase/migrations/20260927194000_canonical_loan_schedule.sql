-- Canonical loan repayment schedule.
-- Keeps one principal obligation; installments are repayment agenda only.
-- Future interest/fees are projections until separately accrued as economic facts.

create table if not exists public.loan_schedule_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  principal_obligation_id uuid not null references public.financial_obligations(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  principal_amount numeric(19,2) not null check (principal_amount >= 0),
  projected_interest_amount numeric(19,2) not null default 0 check (projected_interest_amount >= 0),
  projected_fee_amount numeric(19,2) not null default 0 check (projected_fee_amount >= 0),
  cost_responsible_member_id uuid references public.household_members(id) on delete restrict,
  paid_principal_amount numeric(19,2) not null default 0 check (paid_principal_amount >= 0),
  paid_interest_amount numeric(19,2) not null default 0 check (paid_interest_amount >= 0),
  paid_fee_amount numeric(19,2) not null default 0 check (paid_fee_amount >= 0),
  state text not null default 'projected' check (state in ('projected','partially_paid','paid','cancelled')),
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(principal_obligation_id, installment_number),
  check (paid_principal_amount <= principal_amount),
  check (paid_interest_amount <= projected_interest_amount),
  check (paid_fee_amount <= projected_fee_amount)
);

create index if not exists loan_schedule_items_household_due
  on public.loan_schedule_items(household_id,due_date,principal_obligation_id);

alter table public.loan_schedule_items enable row level security;
drop policy if exists loan_schedule_items_member_select on public.loan_schedule_items;
create policy loan_schedule_items_member_select
  on public.loan_schedule_items for select to authenticated
  using (public.is_active_household_member(household_id));

revoke all on table public.loan_schedule_items from public,anon;
grant select on table public.loan_schedule_items to authenticated;

create or replace view public.financial_loan_schedule
with (security_invoker=true) as
select s.household_id,
       s.id schedule_item_id,
       s.principal_obligation_id,
       o.kind obligation_kind,
       o.counterparty_id,
       party.name counterparty_name,
       s.installment_number,
       s.due_date,
       s.principal_amount,
       s.projected_interest_amount,
       s.projected_fee_amount,
       s.cost_responsible_member_id,
       s.paid_principal_amount,
       s.paid_interest_amount,
       s.paid_fee_amount,
       greatest(s.principal_amount-s.paid_principal_amount,0)::numeric(19,2) remaining_principal_amount,
       greatest(s.projected_interest_amount-s.paid_interest_amount,0)::numeric(19,2) remaining_interest_amount,
       greatest(s.projected_fee_amount-s.paid_fee_amount,0)::numeric(19,2) remaining_fee_amount,
       (s.principal_amount+s.projected_interest_amount+s.projected_fee_amount)::numeric(19,2) scheduled_total_amount,
       greatest(
         s.principal_amount+s.projected_interest_amount+s.projected_fee_amount
         -s.paid_principal_amount-s.paid_interest_amount-s.paid_fee_amount,0
       )::numeric(19,2) remaining_total_amount,
       s.state
from public.loan_schedule_items s
join public.financial_obligations o
  on o.id=s.principal_obligation_id and o.household_id=s.household_id
join public.financial_parties party
  on party.id=o.counterparty_id and party.household_id=o.household_id
where o.origin_kind='loan';

revoke all on public.financial_loan_schedule from public,anon;
grant select on public.financial_loan_schedule to authenticated;

create or replace function public.create_loan_principal_with_schedule_idempotent(
  p_household_id uuid,
  p_direction text,
  p_counterparty_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_occurred_at date,
  p_first_due_date date,
  p_installment_count integer,
  p_total_interest numeric,
  p_total_fee numeric,
  p_cost_responsible_member_id uuid,
  p_description text,
  p_notes text,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  existing uuid;
  result uuid;
  op constant text:='create_loan_principal_with_schedule';
  i integer;
  last_due_date date;
  principal_cents bigint;
  interest_cents bigint;
  fee_cents bigint;
  principal_base bigint;
  interest_base bigint;
  fee_base bigint;
  principal_remainder bigint;
  interest_remainder bigint;
  fee_remainder bigint;
  current_principal numeric(19,2);
  current_interest numeric(19,2);
  current_fee numeric(19,2);
begin
  caller:=public.require_active_member(p_household_id);
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then return existing; end if;

  if p_direction not in ('granted','taken') then
    raise exception 'loan direction must be granted or taken' using errcode='22023';
  end if;
  if p_amount<=0 or p_installment_count<1 or p_installment_count>120 then
    raise exception 'positive amount and installment count from 1 to 120 are required' using errcode='22023';
  end if;
  if p_first_due_date is null or p_first_due_date<p_occurred_at then
    raise exception 'first due date must be on or after loan date' using errcode='22023';
  end if;
  if coalesce(p_total_interest,0)<0 or coalesce(p_total_fee,0)<0 then
    raise exception 'projected interest and fee cannot be negative' using errcode='22023';
  end if;
  if p_direction='granted' and (coalesce(p_total_interest,0)>0 or coalesce(p_total_fee,0)>0) then
    raise exception 'income-side contractual charges are not supported in this release' using errcode='22023';
  end if;
  if p_direction='taken' and (coalesce(p_total_interest,0)>0 or coalesce(p_total_fee,0)>0) then
    if p_cost_responsible_member_id is null or not exists(
      select 1 from public.household_members
      where id=p_cost_responsible_member_id and household_id=p_household_id and deactivated_at is null
    ) then raise exception 'active member responsible for loan costs required' using errcode='23514'; end if;
  end if;

  last_due_date:=(p_first_due_date + make_interval(months=>p_installment_count-1))::date;

  result:=public.create_loan_principal(
    p_household_id,p_direction,p_counterparty_id,p_account_id,p_amount,p_occurred_at,
    last_due_date,p_description,p_notes
  );

  principal_cents:=round(p_amount*100)::bigint;
  interest_cents:=round(coalesce(p_total_interest,0)*100)::bigint;
  fee_cents:=round(coalesce(p_total_fee,0)*100)::bigint;

  principal_base:=principal_cents/p_installment_count;
  interest_base:=interest_cents/p_installment_count;
  fee_base:=fee_cents/p_installment_count;
  principal_remainder:=principal_cents%p_installment_count;
  interest_remainder:=interest_cents%p_installment_count;
  fee_remainder:=fee_cents%p_installment_count;

  for i in 1..p_installment_count loop
    current_principal:=(principal_base+case when i<=principal_remainder then 1 else 0 end)::numeric/100;
    current_interest:=(interest_base+case when i<=interest_remainder then 1 else 0 end)::numeric/100;
    current_fee:=(fee_base+case when i<=fee_remainder then 1 else 0 end)::numeric/100;

    insert into public.loan_schedule_items(
      household_id,principal_obligation_id,installment_number,due_date,
      principal_amount,projected_interest_amount,projected_fee_amount,cost_responsible_member_id,created_by_member_id
    ) values(
      p_household_id,result,i,(p_first_due_date+make_interval(months=>i-1))::date,
      current_principal,current_interest,current_fee,p_cost_responsible_member_id,caller.id
    );
  end loop;

  perform public.financial_command_store(p_household_id,op,p_request_key,result);
  return result;
end $$;

revoke all on function public.create_loan_principal_with_schedule_idempotent(
  uuid,text,uuid,uuid,numeric,date,date,integer,numeric,numeric,uuid,text,text,text
) from public,anon;
grant execute on function public.create_loan_principal_with_schedule_idempotent(
  uuid,text,uuid,uuid,numeric,date,date,integer,numeric,numeric,uuid,text,text,text
) to authenticated;

create or replace function public.allocate_loan_payment_to_schedule()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  row_item public.loan_schedule_items;
  remaining numeric;
  allocation numeric;
  charge_row record;
  target_column text;
begin
  if not exists(
    select 1 from public.loan_schedule_items
    where household_id=new.household_id and principal_obligation_id=new.principal_obligation_id
  ) then
    return new;
  end if;

  remaining:=new.principal_amount;
  if remaining>0 then
    for row_item in
      select * from public.loan_schedule_items
      where household_id=new.household_id
        and principal_obligation_id=new.principal_obligation_id
        and state<>'cancelled'
        and paid_principal_amount<principal_amount
      order by installment_number
      for update
    loop
      allocation:=least(remaining,row_item.principal_amount-row_item.paid_principal_amount);
      if allocation>0 then
        update public.loan_schedule_items
        set paid_principal_amount=paid_principal_amount+allocation,updated_at=now()
        where id=row_item.id;
        remaining:=remaining-allocation;
      end if;
      exit when remaining<=0;
    end loop;
  end if;

  for charge_row in
    select lce.kind::text kind,sum(oe.amount)::numeric amount
    from public.obligation_events oe
    join public.loan_charge_events lce
      on lce.household_id=oe.household_id
     and lce.charge_obligation_id=oe.obligation_id
     and lce.principal_obligation_id=new.principal_obligation_id
    where oe.household_id=new.household_id
      and oe.movement_id=new.movement_id
      and oe.kind='payment'
      and lce.kind in ('interest','fee')
    group by lce.kind
  loop
    remaining:=charge_row.amount;
    target_column:=case when charge_row.kind='interest' then 'interest' else 'fee' end;

    for row_item in
      select * from public.loan_schedule_items
      where household_id=new.household_id
        and principal_obligation_id=new.principal_obligation_id
        and state<>'cancelled'
        and (
          (target_column='interest' and paid_interest_amount<projected_interest_amount)
          or
          (target_column='fee' and paid_fee_amount<projected_fee_amount)
        )
      order by installment_number
      for update
    loop
      allocation:=case
        when target_column='interest' then least(remaining,row_item.projected_interest_amount-row_item.paid_interest_amount)
        else least(remaining,row_item.projected_fee_amount-row_item.paid_fee_amount)
      end;
      if allocation>0 then
        if target_column='interest' then
          update public.loan_schedule_items
          set paid_interest_amount=paid_interest_amount+allocation,updated_at=now()
          where id=row_item.id;
        else
          update public.loan_schedule_items
          set paid_fee_amount=paid_fee_amount+allocation,updated_at=now()
          where id=row_item.id;
        end if;
        remaining:=remaining-allocation;
      end if;
      exit when remaining<=0;
    end loop;
  end loop;

  update public.loan_schedule_items
  set state=case
    when paid_principal_amount>=principal_amount
     and paid_interest_amount>=projected_interest_amount
     and paid_fee_amount>=projected_fee_amount then 'paid'
    when paid_principal_amount+paid_interest_amount+paid_fee_amount>0 then 'partially_paid'
    else 'projected'
  end,
  updated_at=now()
  where household_id=new.household_id
    and principal_obligation_id=new.principal_obligation_id
    and state<>'cancelled';

  return new;
end $$;

revoke all on function public.allocate_loan_payment_to_schedule() from public,anon,authenticated;

drop trigger if exists allocate_loan_payment_to_schedule_after_insert on public.loan_payment_events;
create trigger allocate_loan_payment_to_schedule_after_insert
after insert on public.loan_payment_events
for each row execute function public.allocate_loan_payment_to_schedule();

comment on table public.loan_schedule_items is
  'Canonical repayment agenda linked to one financial_obligations loan principal. Schedule rows are projections, not extra debts or expenses.';
comment on view public.financial_loan_schedule is
  'Canonical loan schedule read model with projected principal/interest/fees and realized payment progress.';


create or replace function public.record_scheduled_loan_payment(
  p_household_id uuid,
  p_schedule_item_id uuid,
  p_source_account_id uuid,
  p_funder_member_id uuid,
  p_principal_amount numeric,
  p_interest_amount numeric,
  p_fee_amount numeric,
  p_paid_at timestamptz,
  p_notes text,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  item public.loan_schedule_items;
  earliest_number integer;
  interest_event_id uuid;
  fee_event_id uuid;
  interest_obligation_id uuid;
  fee_obligation_id uuid;
  allocations jsonb:='[]'::jsonb;
  result uuid;
  existing uuid;
  op constant text:='record_scheduled_loan_payment';
  charge_date date;
begin
  caller:=public.require_active_member(p_household_id);
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then return existing; end if;

  select * into item from public.loan_schedule_items
  where id=p_schedule_item_id and household_id=p_household_id and state in ('projected','partially_paid')
  for update;
  if item.id is null then raise exception 'active loan schedule item required' using errcode='23514'; end if;

  select min(installment_number) into earliest_number
  from public.loan_schedule_items
  where household_id=p_household_id
    and principal_obligation_id=item.principal_obligation_id
    and state in ('projected','partially_paid');
  if item.installment_number<>earliest_number then
    raise exception 'payments must follow the earliest open installment' using errcode='23514';
  end if;

  if coalesce(p_principal_amount,0)<0 or coalesce(p_interest_amount,0)<0 or coalesce(p_fee_amount,0)<0
     or coalesce(p_principal_amount,0)+coalesce(p_interest_amount,0)+coalesce(p_fee_amount,0)<=0 then
    raise exception 'scheduled payment must include a positive component' using errcode='22023';
  end if;
  if coalesce(p_principal_amount,0)>item.principal_amount-item.paid_principal_amount
     or coalesce(p_interest_amount,0)>item.projected_interest_amount-item.paid_interest_amount
     or coalesce(p_fee_amount,0)>item.projected_fee_amount-item.paid_fee_amount then
    raise exception 'scheduled payment exceeds installment remaining amount' using errcode='23514';
  end if;

  charge_date:=least(item.due_date,p_paid_at::date);

  if coalesce(p_interest_amount,0)>0 then
    if item.cost_responsible_member_id is null then
      raise exception 'loan cost responsibility is required for interest' using errcode='23514';
    end if;
    interest_event_id:=public.record_loan_charge(
      p_household_id,item.principal_obligation_id,'interest',item.projected_interest_amount,
      charge_date,item.due_date,item.cost_responsible_member_id,'Juros da parcela '||item.installment_number,
      'schedule:'||item.id::text||':interest'
    );
    select charge_obligation_id into interest_obligation_id
    from public.loan_charge_events where id=interest_event_id;
    allocations:=allocations||jsonb_build_array(jsonb_build_object('obligation_id',interest_obligation_id,'amount',p_interest_amount));
  end if;

  if coalesce(p_fee_amount,0)>0 then
    if item.cost_responsible_member_id is null then
      raise exception 'loan cost responsibility is required for fee' using errcode='23514';
    end if;
    fee_event_id:=public.record_loan_charge(
      p_household_id,item.principal_obligation_id,'fee',item.projected_fee_amount,
      charge_date,item.due_date,item.cost_responsible_member_id,'Tarifa da parcela '||item.installment_number,
      'schedule:'||item.id::text||':fee'
    );
    select charge_obligation_id into fee_obligation_id
    from public.loan_charge_events where id=fee_event_id;
    allocations:=allocations||jsonb_build_array(jsonb_build_object('obligation_id',fee_obligation_id,'amount',p_fee_amount));
  end if;

  result:=public.record_loan_payment(
    p_household_id,item.principal_obligation_id,p_source_account_id,p_funder_member_id,
    coalesce(p_principal_amount,0),allocations,p_paid_at,p_notes,p_request_key||':payment'
  );

  perform public.financial_command_store(p_household_id,op,p_request_key,result);
  return result;
end $$;

revoke all on function public.record_scheduled_loan_payment(
  uuid,uuid,uuid,uuid,numeric,numeric,numeric,timestamptz,text,text
) from public,anon;
grant execute on function public.record_scheduled_loan_payment(
  uuid,uuid,uuid,uuid,numeric,numeric,numeric,timestamptz,text,text
) to authenticated;

comment on function public.record_scheduled_loan_payment(
  uuid,uuid,uuid,uuid,numeric,numeric,numeric,timestamptz,text,text
) is 'Pays the earliest open canonical loan installment with one cash outflow. Scheduled interest/fees become economic charge obligations only when actually paid; principal remains economically neutral.';
