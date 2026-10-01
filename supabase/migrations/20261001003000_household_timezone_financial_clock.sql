-- Fix Casa financial clock at UTC month boundaries.
-- Financial "today" follows the household timezone, never the database server date.

create or replace function public.financial_household_today(p_household_id uuid)
returns date
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select (timezone(h.timezone,now()))::date
  from public.households h
  where h.id=p_household_id
    and public.is_active_household_member(p_household_id)
$$;

create or replace function public.financial_household_current_month(p_household_id uuid)
returns date
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select date_trunc('month',public.financial_household_today(p_household_id))::date
$$;

revoke all on function public.financial_household_today(uuid), public.financial_household_current_month(uuid) from public,anon;
grant execute on function public.financial_household_today(uuid), public.financial_household_current_month(uuid) to authenticated;

create or replace function public.financial_monthly_projection(
  p_household_id uuid,
  p_reference_month date default date_trunc('month',current_date)::date,
  p_horizon_months integer default 4
)
returns table (
  household_id uuid,
  reference_month date,
  financial_month date,
  month_index integer,
  opening_cash numeric(19,2),
  realized_true_income_in_month numeric(19,2),
  expected_reliable_income_remaining numeric(19,2),
  realized_commitments_in_month numeric(19,2),
  remaining_commitments_in_month numeric(19,2),
  projected_recurring_commitments numeric(19,2),
  prior_pending_outflow numeric(19,2),
  projected_net_change numeric(19,2),
  projected_ending_cash numeric(19,2)
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
#variable_conflict use_column
declare
  v_reference_month date:=date_trunc('month',p_reference_month)::date;
  v_current_month date:=public.financial_household_current_month(p_household_id);
  v_reference_offset integer;
begin
  if p_household_id is null or p_reference_month is null then
    raise exception 'household and reference month are required' using errcode='22004';
  end if;
  if p_reference_month<>v_reference_month then
    raise exception 'reference month must be the first day of a month' using errcode='22023';
  end if;
  if p_horizon_months is null or p_horizon_months<1 or p_horizon_months>120 then
    raise exception 'horizon must be between 1 and 120 months' using errcode='22023';
  end if;
  if v_reference_month<v_current_month then
    raise exception 'reference month cannot precede the current month without a historical cash snapshot' using errcode='22023';
  end if;
  v_reference_offset:=((extract(year from v_reference_month)-extract(year from v_current_month))*12
    +extract(month from v_reference_month)-extract(month from v_current_month))::integer;
  if not public.is_active_household_member(p_household_id) then
    raise exception 'active household membership required' using errcode='42501';
  end if;

  return query
  with
  months as (
    select n::integer as chain_month_index,
           (v_current_month+(n||' months')::interval)::date as financial_month
      from generate_series(0,v_reference_offset+p_horizon_months-1) n
  ),
  cash as (
    select coalesce(sum(c.current_balance),0)::numeric(19,2) as amount
      from public.financial_available_cash_positions c
     where c.household_id=p_household_id
  ),
  incomes as (
    select i.financial_month,
           coalesce(sum(i.amount) filter(where i.state='realized'),0)::numeric(19,2) as realized_amount,
           coalesce(sum(i.reliable_remaining_amount) filter(where i.state='projected'),0)::numeric(19,2) as expected_amount
      from public.financial_true_income_positions i
     where i.household_id=p_household_id
       and i.financial_month between v_current_month
           and (v_reference_month+((p_horizon_months-1)||' months')::interval)::date
     group by i.financial_month
  ),
  commitment_base as materialized (
    select c.*
      from public.financial_commitment_positions c
     where c.household_id=p_household_id
       and c.commitment_state not in ('cancelled','reversed')
  ),
  commitments as (
    select c.financial_month,
           coalesce(sum(c.realized_amount),0)::numeric(19,2) as realized_amount,
           coalesce(sum(c.remaining_amount),0)::numeric(19,2) as remaining_amount
      from commitment_base c
     where c.financial_month between v_current_month
           and (v_reference_month+((p_horizon_months-1)||' months')::interval)::date
     group by c.financial_month
  ),
  prior_pending as (
    select coalesce(sum(c.remaining_amount),0)::numeric(19,2) as amount
      from commitment_base c
     where c.financial_month<v_current_month
       and c.remaining_amount>0
  ),
  recurring_dates as (
    select r.id as recurring_rule_id,r.template_transaction_id,
           occurrence_at::date as occurrence_date,
           date_trunc('month',occurrence_at)::date as financial_month,
           case when r.amount_mode='estimated' then r.estimated_amount
                else coalesce(r.estimated_amount,t.confirmed_amount,t.estimated_amount,t.amount)
            end::numeric(19,2) as amount
      from public.recurring_rules r
      join public.transactions t
        on t.id=r.template_transaction_id and t.household_id=r.household_id
       and t.type='expense' and t.deleted_at is null
       and t.economic_state not in ('cancelled','reversed')
      cross join lateral generate_series(
        r.start_date::timestamp,
        least(coalesce(r.end_date,'infinity'::date),
              (v_reference_month+(p_horizon_months||' months')::interval-interval '1 day')::date)::timestamp,
        case r.frequency
          when 'weekly' then make_interval(days=>7*r.interval_count)
          when 'monthly' then make_interval(months=>r.interval_count)
          when 'yearly' then make_interval(years=>r.interval_count)
        end
      ) occurrence_at
     where r.household_id=p_household_id and r.deactivated_at is null
       and r.start_date<(v_reference_month+(p_horizon_months||' months')::interval)::date
       and (r.end_date is null or r.end_date>=v_current_month)
       and (r.amount_mode<>'estimated' or r.estimated_amount is not null)
  ),
  projected_recurring as (
    select d.financial_month,sum(d.amount)::numeric(19,2) as amount
      from recurring_dates d
     where d.financial_month>=v_current_month
       and not exists (
         select 1 from public.recurring_occurrences o
          where o.household_id=p_household_id
            and o.recurring_rule_id=d.recurring_rule_id
            and o.competence_date=d.occurrence_date
       )
       and not exists (
         select 1 from commitment_base c
          where c.source_transaction_id=d.template_transaction_id
            and c.financial_month=d.financial_month
       )
     group by d.financial_month
  ),
  monthly as (
    select m.chain_month_index,m.financial_month,
           coalesce(i.realized_amount,0)::numeric(19,2) as realized_income,
           coalesce(i.expected_amount,0)::numeric(19,2) as expected_income,
           coalesce(c.realized_amount,0)::numeric(19,2) as realized_commitments,
           coalesce(c.remaining_amount,0)::numeric(19,2) as remaining_commitments,
           coalesce(r.amount,0)::numeric(19,2) as recurring_commitments,
           case when m.chain_month_index=0 then p.amount else 0::numeric end::numeric(19,2) as prior_pending
      from months m
      cross join prior_pending p
      left join incomes i using(financial_month)
      left join commitments c using(financial_month)
      left join projected_recurring r using(financial_month)
  ),
  calculated as (
    select m.*,
           (m.expected_income-m.remaining_commitments-m.recurring_commitments-m.prior_pending)::numeric(19,2) as net_change
      from monthly m
  )
  , projected as (
    select c.*,
           (base.amount+coalesce(sum(c.net_change) over (
             order by c.chain_month_index rows between unbounded preceding and 1 preceding
           ),0))::numeric(19,2) as projected_opening_cash,
           (base.amount+sum(c.net_change) over (
             order by c.chain_month_index rows between unbounded preceding and current row
           ))::numeric(19,2) as projected_ending_cash
      from calculated c cross join cash base
  )
  select p_household_id,v_reference_month,p.financial_month,
         (p.chain_month_index-v_reference_offset)::integer,
         p.projected_opening_cash,p.realized_income,p.expected_income,
         p.realized_commitments,p.remaining_commitments,p.recurring_commitments,
         p.prior_pending,p.net_change,p.projected_ending_cash
    from projected p
   where p.chain_month_index>=v_reference_offset
   order by p.chain_month_index;
end
$$;

create or replace function public.financial_member_monthly_projection(
 p_household_id uuid,p_member_id uuid,p_reference_month date default date_trunc('month',current_date)::date,p_horizon_months integer default 4
) returns table(
 household_id uuid,member_id uuid,reference_month date,financial_month date,month_index integer,
 opening_liquidity numeric(19,2),realized_true_income_in_month numeric(19,2),expected_reliable_income_remaining numeric(19,2),
 economic_responsibility_remaining numeric(19,2),realized_funding_in_month numeric(19,2),projected_funding_remaining numeric(19,2),
 unattributed_funding_remaining numeric(19,2),scheduled_settlement_inflow numeric(19,2),scheduled_settlement_outflow numeric(19,2),
 settlement_receivable_position numeric(19,2),settlement_payable_position numeric(19,2),projected_net_change numeric(19,2),projected_ending_liquidity numeric(19,2)
) language plpgsql stable security invoker set search_path=public,pg_temp as $$
#variable_conflict use_column
declare v_reference date:=date_trunc('month',p_reference_month)::date; v_current date:=public.financial_household_current_month(p_household_id); v_offset integer;
begin
 if p_household_id is null or p_member_id is null or p_reference_month<>v_reference then raise exception 'household, member and first day reference month required' using errcode='22023'; end if;
 if p_horizon_months is null or p_horizon_months<1 or p_horizon_months>120 then raise exception 'horizon must be between 1 and 120 months' using errcode='22023'; end if;
 if v_reference<v_current then raise exception 'reference month cannot precede current month without historical liquidity snapshots' using errcode='22023'; end if;
 if not public.is_active_household_member(p_household_id) or not exists(select 1 from public.household_members m where m.id=p_member_id and m.household_id=p_household_id and m.deactivated_at is null) then raise exception 'active household membership required' using errcode='42501'; end if;
 v_offset:=((extract(year from v_reference)-extract(year from v_current))*12+extract(month from v_reference)-extract(month from v_current))::integer;
 return query with months as (
  select n::integer chain_index,(v_current+(n||' months')::interval)::date financial_month from generate_series(0,v_offset+p_horizon_months-1)n
 ), cash as (
  select coalesce(sum(attributed_liquidity),0)::numeric(19,2) amount from public.financial_member_liquidity_positions where financial_member_liquidity_positions.household_id=p_household_id and financial_member_liquidity_positions.member_id=p_member_id
 ), income as (
  select i.financial_month,coalesce(sum(i.amount) filter(where i.state='realized'),0)::numeric(19,2) realized_amount,coalesce(sum(i.reliable_remaining_amount) filter(where i.state='projected'),0)::numeric(19,2) expected_amount
  from public.financial_member_true_income_positions i where i.household_id=p_household_id and i.member_id=p_member_id group by i.financial_month
 ), responsibility as (
  select financial_month,sum(amount)::numeric(19,2) amount from (
   select r.financial_month,r.remaining_responsibility_amount amount from public.financial_member_commitment_responsibility_positions r where r.household_id=p_household_id and r.member_id=p_member_id and r.commitment_state not in ('cancelled','reversed')
   union all select r.financial_month,r.responsibility_amount from public.financial_member_recurring_responsibility_positions r where r.household_id=p_household_id and r.member_id=p_member_id
  ) x group by financial_month
 ), funding as (
  select financial_month,coalesce(sum(amount) filter(where funding_state='realized'),0)::numeric(19,2) realized_amount,coalesce(sum(amount) filter(where funding_state='projected'),0)::numeric(19,2) projected_amount from (
   select f.financial_month,f.amount,f.funding_state from public.financial_member_funding_positions f where f.household_id=p_household_id and f.member_id=p_member_id
   union all select f.financial_month,f.amount,'projected'::text from public.financial_member_recurring_funding_positions f where f.household_id=p_household_id and f.member_id=p_member_id
  ) x group by financial_month
 ), unattributed as (
  select financial_month,sum(amount)::numeric(19,2) amount from (
   select financial_month,amount from public.financial_member_funding_positions where financial_member_funding_positions.household_id=p_household_id and is_unattributed and funding_state='projected'
   union all select financial_month,amount from public.financial_member_recurring_funding_positions where financial_member_recurring_funding_positions.household_id=p_household_id and is_unattributed
  ) x group by financial_month
 ), schedules as (
  select financial_month,sum(scheduled_inflow)::numeric(19,2) inflow,sum(scheduled_outflow)::numeric(19,2) outflow from public.financial_member_settlement_cash_flows where financial_member_settlement_cash_flows.household_id=p_household_id and financial_member_settlement_cash_flows.member_id=p_member_id group by financial_month
 ), positions as (
  select coalesce(sum(realized_outstanding) filter(where creditor_member_id=p_member_id),0)::numeric(19,2) receivable,coalesce(sum(realized_outstanding) filter(where debtor_member_id=p_member_id),0)::numeric(19,2) payable from public.financial_member_settlement_positions where financial_member_settlement_positions.household_id=p_household_id
 ), monthly as (
  select m.*,coalesce(i.realized_amount,0) income_realized,coalesce(i.expected_amount,0) income_expected,coalesce(r.amount,0) responsibility_remaining,
   coalesce(f.realized_amount,0) funding_realized,coalesce(f.projected_amount,0) funding_projected,coalesce(u.amount,0) funding_unattributed,
   coalesce(s.inflow,0) settlement_inflow,coalesce(s.outflow,0) settlement_outflow
  from months m left join income i using(financial_month) left join responsibility r using(financial_month) left join funding f using(financial_month) left join unattributed u using(financial_month) left join schedules s using(financial_month)
 ), calculated as (
  select m.*,(income_expected+settlement_inflow-funding_projected-settlement_outflow)::numeric(19,2) net_change from monthly m
 ), projected as (
  select c.*,(base.amount+coalesce(sum(net_change) over(order by chain_index rows between unbounded preceding and 1 preceding),0))::numeric(19,2) opening_amount,
   (base.amount+sum(net_change) over(order by chain_index rows between unbounded preceding and current row))::numeric(19,2) ending_amount from calculated c cross join cash base
 ) select p_household_id,p_member_id,v_reference,p.financial_month,(p.chain_index-v_offset)::integer,p.opening_amount,p.income_realized,p.income_expected,
   p.responsibility_remaining,p.funding_realized,p.funding_projected,p.funding_unattributed,p.settlement_inflow,p.settlement_outflow,
   pos.receivable,pos.payable,p.net_change,p.ending_amount from projected p cross join positions pos where p.chain_index>=v_offset order by p.chain_index;
end $$;

alter table public.commitment_funding_plans enable row level security;
revoke all on table public.commitment_funding_plans from public,anon;
revoke insert,update,delete,truncate,references,trigger on table public.commitment_funding_plans from authenticated;
grant select on table public.commitment_funding_plans to authenticated;
create policy commitment_funding_plans_household_select on public.commitment_funding_plans for select to authenticated using(public.is_active_household_member(household_id));

revoke all on public.financial_account_member_allocations,public.financial_member_liquidity_positions,public.financial_member_commitment_responsibility_positions,public.financial_projected_funding_routes,public.financial_member_funding_positions,public.financial_member_true_income_positions,public.financial_member_settlement_cash_flows,public.financial_recurring_projection_positions,public.financial_member_recurring_responsibility_positions,public.financial_member_recurring_funding_positions from public,anon;
grant select on public.financial_account_member_allocations,public.financial_member_liquidity_positions,public.financial_member_commitment_responsibility_positions,public.financial_projected_funding_routes,public.financial_member_funding_positions,public.financial_member_true_income_positions,public.financial_member_settlement_cash_flows,public.financial_recurring_projection_positions,public.financial_member_recurring_responsibility_positions,public.financial_member_recurring_funding_positions to authenticated;
revoke all on function public.set_commitment_funding_plan(uuid,uuid,numeric,text,uuid,uuid,uuid,uuid,uuid,text),public.cancel_commitment_funding_plan(uuid,uuid),public.replace_commitment_funding_plan(uuid,uuid,uuid,numeric,text,text),public.financial_member_monthly_projection(uuid,uuid,date,integer) from public,anon;
grant execute on function public.set_commitment_funding_plan(uuid,uuid,numeric,text,uuid,uuid,uuid,uuid,uuid,text),public.cancel_commitment_funding_plan(uuid,uuid),public.replace_commitment_funding_plan(uuid,uuid,uuid,numeric,text,text),public.financial_member_monthly_projection(uuid,uuid,date,integer) to authenticated;

comment on view public.financial_member_liquidity_positions is 'Available cash attributed only through canonical active account ownerships; one owner gets 100%, exactly two active household members get deterministic 50/50, and invalid ownership remains unattributed. Negative balances remain negative and overdraft is excluded.';
comment on view public.financial_member_commitment_responsibility_positions is 'Monthly economic responsibility derived exclusively from economic_allocations over canonical deduplicated commitments.';
comment on view public.financial_projected_funding_routes is 'Remaining funding route hierarchy: explicit partial overrides, selected account, valid card default, then unattributed. Card owner, buyer, creator, responsibility, and legacy account owner are never fallbacks.';
comment on view public.financial_member_funding_positions is 'Realized funding comes only from funding_events; projected funding covers only the remaining commitment. Both are attributed through canonical account ownership.';
comment on view public.financial_member_settlement_cash_flows is 'Scheduled-only intermember cash flows. Realized schedules and unscheduled positions never enter future cash projection.';

create or replace function public.financial_household_health_position(p_household_id uuid)
returns table (
  household_id uuid,
  reference_month date,
  current_cash numeric(19,2),
  expected_reliable_income_remaining numeric(19,2),
  remaining_commitments numeric(19,2),
  prior_pending_outflow numeric(19,2),
  projected_ending_cash numeric(19,2),
  capacity_base numeric(19,2),
  projected_margin_ratio numeric,
  overdraft_used numeric(19,2),
  overdue_commitment_amount numeric(19,2),
  base_health text,
  health text,
  health_reason text
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  p record;
  v_overdraft_used numeric(19,2);
  v_overdue numeric(19,2);
  v_capacity numeric(19,2);
  v_ratio numeric;
  v_base text;
  v_health text;
  v_reason text;
begin
  if p_household_id is null then
    raise exception 'household is required' using errcode='22004';
  end if;
  if not public.is_active_household_member(p_household_id) then
    raise exception 'active household membership required' using errcode='42501';
  end if;

  select * into p
  from public.financial_monthly_projection(
    p_household_id,
    public.financial_household_current_month(p_household_id),
    1
  )
  limit 1;

  select coalesce(sum(o.overdraft_used),0)::numeric(19,2)
    into v_overdraft_used
  from public.financial_overdraft_positions o
  where o.household_id=p_household_id;

  select coalesce(sum(c.remaining_amount),0)::numeric(19,2)
    into v_overdue
  from public.financial_commitment_positions c
  where c.household_id=p_household_id
    and c.remaining_amount>0
    and c.is_overdue
    and c.commitment_state::text not in ('cancelled','reversed');

  -- Pre-outflow capacity is the correct comparator for overdue debt.
  -- projected_ending_cash already subtracts the same commitments and therefore
  -- must not be used to decide whether those commitments were coverable.
  v_capacity:=greatest(
    coalesce(p.opening_cash,0)+coalesce(p.expected_reliable_income_remaining,0),
    0
  )::numeric(19,2);
  v_ratio:=case
    when v_capacity>0 then round(coalesce(p.projected_ending_cash,0)/v_capacity,6)
    else null
  end;

  v_base:=case
    when coalesce(p.projected_ending_cash,0)<0 then 'red'
    when v_capacity=0 then 'green'
    when v_ratio>=.20 then 'green'
    when v_ratio>=.05 then 'yellow'
    else 'red'
  end;

  v_health:=v_base;
  v_reason:='projected_margin';

  if coalesce(p.projected_ending_cash,0)<0 then
    v_health:='red';
    v_reason:='negative_projection';
  elsif v_overdue>v_capacity and v_overdue>0 then
    v_health:='red';
    v_reason:='overdue_without_projected_capacity';
  elsif v_base='green' and v_overdraft_used>0 then
    v_health:='yellow';
    v_reason:='overdraft_in_use';
  elsif v_base='green' and v_overdue>0 then
    v_health:='yellow';
    v_reason:='overdue_open_commitment';
  end if;

  return query select p_household_id,
                      public.financial_household_current_month(p_household_id),
                      coalesce(p.opening_cash,0)::numeric(19,2),
                      coalesce(p.expected_reliable_income_remaining,0)::numeric(19,2),
                      (coalesce(p.remaining_commitments_in_month,0)+coalesce(p.projected_recurring_commitments,0))::numeric(19,2),
                      coalesce(p.prior_pending_outflow,0)::numeric(19,2),
                      coalesce(p.projected_ending_cash,0)::numeric(19,2),
                      v_capacity,v_ratio,v_overdraft_used,v_overdue,v_base,v_health,v_reason;
end
$$;

create or replace function public.financial_attention_items(p_household_id uuid)
returns table (
  household_id uuid,attention_key text,attention_type text,severity text,amount numeric(19,2),due_date date,entity_type text,entity_id uuid,title text
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  with health as materialized (
    select * from public.financial_household_health_position(p_household_id)
  ), base as (
    select c.household_id,'commitment:'||c.commitment_key,'overdue_commitment',
           case when c.remaining_amount>greatest(coalesce(h.current_cash,0)+coalesce(h.expected_reliable_income_remaining,0),0) then 'red' else 'yellow' end,
           c.remaining_amount::numeric(19,2),c.due_date,case when c.source_type='loan_schedule_item' then 'loan_schedule_item' else 'commitment' end,c.source_id,c.description
      from public.financial_commitment_positions c
      left join health h on true
     where c.household_id=p_household_id and c.remaining_amount>0 and c.is_overdue
       and c.commitment_state::text not in ('cancelled','reversed') and c.source_invoice_id is null and (c.source_obligation_id is null or c.source_type='loan_schedule_item')
    union all
    select i.household_id,'invoice:'||i.invoice_id::text,'overdue_invoice','red',i.remaining_amount::numeric(19,2),i.due_date,'invoice',i.invoice_id,'Fatura vencida'
      from public.financial_card_invoice_positions i where i.household_id=p_household_id and i.is_overdue and i.remaining_amount>0
    union all
    select b.household_id,'obligation:'||b.obligation_id::text,case when b.kind='payable' then 'overdue_payable' else 'overdue_receivable' end,'yellow',b.outstanding_amount::numeric(19,2),b.due_date,'obligation',b.obligation_id,case when b.kind='payable' then 'Valor a pagar vencido' else 'Valor a receber vencido' end
      from public.financial_obligation_balances b where b.household_id=p_household_id and b.is_overdue and b.outstanding_amount>0
       and not exists(select 1 from public.loan_schedule_items ls where ls.household_id=b.household_id and ls.principal_obligation_id=b.obligation_id)
    union all
    select i.household_id,'income:'||i.money_movement_id::text,'delayed_expected_income','yellow',i.reliable_remaining_amount::numeric(19,2),i.movement_date,'money_movement',i.money_movement_id,'Entrada esperada atrasada'
      from public.financial_true_income_positions i where i.household_id=p_household_id and i.state='projected' and i.reliable_remaining_amount>0 and i.movement_date<public.financial_household_today(p_household_id)
    union all
    select s.household_id,'settlement:'||s.id::text,'overdue_member_settlement','yellow',s.amount::numeric(19,2),s.due_date,'member_settlement_schedule',s.id,'Acerto programado vencido'
      from public.member_settlement_schedules s where s.household_id=p_household_id and s.state='scheduled' and s.due_date<public.financial_household_today(p_household_id)
    union all
    select o.household_id,'overdraft:'||o.account_id::text,'overdraft_in_use',case when o.overdraft_over_limit>0 then 'red' else 'yellow' end,o.overdraft_used::numeric(19,2),null::date,'account',o.account_id,'LIS em uso'
      from public.financial_overdraft_positions o where o.household_id=p_household_id and o.overdraft_used>0
    union all
    select c.household_id,'card-limit:'||c.card_id::text,'card_over_limit','red',c.over_limit_amount::numeric(19,2),c.next_due_date,'card',c.card_id,'Cartão acima do limite'
      from public.financial_card_health_positions c where c.household_id=p_household_id and c.over_limit_amount>0
    union all
    select i.household_id,'invoice-coverage:'||i.invoice_id::text,'card_coverage_risk','yellow',i.remaining_amount::numeric(19,2),i.due_date,'invoice',i.invoice_id,'Fatura próxima do vencimento sem cobertura projetada'
      from public.financial_card_invoice_positions i
      cross join health h
     where i.household_id=p_household_id and i.state<>'cancelled' and not i.is_overdue and i.remaining_amount>0
       and i.due_date between public.financial_household_today(p_household_id) and public.financial_household_today(p_household_id)+7 and i.remaining_amount>greatest(coalesce(h.projected_ending_cash,0)+i.remaining_amount,0)
    union all
    select p_household_id,'projection:'||date_trunc('month',public.financial_household_today(p_household_id))::date::text,'negative_projection','red',abs(h.projected_ending_cash)::numeric(19,2),(date_trunc('month',public.financial_household_today(p_household_id))+interval '1 month'-interval '1 day')::date,'household',p_household_id,'Projeção do mês ficou negativa'
      from health h where coalesce(h.projected_ending_cash,0)<0
  ), recurring_due as (
    select r.household_id,'recurring-due:'||r.occurrence_id::text,'recurring_expense_due',
           case when r.attention_state='overdue' then 'yellow' else 'yellow' end,
           r.remaining_amount::numeric(19,2),r.due_date,'recurring_occurrence',r.occurrence_id,
           case when r.attention_state='overdue' then r.description||' · vencida'
                when r.attention_state='due_today' then r.description||' · vence hoje'
                else r.description||' · vence em breve' end
      from public.financial_recurring_expense_attention_positions r
     where r.household_id=p_household_id and r.attention_state in ('overdue','due_today','due_soon')
       and not (r.attention_state='overdue')
  )
  select * from base
  union all
  select * from recurring_due;
$$;

revoke all on function public.financial_monthly_projection(uuid,date,integer),
  public.financial_member_monthly_projection(uuid,uuid,date,integer),
  public.financial_household_health_position(uuid),
  public.financial_attention_items(uuid)
from public,anon;

grant execute on function public.financial_monthly_projection(uuid,date,integer),
  public.financial_member_monthly_projection(uuid,uuid,date,integer),
  public.financial_household_health_position(uuid),
  public.financial_attention_items(uuid)
to authenticated;
