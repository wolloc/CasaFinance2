-- Fix historical card opening deletion: invoice_id on the source transaction is intentionally null.
-- The card instrument + installment plan identify the historical card purchase.
create or replace function public.delete_opening_card_purchase(
  p_household_id uuid,
  p_transaction_id uuid,
  p_reason text,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  tx public.transactions;
  plan_id uuid;
  event_id uuid;
begin
  perform public.require_active_member(p_household_id);

  if length(trim(coalesce(p_reason,'')))=0 or length(trim(coalesce(p_request_key,'')))=0 then
    raise exception 'delete reason and request key are required' using errcode='22023';
  end if;

  event_id:=public.financial_command_existing_or_lock(
    p_household_id,'delete_opening_card_purchase',trim(p_request_key)
  );
  if event_id is not null then return event_id; end if;

  select * into tx
    from public.transactions
   where id=p_transaction_id
     and household_id=p_household_id
     and type='expense'
     and deleted_at is null
   for update;

  if tx.id is null then
    raise exception 'active expense required' using errcode='23514';
  end if;

  if tx.notes is distinct from 'Compra anterior ao início do controle' then
    raise exception 'only opening card purchases can be deleted from history' using errcode='23514';
  end if;

  if not exists(
    select 1 from public.transaction_payment_instruments tpi
     where tpi.transaction_id=tx.id
       and tpi.household_id=p_household_id
       and tpi.kind='card'
       and tpi.card_id is not null
  ) then
    raise exception 'opening card purchase instrument is required' using errcode='23514';
  end if;

  select ip.id into plan_id
    from public.installment_plans ip
   where ip.household_id=p_household_id
     and ip.purchase_transaction_id=tx.id
   for update;

  if plan_id is null then
    raise exception 'historical single purchase deletion requires a dedicated opening adjustment route' using errcode='0A000';
  end if;

  if exists(select 1 from public.funding_events f where f.financed_transaction_id=tx.id) then
    raise exception 'opening purchase with realized funding cannot be deleted from history' using errcode='23514';
  end if;

  update public.member_settlement_events
     set state='cancelled', updated_at=now()
   where source_transaction_id=tx.id
     and state='projected';

  with removed as (
    select i.invoice_id,
           sum(i.amount)::numeric as amount,
           sum(least(i.amount,greatest(i.opening_settled_amount,0)))::numeric as opening_amount
      from public.installments i
     where i.household_id=p_household_id
       and i.installment_plan_id=plan_id
     group by i.invoice_id
  )
  update public.card_invoices ci
     set total_amount=greatest(ci.total_amount-r.amount,0),
         opening_settled_amount=greatest(ci.opening_settled_amount-r.opening_amount,0),
         status=case
           when greatest(ci.total_amount-r.amount,0)<=0 then 'cancelled'::public.invoice_state
           when coalesce(ci.settled_amount,0)+greatest(ci.opening_settled_amount-r.opening_amount,0)+coalesce(ci.financed_balance,0)>=greatest(ci.total_amount-r.amount,0) then 'paid'::public.invoice_state
           else 'open'::public.invoice_state
         end,
         settled_at=case
           when greatest(ci.total_amount-r.amount,0)>0
            and coalesce(ci.settled_amount,0)+greatest(ci.opening_settled_amount-r.opening_amount,0)+coalesce(ci.financed_balance,0)>=greatest(ci.total_amount-r.amount,0)
           then ci.settled_at
           else null
         end,
         updated_at=now()
    from removed r
   where ci.id=r.invoice_id
     and ci.household_id=p_household_id
     and ci.deleted_at is null;

  update public.installments
     set status='cancelled'::public.installment_state
   where household_id=p_household_id
     and installment_plan_id=plan_id
     and status<>'cancelled'::public.installment_state;

  update public.transactions
     set deleted_at=now(), updated_at=now()
   where id=tx.id and household_id=p_household_id;

  perform public.financial_command_store(
    p_household_id,'delete_opening_card_purchase',trim(p_request_key),tx.id
  );

  return tx.id;
end
$$;

revoke all on function public.delete_opening_card_purchase(uuid,uuid,text,text) from public,anon;
grant execute on function public.delete_opening_card_purchase(uuid,uuid,text,text) to authenticated;
