-- Etapa 10CU: rota canônica de despesa financiada por PIX no cartão.
-- O principal mantém a natureza econômica da despesa. Taxa e juros são fatos econômicos separados.

create or replace function public.create_card_pix_expense(
  p_household_id uuid,
  p_description text,
  p_principal_amount numeric,
  p_transaction_date date,
  p_category_id uuid,
  p_buyer_member_id uuid,
  p_card_id uuid,
  p_principal_splits jsonb,
  p_principal_installment_count integer default 1,
  p_fee_amount numeric default 0,
  p_fee_category_id uuid default null,
  p_fee_splits jsonb default '[]'::jsonb,
  p_fee_installment_count integer default 1,
  p_interest_amount numeric default 0,
  p_interest_category_id uuid default null,
  p_interest_splits jsonb default '[]'::jsonb,
  p_interest_installment_count integer default 1,
  p_notes text default null,
  p_request_key text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  caller public.household_members;
  existing uuid;
  principal_tx uuid;
  principal_invoice uuid;
  fee_tx uuid;
  fee_invoice uuid;
  interest_tx uuid;
  interest_invoice uuid;
  op constant text:='create_card_pix_expense';
begin
  caller:=public.require_active_member(p_household_id);
  if p_request_key is null or length(trim(p_request_key))=0 then raise exception 'request key is required' using errcode='22023'; end if;
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then return existing; end if;

  if p_principal_amount<=0 then raise exception 'positive principal amount required' using errcode='22023'; end if;
  if p_fee_amount<0 or p_interest_amount<0 then raise exception 'fee and interest cannot be negative' using errcode='22023'; end if;
  if p_principal_installment_count<1 or p_fee_installment_count<1 or p_interest_installment_count<1 then raise exception 'installment counts must be positive' using errcode='22023'; end if;
  if not exists(select 1 from public.cards where id=p_card_id and household_id=p_household_id and deactivated_at is null) then raise exception 'active household card required' using errcode='23514'; end if;
  if p_fee_amount>0 and p_fee_category_id is null then raise exception 'fee category is required when fee exists' using errcode='22023'; end if;
  if p_interest_amount>0 and p_interest_category_id is null then raise exception 'interest category is required when interest exists' using errcode='22023'; end if;
  if p_fee_amount=0 and (p_fee_category_id is not null or jsonb_array_length(coalesce(p_fee_splits,'[]'::jsonb))>0) then raise exception 'fee details require a positive fee' using errcode='22023'; end if;
  if p_interest_amount=0 and (p_interest_category_id is not null or jsonb_array_length(coalesce(p_interest_splits,'[]'::jsonb))>0) then raise exception 'interest details require positive interest' using errcode='22023'; end if;

  principal_tx:=public.create_financial_transaction(
    p_household_id,'expense',trim(p_description),p_principal_amount,p_transaction_date,p_category_id,
    p_buyer_member_id,'card',null,p_card_id,coalesce(p_principal_splits,'[]'::jsonb),p_principal_installment_count,p_notes
  );
  select invoice_id into principal_invoice from public.transactions where id=principal_tx;
  insert into public.transaction_components(household_id,transaction_id,kind,amount)
  values(p_household_id,principal_tx,'principal',p_principal_amount);
  insert into public.financing_allocations(household_id,transaction_id,mechanism,component_kind,amount,card_id,invoice_id)
  values(p_household_id,principal_tx,'card_pix','principal',p_principal_amount,p_card_id,principal_invoice);

  if p_fee_amount>0 then
    fee_tx:=public.create_financial_transaction(
      p_household_id,'expense','Taxa PIX no cartão — '||trim(p_description),p_fee_amount,p_transaction_date,p_fee_category_id,
      p_buyer_member_id,'card',null,p_card_id,coalesce(p_fee_splits,'[]'::jsonb),p_fee_installment_count,p_notes
    );
    select invoice_id into fee_invoice from public.transactions where id=fee_tx;
    insert into public.transaction_components(household_id,transaction_id,kind,amount) values(p_household_id,fee_tx,'fee',p_fee_amount);
    insert into public.transaction_links(household_id,source_transaction_id,related_transaction_id,kind,amount) values(p_household_id,principal_tx,fee_tx,'fee',p_fee_amount);
    insert into public.financing_allocations(household_id,transaction_id,mechanism,component_kind,amount,card_id,invoice_id)
    values(p_household_id,fee_tx,'card_pix','fee',p_fee_amount,p_card_id,fee_invoice);
  end if;

  if p_interest_amount>0 then
    interest_tx:=public.create_financial_transaction(
      p_household_id,'expense','Juros PIX no cartão — '||trim(p_description),p_interest_amount,p_transaction_date,p_interest_category_id,
      p_buyer_member_id,'card',null,p_card_id,coalesce(p_interest_splits,'[]'::jsonb),p_interest_installment_count,p_notes
    );
    select invoice_id into interest_invoice from public.transactions where id=interest_tx;
    insert into public.transaction_components(household_id,transaction_id,kind,amount) values(p_household_id,interest_tx,'interest',p_interest_amount);
    insert into public.transaction_links(household_id,source_transaction_id,related_transaction_id,kind,amount) values(p_household_id,principal_tx,interest_tx,'interest',p_interest_amount);
    insert into public.financing_allocations(household_id,transaction_id,mechanism,component_kind,amount,card_id,invoice_id)
    values(p_household_id,interest_tx,'card_pix','interest',p_interest_amount,p_card_id,interest_invoice);
  end if;

  perform public.financial_command_store(p_household_id,op,p_request_key,principal_tx);
  return principal_tx;
end $$;

revoke all on function public.create_card_pix_expense(uuid,text,numeric,date,uuid,uuid,uuid,jsonb,integer,numeric,uuid,jsonb,integer,numeric,uuid,jsonb,integer,text,text) from public,anon;
grant execute on function public.create_card_pix_expense(uuid,text,numeric,date,uuid,uuid,uuid,jsonb,integer,numeric,uuid,jsonb,integer,numeric,uuid,jsonb,integer,text,text) to authenticated;

comment on function public.create_card_pix_expense(uuid,text,numeric,date,uuid,uuid,uuid,jsonb,integer,numeric,uuid,jsonb,integer,numeric,uuid,jsonb,integer,text,text) is
  'Creates one principal expense financed through card_pix. Optional fee and interest are separate economic expense transactions with explicit categories, responsibility splits and installment counts. No cash movement occurs at creation; later invoice payment realizes funding/cash without duplicating expense.';
