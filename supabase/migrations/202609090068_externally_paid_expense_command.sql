-- Nova Despesa: cria o fato econômico e registra o funding externo na mesma transação.
-- Não cria caixa da Casa. Se houver devolução, nasce uma obrigação separada com o terceiro.

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
  op constant text := 'create_externally_paid_expense';
begin
  caller := public.require_active_member(p_household_id);

  if p_request_key is null or length(trim(p_request_key))=0
  then raise exception 'request key is required' using errcode='22023'; end if;
  if p_amount is null or p_amount<=0
     or p_transaction_date is null
     or length(trim(coalesce(p_description,'')))=0
  then raise exception 'invalid externally paid expense' using errcode='22023'; end if;
  if p_transaction_date>current_date
  then raise exception 'expense date cannot be in the future' using errcode='22023'; end if;
  if p_needs_repayment and p_due_date is null
  then raise exception 'repayment due date is required' using errcode='22023'; end if;
  if p_due_date is not null and p_due_date<p_transaction_date
  then raise exception 'repayment due date cannot precede expense date' using errcode='22023'; end if;
  if not exists(
    select 1 from public.financial_parties
    where id=p_payer_party_id and household_id=p_household_id and deactivated_at is null
  ) then raise exception 'active household external payer required' using errcode='23514'; end if;

  existing := public.financial_command_existing_or_lock(p_household_id,op,trim(p_request_key));
  if existing is not null then return existing; end if;

  tx_id := public.create_financial_transaction(
    p_household_id,
    'expense',
    trim(p_description),
    p_amount,
    p_transaction_date,
    p_category_id,
    p_buyer_member_id,
    null,
    null,
    null,
    coalesce(p_splits,'[]'::jsonb),
    1,
    p_notes
  );

  intent := case when p_needs_repayment then 'reimbursement'::public.external_payment_intent else 'gift'::public.external_payment_intent end;
  occurred_at := (p_transaction_date::timestamp + time '12:00') at time zone 'UTC';

  event_id := public.record_external_expense_payment(
    p_household_id,
    tx_id,
    p_payer_party_id,
    intent,
    p_amount,
    occurred_at,
    trim(p_request_key)||':external',
    case when p_needs_repayment then p_due_date else null end,
    p_notes
  );

  perform public.financial_command_store(p_household_id,op,trim(p_request_key),tx_id);
  return tx_id;
end
$$;

revoke all on function public.create_externally_paid_expense(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,boolean,date,text,text) from public,anon;
grant execute on function public.create_externally_paid_expense(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,boolean,date,text,text) to authenticated;

comment on function public.create_externally_paid_expense(uuid,text,numeric,date,uuid,uuid,jsonb,uuid,boolean,date,text,text) is
  'Creates one economic expense and records that an external party funded it atomically. Non-repayable funding creates no Casa cash or payable. Repayable funding creates a linked reimbursement payable without duplicating the expense.';
