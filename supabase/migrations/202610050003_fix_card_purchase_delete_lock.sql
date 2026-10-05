create or replace function public.delete_card_purchase(
  p_household_id uuid,p_transaction_id uuid,p_reason text,p_request_key text
) returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $$
declare tx public.transactions; plan_id uuid; event_id uuid; inv record;
begin
  perform public.require_active_member(p_household_id);
  if length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0 then raise exception 'delete reason and request key are required' using errcode='22023'; end if;
  event_id:=public.financial_command_existing_or_lock(p_household_id,'delete_card_purchase',trim(p_request_key)); if event_id is not null then return event_id; end if;
  select * into tx from public.transactions where id=p_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null for update;
  if tx.id is null then raise exception 'active expense required' using errcode='23514'; end if;
  if not exists(select 1 from public.transaction_payment_instruments tpi where tpi.transaction_id=tx.id and tpi.household_id=p_household_id and tpi.kind='card' and tpi.card_id is not null) then raise exception 'card purchase instrument is required' using errcode='23514'; end if;
  if tx.status in ('paid','received','cancelled','refunded') or tx.realized_amount<>0 then raise exception 'settled or closed card purchase requires a reversal flow' using errcode='0A000'; end if;
  if exists(select 1 from public.funding_events f where f.household_id=p_household_id and f.financed_transaction_id=tx.id) or exists(select 1 from public.external_payment_events e where e.household_id=p_household_id and e.source_transaction_id=tx.id) or exists(select 1 from public.financial_obligations o where o.household_id=p_household_id and o.source_transaction_id=tx.id) then raise exception 'card purchase has linked financial facts and cannot be deleted directly' using errcode='0A000'; end if;
  select ip.id into plan_id from public.installment_plans ip where ip.household_id=p_household_id and ip.purchase_transaction_id=tx.id for update;
  if plan_id is not null then
    if exists(select 1 from public.installments i where i.household_id=p_household_id and i.installment_plan_id=plan_id and (i.status in ('paid','refunded') or i.settled_at is not null or coalesce(i.opening_settled_amount,0)>0)) then raise exception 'card purchase has settled installments and requires a reversal flow' using errcode='0A000'; end if;
    for inv in select i.invoice_id,sum(i.amount)::numeric as amount from public.installments i where i.household_id=p_household_id and i.installment_plan_id=plan_id and i.status<>'cancelled'::public.installment_state group by i.invoice_id loop
      update public.card_invoices ci set total_amount=greatest(ci.total_amount-inv.amount,0),status=case when greatest(ci.total_amount-inv.amount,0)<=0 then 'cancelled'::public.invoice_state when coalesce(ci.settled_amount,0)+coalesce(ci.financed_balance,0)>=greatest(ci.total_amount-inv.amount,0) then 'paid'::public.invoice_state else 'open'::public.invoice_state end,settled_at=case when greatest(ci.total_amount-inv.amount,0)>0 and coalesce(ci.settled_amount,0)+coalesce(ci.financed_balance,0)>=greatest(ci.total_amount-inv.amount,0) then ci.settled_at else null end,updated_at=now() where ci.id=inv.invoice_id and ci.household_id=p_household_id and ci.deleted_at is null;
    end loop;
    update public.installments set status='cancelled'::public.installment_state,settled_at=null,updated_at=now() where household_id=p_household_id and installment_plan_id=plan_id and status<>'cancelled'::public.installment_state;
  elsif tx.invoice_id is not null then
    if exists(select 1 from public.card_invoices ci where ci.id=tx.invoice_id and ci.household_id=p_household_id and (ci.status='paid'::public.invoice_state or coalesce(ci.settled_amount,0)>0 or coalesce(ci.financed_balance,0)>0)) then raise exception 'card purchase invoice is already settled and requires a reversal flow' using errcode='0A000'; end if;
    update public.card_invoices set total_amount=greatest(total_amount-tx.amount,0),status=case when greatest(total_amount-tx.amount,0)<=0 then 'cancelled'::public.invoice_state else status end,updated_at=now() where id=tx.invoice_id and household_id=p_household_id and deleted_at is null;
  else raise exception 'card purchase has no invoice or installment plan' using errcode='23514'; end if;
  update public.member_settlement_events set state='cancelled',updated_at=now() where source_transaction_id=tx.id and state='projected';
  insert into public.transaction_adjustment_events(household_id,source_transaction_id,kind,before_payload,after_payload,reason,request_key) values(p_household_id,tx.id,'cancellation',jsonb_build_object('economic_state',tx.economic_state,'status',tx.status,'amount',tx.amount),jsonb_build_object('economic_state','cancelled','status','cancelled'),trim(p_reason),trim(p_request_key));
  update public.transactions set economic_state='cancelled',status='cancelled',deleted_at=now(),settled_at=null,updated_at=now() where id=tx.id and household_id=p_household_id;
  perform public.financial_command_store(p_household_id,'delete_card_purchase',trim(p_request_key),tx.id);
  return tx.id;
end $$;
