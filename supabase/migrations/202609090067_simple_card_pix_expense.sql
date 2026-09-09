-- Simplified product-facing PIX-by-card command.
-- Keeps migration 066 intact while exposing the UX contract decided for Nova Despesa:
-- principal + one financial-charge amount, one card route and one installment route.
-- The caller sends explicit responsibility allocations for both economic facts.

create or replace function public.create_simple_card_pix_expense(
  p_household_id uuid,
  p_description text,
  p_principal_amount numeric,
  p_financial_charge_amount numeric,
  p_transaction_date date,
  p_category_id uuid,
  p_buyer_member_id uuid,
  p_card_id uuid,
  p_principal_splits jsonb,
  p_charge_splits jsonb,
  p_installment_count integer default 1,
  p_notes text default null,
  p_request_key text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  caller public.household_members;
  existing uuid;
  principal_tx uuid;
  principal_invoice uuid;
  charge_tx uuid;
  charge_invoice uuid;
  op constant text:='create_simple_card_pix_expense';
begin
  caller:=public.require_active_member(p_household_id);
  if p_request_key is null or length(trim(p_request_key))=0 then raise exception 'request key is required' using errcode='22023'; end if;
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then return existing; end if;

  if p_principal_amount<=0 then raise exception 'positive principal amount required' using errcode='22023'; end if;
  if p_financial_charge_amount<0 then raise exception 'financial charge cannot be negative' using errcode='22023'; end if;
  if p_installment_count<1 then raise exception 'installment count must be positive' using errcode='22023'; end if;
  if not exists(select 1 from public.cards where id=p_card_id and household_id=p_household_id and deactivated_at is null) then raise exception 'active household card required' using errcode='23514'; end if;

  principal_tx:=public.create_financial_transaction(
    p_household_id,'expense',trim(p_description),p_principal_amount,p_transaction_date,p_category_id,
    p_buyer_member_id,'card',null,p_card_id,coalesce(p_principal_splits,'[]'::jsonb),p_installment_count,p_notes
  );
  select invoice_id into principal_invoice from public.transactions where id=principal_tx;
  insert into public.transaction_components(household_id,transaction_id,kind,amount)
  values(p_household_id,principal_tx,'principal',p_principal_amount);
  insert into public.financing_allocations(household_id,transaction_id,mechanism,component_kind,amount,card_id,invoice_id)
  values(p_household_id,principal_tx,'card_pix','principal',p_principal_amount,p_card_id,principal_invoice);

  if p_financial_charge_amount>0 then
    charge_tx:=public.create_financial_transaction(
      p_household_id,'expense','Encargos financeiros PIX no cartão — '||trim(p_description),p_financial_charge_amount,p_transaction_date,null,
      p_buyer_member_id,'card',null,p_card_id,coalesce(p_charge_splits,'[]'::jsonb),p_installment_count,p_notes
    );
    select invoice_id into charge_invoice from public.transactions where id=charge_tx;
    -- `fee` is the existing canonical technical component used by the current card-PIX engine
    -- for non-principal charges. The user-facing concept remains "encargos financeiros".
    insert into public.transaction_components(household_id,transaction_id,kind,amount)
    values(p_household_id,charge_tx,'fee',p_financial_charge_amount);
    insert into public.transaction_links(household_id,source_transaction_id,related_transaction_id,kind,amount)
    values(p_household_id,principal_tx,charge_tx,'fee',p_financial_charge_amount);
    insert into public.financing_allocations(household_id,transaction_id,mechanism,component_kind,amount,card_id,invoice_id)
    values(p_household_id,charge_tx,'card_pix','fee',p_financial_charge_amount,p_card_id,charge_invoice);
  end if;

  perform public.financial_command_store(p_household_id,op,p_request_key,principal_tx);
  return principal_tx;
end $$;

revoke all on function public.create_simple_card_pix_expense(uuid,text,numeric,numeric,date,uuid,uuid,uuid,jsonb,jsonb,integer,text,text) from public,anon;
grant execute on function public.create_simple_card_pix_expense(uuid,text,numeric,numeric,date,uuid,uuid,uuid,jsonb,jsonb,integer,text,text) to authenticated;

comment on function public.create_simple_card_pix_expense(uuid,text,numeric,numeric,date,uuid,uuid,uuid,jsonb,jsonb,integer,text,text) is
  'Creates one principal expense financed through card_pix plus, when informed, one linked financial-charge expense. Both use explicit responsibility allocations and the same card/installment route. No Casa cash movement occurs at creation.';
