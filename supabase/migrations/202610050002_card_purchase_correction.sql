create or replace function public.correct_unrealized_card_purchase(
  p_household_id uuid,p_transaction_id uuid,p_description text,p_amount numeric,p_category_id uuid,p_reason text,p_request_key text
) returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare tx public.transactions; plan_id uuid; event_id uuid; cents bigint; count_parts integer; base_cents bigint; remainder integer; part_cents bigint; idx integer:=0; ins record; new_amount numeric;
begin
  perform public.require_active_member(p_household_id);
  if length(trim(coalesce(p_description,'')))=0 or p_amount<=0 or length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0 then raise exception 'invalid card purchase correction command' using errcode='22023'; end if;
  event_id:=public.financial_command_existing_or_lock(p_household_id,'correct_unrealized_card_purchase',trim(p_request_key)); if event_id is not null then return event_id; end if;
  select * into tx from public.transactions where id=p_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null for update;
  if tx.id is null then raise exception 'active expense required' using errcode='23514'; end if;
  if not exists(select 1 from public.transaction_payment_instruments tpi where tpi.transaction_id=tx.id and tpi.household_id=p_household_id and tpi.kind='card' and tpi.card_id is not null) then raise exception 'card purchase instrument is required' using errcode='23514'; end if;
  if tx.status in ('paid','received','cancelled','refunded') or tx.realized_amount<>0 then raise exception 'settled or closed card purchase requires a reversal flow' using errcode='0A000'; end if;
  if exists(select 1 from public.funding_events f where f.household_id=p_household_id and f.financed_transaction_id=tx.id)
     or exists(select 1 from public.external_payment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations o where o.household_id=p_household_id and o.source_transaction_id=tx.id)
  then raise exception 'card purchase has linked financial facts and cannot be corrected directly' using errcode='0A000'; end if;
  select ip.id into plan_id from public.installment_plans ip where ip.household_id=p_household_id and ip.purchase_transaction_id=tx.id for update;
  if plan_id is not null then
    if exists(select 1 from public.installments i where i.household_id=p_household_id and i.installment_plan_id=plan_id and (i.status in ('paid','refunded') or i.settled_at is not null or coalesce(i.opening_settled_amount,0)>0)) then raise exception 'card purchase has settled installments and requires a reversal flow' using errcode='0A000'; end if;
    select count(*) into count_parts from public.installments where household_id=p_household_id and installment_plan_id=plan_id and status<>'cancelled'::public.installment_state;
    if count_parts<1 then raise exception 'active installments required' using errcode='23514'; end if;
    cents:=round(p_amount*100); base_cents:=cents/count_parts; remainder:=(cents%count_parts)::integer;
    for ins in select id,invoice_id,number,amount from public.installments where household_id=p_household_id and installment_plan_id=plan_id and status<>'cancelled'::public.installment_state order by number for update loop
      idx:=idx+1; part_cents:=base_cents+case when idx<=remainder then 1 else 0 end; new_amount:=part_cents/100.0;
      update public.installments set amount=new_amount,updated_at=now() where id=ins.id;
      update public.card_invoices set total_amount=greatest(total_amount-ins.amount+new_amount,0),status=case when greatest(total_amount-ins.amount+new_amount,0)<=0 then 'cancelled'::public.invoice_state else 'open'::public.invoice_state end,settled_at=case when greatest(total_amount-ins.amount+new_amount,0)>0 then null else settled_at end,updated_at=now() where id=ins.invoice_id and household_id=p_household_id and deleted_at is null;
    end loop;
    update public.installment_plans set total_amount=p_amount where id=plan_id and household_id=p_household_id;
  elsif tx.invoice_id is not null then
    if exists(select 1 from public.card_invoices ci where ci.id=tx.invoice_id and ci.household_id=p_household_id and (ci.status='paid'::public.invoice_state or coalesce(ci.settled_amount,0)>0 or coalesce(ci.financed_balance,0)>0)) then raise exception 'card purchase invoice is already settled and requires a reversal flow' using errcode='0A000'; end if;
    update public.card_invoices set total_amount=greatest(total_amount-tx.amount+p_amount,0),updated_at=now() where id=tx.invoice_id and household_id=p_household_id and deleted_at is null;
  else raise exception 'card purchase has no invoice or installment plan' using errcode='23514'; end if;
  insert into public.transaction_adjustment_events(household_id,source_transaction_id,kind,before_payload,after_payload,reason,request_key)
  values(p_household_id,tx.id,'correction',jsonb_build_object('description',tx.description,'amount',tx.amount,'category_id',tx.category_id),jsonb_build_object('description',trim(p_description),'amount',p_amount,'category_id',p_category_id),trim(p_reason),trim(p_request_key));
  update public.transactions set description=trim(p_description),amount=p_amount,estimated_amount=case when tx.economic_state='forecast' then p_amount else estimated_amount end,confirmed_amount=case when tx.economic_state='confirmed' then p_amount else confirmed_amount end,category_id=p_category_id,updated_at=now() where id=tx.id and household_id=p_household_id;
  if exists(select 1 from public.economic_allocations a where a.household_id=p_household_id and a.transaction_id=tx.id) then perform public.rescale_economic_allocations(tx.id,p_amount); end if;
  perform public.financial_command_store(p_household_id,'correct_unrealized_card_purchase',trim(p_request_key),tx.id);
  return tx.id;
end $$;
revoke all on function public.correct_unrealized_card_purchase(uuid,uuid,text,numeric,uuid,text,text) from public,anon;
grant execute on function public.correct_unrealized_card_purchase(uuid,uuid,text,numeric,uuid,text,text) to authenticated;
