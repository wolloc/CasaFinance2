-- Nova Despesa: planejamento de devolução a terceiro.
-- Uma obrigação continua sendo uma única dívida. Este cronograma descreve apenas
-- os futuros desembolsos esperados para liquidá-la; nunca cria novas despesas.

create table public.obligation_repayment_schedule_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  obligation_id uuid not null references public.financial_obligations(id) on delete cascade,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  number integer not null check(number > 0),
  amount numeric(19,2) not null check(amount > 0),
  due_date date not null,
  created_at timestamptz not null default now(),
  unique(obligation_id, number)
);

create index obligation_repayment_schedule_household_due
  on public.obligation_repayment_schedule_items(household_id,due_date);

alter table public.obligation_repayment_schedule_items enable row level security;
create policy obligation_repayment_schedule_member_select
  on public.obligation_repayment_schedule_items for select to authenticated
  using (public.is_active_household_member(household_id));
revoke all on public.obligation_repayment_schedule_items from public,anon;
grant select on public.obligation_repayment_schedule_items to authenticated;

create or replace function public.assert_obligation_repayment_schedule_links()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(
    select 1 from public.financial_obligations o
    where o.id=new.obligation_id and o.household_id=new.household_id and o.kind='payable'
  ) then raise exception 'repayment schedule requires household payable' using errcode='23514'; end if;
  if not exists(
    select 1 from public.household_members m
    where m.id=new.created_by_member_id and m.household_id=new.household_id and m.deactivated_at is null
  ) then raise exception 'schedule creator must be active household member' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function public.assert_obligation_repayment_schedule_links() from public,anon,authenticated;
create trigger obligation_repayment_schedule_links
before insert or update on public.obligation_repayment_schedule_items
for each row execute function public.assert_obligation_repayment_schedule_links();

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
  count_value integer;
  total_cents bigint;
  base_cents bigint;
  remainder integer;
  n integer;
  item_cents bigint;
  item_due date;
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
  if p_repayment_mode not in ('single','installments')
  then raise exception 'invalid repayment mode' using errcode='22023'; end if;
  count_value:=case when p_repayment_mode='single' then 1 else p_installment_count end;
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

  select o.id into obligation_id
  from public.financial_obligations o
  where o.household_id=p_household_id and o.source_transaction_id=tx_id and o.kind='payable'
  order by o.created_at desc limit 1;
  if obligation_id is null then raise exception 'repayment obligation was not created' using errcode='23514'; end if;

  total_cents:=round(p_amount*100)::bigint;
  base_cents:=total_cents/count_value;
  remainder:=(total_cents%count_value)::integer;
  for n in 1..count_value loop
    item_cents:=base_cents+case when n<=remainder then 1 else 0 end;
    item_due:=(p_first_due_date+(n-1)*interval '1 month')::date;
    insert into public.obligation_repayment_schedule_items(household_id,obligation_id,created_by_member_id,number,amount,due_date)
    values(p_household_id,obligation_id,caller.id,n,item_cents::numeric/100,item_due);
  end loop;

  insert into public.commitment_funding_plans(
    household_id,source_kind,source_id,source_account_id,planned_amount,created_by_member_id
  ) values(
    p_household_id,'external_payable',obligation_id,p_planned_source_account_id,p_amount,caller.id
  );

  perform public.financial_command_store(p_household_id,op,trim(p_request_key),tx_id);
  return tx_id;
end $$;

revoke all on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) from public,anon;
grant execute on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) to authenticated;

comment on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) is
  'Creates one externally funded economic expense, one reimbursement payable, and a future cash repayment schedule. Schedule items are liquidation projections, never additional expenses.';

create or replace view public.obligation_repayment_schedule_positions
with (security_invoker=true) as
select
  s.id,s.household_id,s.obligation_id,s.number,s.amount,s.due_date,
  greatest(s.amount-coalesce(sum(case when e.event_type='payment' then e.amount else 0 end) over(
    partition by s.obligation_id order by s.number rows between unbounded preceding and current row
  ) + coalesce(sum(case when e.event_type='payment' then e.amount else 0 end) over(
    partition by s.obligation_id order by s.number rows between unbounded preceding and 1 preceding
  ),0),0),0)::numeric(19,2) as remaining_amount
from public.obligation_repayment_schedule_items s
left join public.obligation_events e on e.obligation_id=s.obligation_id;

grant select on public.obligation_repayment_schedule_positions to authenticated;

create or replace view public.financial_commitment_positions
with (security_invoker=true) as
select
  o.household_id,
  'external_payable'::text as source_kind,
  o.id as source_id,
  coalesce(p.party_id::text,'Terceiro') as label,
  s.due_date,
  s.amount as projected_amount,
  s.remaining_amount as open_amount,
  case when s.remaining_amount<=0 then 'realized' else 'projected' end::text as state,
  null::uuid as card_id,
  null::integer as installment_number,
  null::integer as installment_count
from public.financial_obligations o
join public.obligation_repayment_schedule_positions s on s.obligation_id=o.id
left join public.financial_parties p on p.id=o.counterparty_party_id
where o.kind='payable' and o.status='open'
union all
select
  o.household_id,
  'external_payable'::text,
  o.id,
  coalesce(p.party_id::text,'Terceiro'),
  o.due_date,
  o.amount,
  greatest(o.amount-coalesce(sum(e.amount) filter(where e.event_type='payment'),0),0)::numeric(19,2),
  case when greatest(o.amount-coalesce(sum(e.amount) filter(where e.event_type='payment'),0),0)<=0 then 'realized' else 'projected' end::text,
  null::uuid,null::integer,null::integer
from public.financial_obligations o
left join public.obligation_events e on e.obligation_id=o.id
left join public.financial_parties p on p.id=o.counterparty_party_id
where o.kind='payable' and o.status='open'
  and not exists(select 1 from public.obligation_repayment_schedule_items s where s.obligation_id=o.id)
group by o.household_id,o.id,p.party_id,o.due_date,o.amount;

grant select on public.financial_commitment_positions to authenticated;
