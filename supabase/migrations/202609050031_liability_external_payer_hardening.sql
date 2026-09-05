-- Etapa 10H.13: hardening for borrowed-loan and external-payer commands.
-- Forward-only companion to migration 030 in the same release branch.
-- It addresses review findings before either migration is applied remotely.

-- External settlement must reduce future household funding projection without
-- inventing a member funder. Keep realized member funding and external settlement
-- as distinct facts.
create or replace view public.financial_projected_funding_routes with (security_invoker=true) as
with commitments as (
 select c.*,greatest(
   c.effective_amount
   - coalesce((select sum(f.amount) from public.funding_events f
       where f.household_id=c.household_id
         and f.financed_transaction_id=c.source_transaction_id
         and f.installment_id is not distinct from c.source_installment_id),0)
   - case when c.source_installment_id is null then coalesce((select sum(e.amount) from public.external_payment_events e
       where e.household_id=c.household_id and e.source_transaction_id=c.source_transaction_id),0) else 0 end,
   0
 )::numeric(19,2) funding_remaining
 from public.financial_commitment_positions c
 where c.commitment_state not in ('cancelled','reversed')
), candidates as (
 select c.*,p.id plan_id,p.source_account_id,p.amount plan_amount,
   case when p.installment_id=c.source_installment_id and p.installment_id is not null then 1
        when p.obligation_id=c.source_obligation_id and p.obligation_id is not null then 1
        when p.recurring_occurrence_id=c.source_recurring_occurrence_id and p.recurring_occurrence_id is not null then 1
        when p.transaction_id=c.source_transaction_id and p.transaction_id is not null then 2 else 3 end priority,
   p.created_at plan_created_at
 from commitments c join public.commitment_funding_plans p on p.household_id=c.household_id and p.state='active'
  and ((p.installment_id=c.source_installment_id and p.installment_id is not null)
    or (p.obligation_id=c.source_obligation_id and p.obligation_id is not null)
    or (p.recurring_occurrence_id=c.source_recurring_occurrence_id and p.recurring_occurrence_id is not null)
    or (p.transaction_id=c.source_transaction_id and p.transaction_id is not null)
    or (p.recurring_rule_id=(select o.recurring_rule_id from public.recurring_occurrences o where o.id=c.source_recurring_occurrence_id) and p.recurring_rule_id is not null))
), plan_amounts as (
 select x.*,greatest(least(plan_amount,funding_remaining-coalesce(sum(plan_amount) over(partition by commitment_key order by priority,plan_created_at,plan_id rows between unbounded preceding and 1 preceding),0)),0)::numeric(19,2) route_amount
 from candidates x
), explicit_routes as (
 select household_id,commitment_key,source_type,source_id,source_transaction_id,source_installment_id,source_obligation_id,source_recurring_occurrence_id,
   financial_date,financial_month,funding_remaining,plan_id,source_account_id,route_amount,'explicit_override'::text route_source,priority
 from plan_amounts where route_amount>0
), residuals as (
 select c.*,greatest(c.funding_remaining-coalesce(sum(e.route_amount),0),0)::numeric(19,2) residual
 from commitments c left join explicit_routes e using(household_id,commitment_key)
 group by c.household_id,c.commitment_key,c.source_type,c.source_id,c.source_transaction_id,c.source_installment_id,c.source_invoice_id,c.source_obligation_id,c.source_recurring_occurrence_id,c.commitment_type,c.direction,c.economic_type,c.financial_date,c.financial_month,c.due_date,c.economic_date,c.effective_amount,c.realized_amount,c.remaining_amount,c.economic_state,c.commitment_state,c.is_overdue,c.is_prior_pending,c.description,c.category_id,c.created_by_member_id,c.funding_remaining
), fallbacks as (
 select r.*,case when pi.kind='account' then pi.account_id when pi.kind='card' then card.default_payment_account_id end source_account_id,
   case when pi.kind='account' then 'selected_account'::text when pi.kind='card' and card.default_payment_account_id is not null then 'instrument_default'::text else 'unattributed'::text end route_source
 from residuals r left join public.transaction_payment_instruments pi on pi.transaction_id=r.source_transaction_id and pi.household_id=r.household_id
 left join public.cards card on card.id=pi.card_id and card.household_id=r.household_id and card.deactivated_at is null
)
select household_id,commitment_key,source_type,source_id,source_transaction_id,source_installment_id,source_obligation_id,source_recurring_occurrence_id,
 financial_date,financial_month,funding_remaining,plan_id,source_account_id,route_amount,route_source,priority
from explicit_routes
union all
select f.household_id,f.commitment_key,f.source_type,f.source_id,f.source_transaction_id,f.source_installment_id,f.source_obligation_id,f.source_recurring_occurrence_id,
 f.financial_date,f.financial_month,f.funding_remaining,null::uuid,
 case when a.id is not null then f.source_account_id end,
 f.residual,
 case when a.id is null then 'unattributed' else f.route_source end,4
from fallbacks f left join public.accounts a on a.id=f.source_account_id and a.household_id=f.household_id and a.deactivated_at is null
where f.residual>0;

comment on view public.financial_projected_funding_routes is
  'Projected funding excludes both realized member funding and direct external expense settlement. External payers never become member funders.';

create or replace function public.create_borrowed_loan(
  p_household_id uuid,
  p_lender_party_id uuid,
  p_destination_account_id uuid,
  p_principal_amount numeric,
  p_borrowed_at timestamptz,
  p_due_date date,
  p_description text,
  p_request_key text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  existing public.financial_obligations;
  result uuid;
begin
  caller:=public.require_active_member(p_household_id);

  if p_principal_amount<=0
     or p_borrowed_at is null
     or length(trim(coalesce(p_description,'')))=0
     or length(trim(coalesce(p_request_key,'')))=0
     or (p_due_date is not null and p_due_date<p_borrowed_at::date)
  then raise exception 'invalid borrowed-loan command' using errcode='22023'; end if;

  if not exists(select 1 from public.financial_parties where id=p_lender_party_id and household_id=p_household_id and deactivated_at is null)
  then raise exception 'active household lender party required' using errcode='23514'; end if;
  if not exists(select 1 from public.accounts where id=p_destination_account_id and household_id=p_household_id and deactivated_at is null)
  then raise exception 'active household destination account required' using errcode='23514'; end if;

  -- Serialize retries by household + request key so overlapping identical calls
  -- cannot race into the unique constraint.
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':borrowed-loan:'||trim(p_request_key),0));

  select * into existing from public.financial_obligations
  where household_id=p_household_id and command_key=trim(p_request_key);

  if existing.id is not null then
    if existing.kind<>'payable'
       or existing.origin_kind<>'loan'
       or existing.counterparty_id<>p_lender_party_id
       or existing.original_amount<>p_principal_amount
       or existing.obligation_date<>p_borrowed_at::date
       or existing.due_date is distinct from p_due_date
       or existing.description<>trim(p_description)
       or existing.notes is distinct from p_notes
       or not exists(
         select 1 from public.money_movements m
         where m.household_id=p_household_id
           and m.obligation_id=existing.id
           and m.kind='loan_principal'
           and m.destination_account_id=p_destination_account_id
           and m.amount=p_principal_amount
           and m.realized_at=p_borrowed_at
           and m.description=trim(p_description)
           and m.notes is not distinct from p_notes
       )
    then raise exception 'idempotency key already used with different payload' using errcode='23505'; end if;
    return existing.id;
  end if;

  insert into public.financial_obligations(
    household_id,created_by_member_id,kind,origin_kind,counterparty_id,
    original_amount,obligation_date,due_date,description,notes,command_key
  ) values (
    p_household_id,caller.id,'payable','loan',p_lender_party_id,
    p_principal_amount,p_borrowed_at::date,p_due_date,trim(p_description),p_notes,trim(p_request_key)
  ) returning id into result;

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,
    destination_account_id,counterparty_id,obligation_id,
    movement_date,competence_date,notes,realized_at
  ) values (
    p_household_id,caller.id,'loan_principal','realized',p_principal_amount,trim(p_description),
    p_destination_account_id,p_lender_party_id,result,
    p_borrowed_at::date,date_trunc('month',p_borrowed_at)::date,p_notes,p_borrowed_at
  );

  return result;
end
$$;

create or replace function public.record_external_expense_payment(
  p_household_id uuid,
  p_transaction_id uuid,
  p_payer_party_id uuid,
  p_intent public.external_payment_intent,
  p_amount numeric,
  p_occurred_at timestamptz,
  p_request_key text,
  p_due_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx public.transactions;
  existing public.external_payment_events;
  applicable_amount numeric;
  member_funded numeric;
  external_already numeric;
  payable_id uuid;
  result uuid;
  total_realized numeric;
begin
  caller:=public.require_active_member(p_household_id);

  if p_amount<=0 or p_occurred_at is null or length(trim(coalesce(p_request_key,'')))=0
  then raise exception 'invalid external-payment command' using errcode='22023'; end if;
  if p_intent='gift' and p_due_date is not null
  then raise exception 'gift cannot create a reimbursement due date' using errcode='22023'; end if;
  if p_intent='reimbursement' and p_due_date is not null and p_due_date<p_occurred_at::date
  then raise exception 'reimbursement due date cannot precede payment' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':external-payment:'||trim(p_request_key),0));

  select * into existing from public.external_payment_events
  where household_id=p_household_id and request_key=trim(p_request_key);

  if existing.id is not null then
    if existing.source_transaction_id<>p_transaction_id
       or existing.payer_party_id<>p_payer_party_id
       or existing.intent<>p_intent
       or existing.amount<>p_amount
       or existing.occurred_at<>p_occurred_at
       or existing.notes is distinct from p_notes
       or (p_intent='reimbursement' and not exists(
         select 1 from public.financial_obligations o
         where o.id=existing.payable_obligation_id
           and o.household_id=p_household_id
           and o.kind='payable'
           and o.origin_kind='reimbursement'
           and o.counterparty_id=p_payer_party_id
           and o.source_transaction_id=p_transaction_id
           and o.original_amount=p_amount
           and o.obligation_date=p_occurred_at::date
           and o.due_date is not distinct from p_due_date
           and o.notes is not distinct from p_notes
       ))
    then raise exception 'idempotency key already used with different payload' using errcode='23505'; end if;
    return existing.id;
  end if;

  select * into tx from public.transactions
  where id=p_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null
  for update;
  if tx.id is null or tx.economic_state in ('cancelled','reversed')
  then raise exception 'active household expense required' using errcode='23514'; end if;

  if not exists(select 1 from public.financial_parties where id=p_payer_party_id and household_id=p_household_id and deactivated_at is null)
  then raise exception 'active household external payer required' using errcode='23514'; end if;

  -- Reject every currently represented card route, not only financing_allocations.
  if exists(select 1 from public.transaction_payment_instruments pi
            where pi.household_id=p_household_id and pi.transaction_id=tx.id and pi.kind='card')
     or tx.invoice_id is not null
     or exists(
       select 1 from public.installment_plans ip
       join public.installments ins on ins.installment_plan_id=ip.id and ins.household_id=p_household_id
       where ip.household_id=p_household_id and ip.purchase_transaction_id=tx.id and ins.invoice_id is not null
     )
     or exists(select 1 from public.financing_allocations fa
               where fa.household_id=p_household_id and fa.transaction_id=tx.id
                 and fa.mechanism in ('card_purchase','card_pix'))
  then raise exception 'external payer for card-financed expense requires dedicated card route' using errcode='0A000'; end if;

  applicable_amount:=public.financial_effective_total_amount(
    tx.economic_state,tx.estimated_amount,tx.confirmed_amount,tx.realized_amount,tx.amount
  );
  select coalesce(sum(amount),0) into member_funded from public.funding_events
  where financed_transaction_id=tx.id and invoice_id is null;
  select coalesce(sum(amount),0) into external_already from public.external_payment_events
  where source_transaction_id=tx.id;

  if member_funded+external_already+p_amount>applicable_amount
  then raise exception 'external payment exceeds unpaid economic amount' using errcode='23514'; end if;

  if p_intent='reimbursement' then
    insert into public.financial_obligations(
      household_id,created_by_member_id,kind,origin_kind,counterparty_id,
      source_transaction_id,original_amount,obligation_date,due_date,description,notes
    ) values (
      p_household_id,caller.id,'payable','reimbursement',p_payer_party_id,
      tx.id,p_amount,p_occurred_at::date,p_due_date,'Reembolso a terceiro: '||tx.description,p_notes
    ) returning id into payable_id;
  end if;

  insert into public.external_payment_events(
    household_id,source_transaction_id,payer_party_id,intent,amount,occurred_at,
    payable_obligation_id,request_key,notes,created_by_member_id
  ) values (
    p_household_id,tx.id,p_payer_party_id,p_intent,p_amount,p_occurred_at,
    payable_id,trim(p_request_key),p_notes,caller.id
  ) returning id into result;

  total_realized:=member_funded+external_already+p_amount;
  update public.transactions
  set realized_amount=total_realized,
      economic_state=case when total_realized=applicable_amount then 'realized'::public.economic_state else 'confirmed'::public.economic_state end,
      status=case when total_realized=applicable_amount then 'paid'::public.transaction_state else 'pending'::public.transaction_state end,
      settled_at=case when total_realized=applicable_amount then p_occurred_at else null end,
      updated_at=now()
  where id=tx.id;

  return result;
end
$$;

revoke all on function public.create_borrowed_loan(uuid,uuid,uuid,numeric,timestamptz,date,text,text,text) from public,anon;
grant execute on function public.create_borrowed_loan(uuid,uuid,uuid,numeric,timestamptz,date,text,text,text) to authenticated;
revoke all on function public.record_external_expense_payment(uuid,uuid,uuid,public.external_payment_intent,numeric,timestamptz,text,date,text) from public,anon;
grant execute on function public.record_external_expense_payment(uuid,uuid,uuid,public.external_payment_intent,numeric,timestamptz,text,date,text) to authenticated;

-- Regression boundaries:
-- * overlapping retries are serialized by request key;
-- * full effectful payload participates in replay validation;
-- * card purchase/invoice/installment routes are rejected until a dedicated command exists;
-- * external settlement reduces projected funding without inventing member funding.
