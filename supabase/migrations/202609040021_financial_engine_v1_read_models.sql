-- Etapa 10C: read models derivados exclusivamente das fontes canonicas.

create or replace view public.financial_account_balances with (security_invoker=true) as
with balance_events as (
  select household_id,account_id,sum(amount) amount
  from public.account_balance_events where reversed_at is null group by household_id,account_id
), movements as (
  select household_id,account_id,sum(amount) amount from (
    select household_id,destination_account_id account_id,amount from public.money_movements where state='realized' and destination_account_id is not null
    union all
    select household_id,source_account_id,-amount from public.money_movements where state='realized' and source_account_id is not null
  ) legs group by household_id,account_id
)
select a.household_id,a.id account_id,a.name,a.type,a.resource_restriction,a.cash_location,
       coalesce(b.amount,0)+coalesce(m.amount,0) current_balance,
       case when a.resource_restriction is not null or a.type='meal_benefit' then true else false end is_restricted,
       case when a.type='investment' then true else false end is_investment
from public.accounts a left join balance_events b on b.account_id=a.id and b.household_id=a.household_id left join movements m on m.account_id=a.id and m.household_id=a.household_id
where a.deactivated_at is null;

create or replace view public.financial_obligation_balances with (security_invoker=true) as
with reductions as (
  select household_id,obligation_id,sum(amount) reduced_amount
  from public.obligation_events where kind in ('receipt','payment','cancellation','write_off') group by household_id,obligation_id
)
select o.household_id,o.id obligation_id,o.kind,o.origin_kind,o.counterparty_id,o.source_transaction_id,o.invoice_id,
       o.original_amount,coalesce(r.reduced_amount,0) settled_amount,greatest(o.original_amount-coalesce(r.reduced_amount,0),0) outstanding_amount,
       o.obligation_date,o.due_date,o.state,
       (o.due_date<current_date and o.state in ('open','partially_settled') and o.original_amount>coalesce(r.reduced_amount,0)) is_overdue
from public.financial_obligations o left join reductions r on r.obligation_id=o.id and r.household_id=o.household_id;

create or replace view public.financial_invoice_positions with (security_invoker=true) as
select i.household_id,i.id invoice_id,i.card_id,i.competence_date,i.closing_date,i.due_date,i.status,i.total_amount,i.settled_amount,
       greatest(i.total_amount-i.settled_amount-i.financed_balance,0) outstanding_amount,i.financed_balance,i.minimum_payment_amount,
       (i.due_date<current_date and i.status not in ('paid','cancelled') and i.total_amount>i.settled_amount+i.financed_balance) is_overdue,
       c.default_payment_account_id planned_payment_account_id
from public.card_invoices i join public.cards c on c.id=i.card_id and c.household_id=i.household_id where i.deleted_at is null;

create or replace view public.financial_transaction_positions with (security_invoker=true) as
with allocations as (
  select household_id,transaction_id,
         sum(amount) filter(where responsible_member_id is not null) household_economic_amount,
         sum(amount) filter(where responsible_party_id is not null) third_party_economic_amount
  from public.economic_allocations group by household_id,transaction_id
), paid as (
  select household_id,related_transaction_id transaction_id,sum(amount) gross_cash_paid
  from public.money_movements where state='realized' and kind='expense_payment' and related_transaction_id is not null group by household_id,related_transaction_id
), receivables as (
  select o.household_id,o.source_transaction_id transaction_id,sum(b.outstanding_amount) third_party_receivable_outstanding
  from public.financial_obligations o join public.financial_obligation_balances b on b.obligation_id=o.id and b.household_id=o.household_id
  where o.kind='receivable' and o.origin_kind='shared_expense' and o.source_transaction_id is not null group by o.household_id,o.source_transaction_id
)
select t.household_id,t.id transaction_id,t.economic_state,t.amount gross_event_amount,coalesce(a.household_economic_amount,t.amount) household_economic_amount,
       coalesce(a.third_party_economic_amount,0) third_party_economic_amount,coalesce(p.gross_cash_paid,0) gross_cash_paid,
       coalesce(r.third_party_receivable_outstanding,0) third_party_receivable_outstanding
from public.transactions t left join allocations a on a.transaction_id=t.id and a.household_id=t.household_id left join paid p on p.transaction_id=t.id and p.household_id=t.household_id left join receivables r on r.transaction_id=t.id and r.household_id=t.household_id
where t.type='expense' and t.deleted_at is null and t.economic_state not in ('cancelled','reversed');

create or replace view public.financial_member_positions with (security_invoker=true) as
with responsibility as (
  select a.household_id,a.responsible_member_id member_id,
         sum(a.amount) filter(where t.economic_state='realized') economic_responsibility,
         sum(a.amount) filter(where t.economic_state='confirmed') confirmed_responsibility,
         sum(a.amount) filter(where t.economic_state='forecast') forecast_responsibility
  from public.economic_allocations a join public.transactions t on t.id=a.transaction_id and t.household_id=a.household_id
  where a.responsible_member_id is not null and t.type='expense' and t.economic_state not in ('cancelled','reversed') and t.deleted_at is null group by a.household_id,a.responsible_member_id
), funding as (
  select household_id,funder_member_id member_id,sum(amount) real_funding from public.funding_events group by household_id,funder_member_id
)
select m.household_id,m.id member_id,coalesce(r.economic_responsibility,0) economic_responsibility,coalesce(r.confirmed_responsibility,0) confirmed_responsibility,coalesce(r.forecast_responsibility,0) forecast_responsibility,coalesce(f.real_funding,0) real_funding
from public.household_members m left join responsibility r on r.household_id=m.household_id and r.member_id=m.id left join funding f on f.household_id=m.household_id and f.member_id=m.id
where m.deactivated_at is null;

create or replace view public.financial_household_position with (security_invoker=true) as
with accounts as (
 select household_id,
   sum(current_balance) filter(where not is_restricted and not is_investment) available_money,
   sum(current_balance) filter(where is_restricted) restricted_resources,
   sum(current_balance) filter(where resource_restriction='reserve') reserves,
   sum(current_balance) filter(where is_investment) investments
 from public.financial_account_balances group by household_id
), obligations as (
 select household_id,
   sum(outstanding_amount) filter(where kind='receivable' and state in ('open','partially_settled')) receivables,
   sum(outstanding_amount) filter(where kind='payable' and state in ('open','partially_settled')) payables,
   sum(outstanding_amount) filter(where state in ('open','partially_settled') and due_date>current_date) future_obligations
 from public.financial_obligation_balances group by household_id
), invoices as (
 select household_id,sum(outstanding_amount) open_invoices,sum(outstanding_amount) filter(where due_date>current_date) planned_invoice_payments
 from public.financial_invoice_positions group by household_id
), projected as (
 select household_id,
   coalesce(sum(amount) filter(where destination_account_id is not null),0)-coalesce(sum(amount) filter(where source_account_id is not null),0) projected_cash_change
 from public.money_movements where state='projected' group by household_id
), economics as (
 select household_id,
   sum(household_economic_amount) filter(where economic_state='realized') realized_household_expense,
   sum(household_economic_amount) filter(where economic_state='confirmed') confirmed_household_expense,
   sum(household_economic_amount) filter(where economic_state='forecast') forecast_household_expense,
   sum(gross_cash_paid) gross_expense_cash_paid,
   sum(third_party_economic_amount) third_party_expense_share
 from public.financial_transaction_positions group by household_id
)
select h.id household_id,coalesce(a.available_money,0) available_money,coalesce(a.restricted_resources,0) restricted_resources,
       coalesce(a.reserves,0) reserves,coalesce(a.investments,0) investments,coalesce(o.receivables,0) receivables,
       coalesce(o.payables,0) payables,coalesce(o.future_obligations,0) future_obligations,coalesce(i.open_invoices,0) open_invoices,
       coalesce(i.planned_invoice_payments,0) planned_payments,coalesce(e.realized_household_expense,0) realized_household_expense,
       coalesce(e.confirmed_household_expense,0) confirmed_household_expense,coalesce(e.forecast_household_expense,0) forecast_household_expense,
       coalesce(e.gross_expense_cash_paid,0) gross_expense_cash_paid,coalesce(e.third_party_expense_share,0) third_party_expense_share,
       coalesce(o.payables,0)+coalesce(i.open_invoices,0) committed_balance,
       coalesce(a.available_money,0)+coalesce(p.projected_cash_change,0)-coalesce(o.payables,0)-coalesce(i.open_invoices,0) projected_balance,
       coalesce(a.available_money,0)+coalesce(a.restricted_resources,0)+coalesce(a.investments,0)+coalesce(o.receivables,0)-coalesce(o.payables,0)-coalesce(i.open_invoices,0) basic_net_worth
from public.households h left join accounts a on a.household_id=h.id left join obligations o on o.household_id=h.id left join invoices i on i.household_id=h.id left join projected p on p.household_id=h.id left join economics e on e.household_id=h.id
where h.deleted_at is null;

revoke all on public.financial_account_balances,public.financial_obligation_balances,public.financial_invoice_positions,public.financial_transaction_positions,public.financial_member_positions,public.financial_household_position from public,anon;
grant select on public.financial_account_balances,public.financial_obligation_balances,public.financial_invoice_positions,public.financial_transaction_positions,public.financial_member_positions,public.financial_household_position to authenticated;
