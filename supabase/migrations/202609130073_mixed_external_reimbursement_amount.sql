-- PR A: responsabilidade mista + pagamento externo.
-- O valor pago externamente continua sendo bruto, mas o pagável de reembolso
-- deve refletir somente a responsabilidade econômica da Casa.

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
  allocation_count integer;
  household_responsibility numeric;
  reimbursement_amount numeric;
  prior_reimbursement_amount numeric;
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
           and o.original_amount>0
           and o.original_amount<=p_amount
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

  select count(*),
         coalesce(sum(a.amount) filter(where a.responsible_member_id is not null),0)
    into allocation_count,household_responsibility
  from public.economic_allocations a
  where a.household_id=p_household_id and a.transaction_id=tx.id;

  -- Compatibilidade conservadora para fatos legados sem economic_allocations:
  -- antes do modelo de responsabilidade explícita, o valor integral era tratado
  -- como responsabilidade da Casa.
  if allocation_count=0 then
    household_responsibility:=applicable_amount;
  end if;

  select coalesce(sum(amount),0) into member_funded from public.funding_events
  where household_id=p_household_id and financed_transaction_id=tx.id and invoice_id is null;
  select coalesce(sum(amount),0) into external_already from public.external_payment_events
  where household_id=p_household_id and source_transaction_id=tx.id;

  if member_funded+external_already+p_amount>applicable_amount
  then raise exception 'external payment exceeds unpaid economic amount' using errcode='23514'; end if;

  if p_intent='reimbursement' then
    select coalesce(sum(o.original_amount),0) into prior_reimbursement_amount
    from public.financial_obligations o
    where o.household_id=p_household_id
      and o.source_transaction_id=tx.id
      and o.kind='payable'
      and o.origin_kind='reimbursement';

    reimbursement_amount:=least(
      p_amount,
      greatest(household_responsibility-prior_reimbursement_amount,0)
    );

    if reimbursement_amount<=0 then
      raise exception 'no household responsibility remains to reimburse' using errcode='23514';
    end if;

    insert into public.financial_obligations(
      household_id,created_by_member_id,kind,origin_kind,counterparty_id,
      source_transaction_id,original_amount,obligation_date,due_date,description,notes
    ) values (
      p_household_id,caller.id,'payable','reimbursement',p_payer_party_id,
      tx.id,reimbursement_amount,p_occurred_at::date,p_due_date,'Reembolso a terceiro: '||tx.description,p_notes
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

revoke all on function public.record_external_expense_payment(uuid,uuid,uuid,public.external_payment_intent,numeric,timestamptz,text,date,text) from public,anon;
grant execute on function public.record_external_expense_payment(uuid,uuid,uuid,public.external_payment_intent,numeric,timestamptz,text,date,text) to authenticated;

comment on function public.record_external_expense_payment(uuid,uuid,uuid,public.external_payment_intent,numeric,timestamptz,text,date,text) is
  'Records gross external funding for an expense. Reimbursement creates a payable only for the remaining economic responsibility of household members; a third party responsibility never becomes Casa liability.';

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
  base_cents:=floor(total_cents::numeric/count_value)::bigint;
  remainder:=(total_cents-base_cents*count_value)::integer;
  for n in 1..count_value loop
    item_cents:=base_cents+case when n<=remainder then 1 else 0 end;
    insert into public.obligation_repayment_schedule_items(household_id,obligation_id,created_by_member_id,number,amount,due_date)
    values(
      p_household_id,obligation_id,caller.id,n,item_cents::numeric/100,
      (p_first_due_date+make_interval(months => n-1))::date
    );
  end loop;

  perform public.set_commitment_funding_plan(
    p_household_id,p_planned_source_account_id,repayable_amount,trim(p_request_key)||':funding',
    null,null,obligation_id,null,null,p_notes
  );

  perform public.financial_command_store(p_household_id,op,trim(p_request_key),tx_id);
  return tx_id;
end $$;

revoke all on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) from public,anon;
grant execute on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) to authenticated;

comment on function public.create_externally_paid_expense_with_repayment_plan(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,text,integer,date,uuid,text,text) is
  'Creates gross external funding, a reimbursement payable limited to Casa economic responsibility, and a repayment schedule/funding plan that close exactly that reimbursable amount.';