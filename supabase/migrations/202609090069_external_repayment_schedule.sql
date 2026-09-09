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
  using (public.is_household_member(household_id));
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
  if p_repayment_mode not in ('one_time','installments')
  then raise exception 'repayment mode must be one_time or installments' using errcode='22023'; end if;
  count_value:=case when p_repayment_mode='one_time' then 1 else p_installment_count end;
  if count_value is null or count_value<1 or count_value>120
  then raise exception 'invalid repayment installment count' using errcode='22023'; end if;
  if p_first_due_date is null or p_first_due_date<p_transaction_date
  then raise exception 'invalid first repayment due date' using errcode='22023'; end if;
  if not exists(
    select 1 from public.accounts a
    where a.id=p_planned_source_account_id and a.household_id=p_household_id and a.deactivated_at is null
  ) then raise exception 'active household planned source account required' using errcode='23514'; end if;

  existing:=public.financial_command_existing_or_lock(p_household_id,op,trim(p_request_key));
  if existing is not null then return existing; end if;

  tx_id:=public.create_externally_paid_expense(
    p_household_id,p_description,p_amount,p_transaction_date,p_category_id,p_buyer_member_id,
    p_splits,p_payer_party_id,true,p_first_due_date,p_notes,trim(p_request_key)||':expense'
  );

  select e.payable_obligation_id into obligation_id
  from public.external_payment_events e
  where e.household_id=p_household_id and e.source_transaction_id=tx_id
    and e.payer_party_id=p_payer_party_id and e.payable_obligation_id is not null
  order by e.created_at desc fetch first 1 row only;
  if obligation_id is null
  then raise exception 'repayment obligation was not created' using errcode='P0002'; end if;

  total_cents:=round(p_amount*100)::bigint;
  base_cents:=floor(total_cents::numeric/count_value)::bigint;
  remainder:=(total_cents-base_cents*count_value)::integer;

  for n in 1..count_value loop
    item_cents:=base_cents+case when n<=remainder then 1 else 0 end;
    item_due:=(p_first_due_date + make_interval(months => n-1))::date;
    insert into public.obligation_repayment_schedule_items(
      household_id,obligation_id,created_by_member_id,number,amount,due_date
    ) values (
      p_household_id,obligation_id,caller.id,n,item_cents::numeric/100,item_due
    );
  end loop;

  perform public.set_commitment_funding_plan(
    p_household_id,p_planned_source_account_id,p_amount,trim(p_request_key)||':funding',
    null,null,obligation_id,null,null,'Recurso planejado para devolução a terceiro'
  );

  perform public.financial_command_store(p_household_id,op,trim(p_request_key),tx_id);
  return tx_id;
end $$;

revoke all on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) from public,anon;
grant execute on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) to authenticated;

comment on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) is
  'Creates one externally funded economic expense, one reimbursement payable, an exact-cent future repayment schedule, and one planned funding route atomically. Schedule items are cash projections, never additional expenses.';

-- Replace only the canonical read model; downstream consumers keep the same columns.
create or replace view public.financial_commitment_positions
with (security_invoker=true) as
with
invoice_payment_evidence as (
  select cip.household_id,cip.invoice_id,cip.payment_transaction_id,cip.source_account_id
  from public.card_invoice_payments cip
  join public.transactions payment on payment.id=cip.payment_transaction_id and payment.household_id=cip.household_id
   and payment.type='invoice_payment' and payment.status='paid' and payment.settled_at is not null
   and payment.deleted_at is null and payment.amount=cip.amount
  join public.funding_events allocated on allocated.household_id=cip.household_id and allocated.invoice_id=cip.invoice_id
   and allocated.funding_transaction_id=cip.payment_transaction_id and allocated.source_account_id=cip.source_account_id
  group by cip.household_id,cip.invoice_id,cip.payment_transaction_id,cip.source_account_id,cip.amount
  having sum(allocated.amount)=cip.amount
),
installment_funding as (
  select f.household_id,f.installment_id,sum(f.amount)::numeric(19,2) realized_amount
  from public.funding_events f
  join public.installments i on i.id=f.installment_id and i.household_id=f.household_id and i.invoice_id=f.invoice_id
  join public.installment_plans ip on ip.id=i.installment_plan_id and ip.household_id=f.household_id and ip.purchase_transaction_id=f.financed_transaction_id
  join invoice_payment_evidence paid on paid.household_id=f.household_id and paid.invoice_id=f.invoice_id
   and paid.payment_transaction_id=f.funding_transaction_id and paid.source_account_id=f.source_account_id
  where f.installment_id is not null and f.invoice_id is not null group by f.household_id,f.installment_id
),
direct_funding as (
  select household_id,financed_transaction_id,sum(amount)::numeric(19,2) realized_amount
  from public.funding_events where installment_id is null and invoice_id is null group by household_id,financed_transaction_id
),
obligation_realization as (
  select household_id,obligation_id,coalesce(sum(amount) filter(where kind='payment'),0)::numeric(19,2) realized_amount
  from public.obligation_events group by household_id,obligation_id
),
schedule_realization as (
  select s.*,
    least(s.amount,greatest(coalesce(r.realized_amount,0)-coalesce(sum(s.amount) over(
      partition by s.obligation_id order by s.number rows between unbounded preceding and 1 preceding
    ),0),0))::numeric(19,2) realized_item_amount
  from public.obligation_repayment_schedule_items s
  left join obligation_realization r on r.household_id=s.household_id and r.obligation_id=s.obligation_id
),
raw_positions as (
  select i.household_id,'installment:'||i.id::text commitment_key,'card_installment'::text source_type,i.id source_id,
    p.purchase_transaction_id source_transaction_id,i.id source_installment_id,i.invoice_id source_invoice_id,null::uuid source_obligation_id,
    null::uuid source_recurring_occurrence_id,'card_installment'::text commitment_type,'outflow'::text direction,t.type::text economic_type,
    coalesce(i.due_date,i.competence_date) financial_date,i.due_date,t.transaction_date economic_date,
    case when i.status='cancelled' then 'cancelled'::public.economic_state when i.status='refunded' then 'reversed'::public.economic_state else t.economic_state end source_state,
    i.amount::numeric(19,2) estimated_amount,i.amount::numeric(19,2) confirmed_amount,least(coalesce(f.realized_amount,0),i.amount)::numeric(19,2) realized_amount,
    t.description,t.category_id,t.created_by_member_id
  from public.installments i join public.installment_plans p on p.id=i.installment_plan_id and p.household_id=i.household_id
  join public.transactions t on t.id=p.purchase_transaction_id and t.household_id=i.household_id
  left join installment_funding f on f.installment_id=i.id and f.household_id=i.household_id where t.deleted_at is null

  union all
  select o.household_id,'recurring_occurrence:'||o.id::text,'recurring_occurrence',o.id,t.id,null::uuid,t.invoice_id,null::uuid,o.id,
    'recurring_expense','outflow',t.type::text,coalesce(o.due_date,o.competence_date,t.due_date,t.competence_date),coalesce(o.due_date,t.due_date),t.transaction_date,
    case when o.status='cancelled' then 'cancelled'::public.economic_state else t.economic_state end,
    coalesce(o.estimated_amount,t.estimated_amount,t.amount)::numeric(19,2),coalesce(o.confirmed_amount,t.confirmed_amount)::numeric(19,2),
    greatest(t.realized_amount,coalesce(f.realized_amount,0))::numeric(19,2),t.description,t.category_id,t.created_by_member_id
  from public.recurring_occurrences o join public.transactions t on t.id=o.transaction_id and t.household_id=o.household_id
  left join direct_funding f on f.financed_transaction_id=t.id and f.household_id=t.household_id
  where t.type='expense' and t.deleted_at is null
    and not exists(select 1 from public.installment_plans p where p.purchase_transaction_id=t.id)
    and not exists(select 1 from public.financial_obligations x where x.kind='payable' and x.source_transaction_id=t.id)

  union all
  select t.household_id,'transaction:'||t.id::text,'direct_expense',t.id,t.id,null::uuid,t.invoice_id,null::uuid,null::uuid,
    'direct_expense','outflow',t.type::text,coalesce(t.due_date,t.competence_date,t.transaction_date),t.due_date,t.transaction_date,t.economic_state,
    coalesce(t.estimated_amount,t.amount)::numeric(19,2),t.confirmed_amount::numeric(19,2),greatest(t.realized_amount,coalesce(f.realized_amount,0))::numeric(19,2),
    t.description,t.category_id,t.created_by_member_id
  from public.transactions t left join direct_funding f on f.financed_transaction_id=t.id and f.household_id=t.household_id
  where t.type='expense' and t.deleted_at is null
    and not exists(select 1 from public.installment_plans p where p.purchase_transaction_id=t.id)
    and not exists(select 1 from public.recurring_occurrences o where o.transaction_id=t.id)
    and not exists(select 1 from public.financial_obligations x where x.kind='payable' and x.source_transaction_id=t.id)

  union all
  -- Payables without a repayment schedule keep the legacy single commitment.
  select o.household_id,'payable:'||o.id::text,'payable',o.id,o.source_transaction_id,null::uuid,o.invoice_id,o.id,null::uuid,
    'payable','outflow','obligation',coalesce(o.due_date,o.obligation_date),o.due_date,o.obligation_date,
    case when o.state='cancelled' then 'cancelled'::public.economic_state when o.state='written_off' then 'reversed'::public.economic_state
         when o.state='settled' then 'realized'::public.economic_state else 'confirmed'::public.economic_state end,
    null::numeric(19,2),o.original_amount,least(coalesce(r.realized_amount,0),o.original_amount)::numeric(19,2),o.description,null::uuid,o.created_by_member_id
  from public.financial_obligations o left join obligation_realization r on r.obligation_id=o.id and r.household_id=o.household_id
  where o.kind='payable' and not exists(select 1 from public.obligation_repayment_schedule_items s where s.obligation_id=o.id)

  union all
  -- Scheduled payables expose each planned cash settlement, while preserving one parent obligation.
  select o.household_id,'payable_schedule:'||s.id::text,'payable_schedule_item',s.id,o.source_transaction_id,null::uuid,o.invoice_id,o.id,null::uuid,
    'payable','outflow','obligation',s.due_date,s.due_date,o.obligation_date,
    case when o.state='cancelled' then 'cancelled'::public.economic_state when o.state='written_off' then 'reversed'::public.economic_state
         when s.realized_item_amount=s.amount then 'realized'::public.economic_state else 'confirmed'::public.economic_state end,
    null::numeric(19,2),s.amount,s.realized_item_amount,
    o.description||' — '||s.number::text||'/'||(select count(*) from public.obligation_repayment_schedule_items x where x.obligation_id=o.id)::text,
    null::uuid,o.created_by_member_id
  from schedule_realization s join public.financial_obligations o on o.id=s.obligation_id and o.household_id=s.household_id
  where o.kind='payable'
),
amounts as (
  select r.*,
    public.financial_effective_total_amount(source_state,estimated_amount,confirmed_amount,realized_amount,confirmed_amount)::numeric(19,2) effective_amount,
    public.financial_remaining_amount(source_state,estimated_amount,confirmed_amount,realized_amount,confirmed_amount)::numeric(19,2) remaining_amount
  from raw_positions r
),
dated as (select a.*,date_trunc('month',financial_date)::date financial_month from amounts a)
select household_id,commitment_key,source_type,source_id,source_transaction_id,source_installment_id,source_invoice_id,
  source_obligation_id,source_recurring_occurrence_id,commitment_type,direction,economic_type,financial_date,financial_month,due_date,economic_date,
  effective_amount,realized_amount,remaining_amount,source_state economic_state,
  case when source_state in ('cancelled','reversed') then source_state when remaining_amount=0 then 'realized'::public.economic_state else source_state end commitment_state,
  coalesce(due_date<current_date,false) and remaining_amount>0 and source_state not in ('cancelled','reversed') is_overdue,
  financial_month<date_trunc('month',current_date)::date and remaining_amount>0 and source_state not in ('cancelled','reversed') is_prior_pending,
  description,category_id,created_by_member_id
from dated;

revoke all on public.financial_commitment_positions from public,anon;
grant select on public.financial_commitment_positions to authenticated;
