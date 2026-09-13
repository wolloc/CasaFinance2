-- PR E: forward-only repair for canonical obligation settlement.
-- Keep the existing command contract and financial effects; make the enum assignment explicit.

create or replace function public.settle_financial_obligation(p_household_id uuid,p_obligation_id uuid,p_account_id uuid,p_amount numeric,p_occurred_at timestamptz default now(),p_funder_member_id uuid default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; obligation public.financial_obligations; settled numeric; movement_id uuid; event_id uuid; payment_tx uuid;
begin
  caller:=public.require_active_member(p_household_id);
  select * into obligation from public.financial_obligations where id=p_obligation_id and household_id=p_household_id for update;
  select coalesce(sum(amount),0) into settled from public.obligation_events where obligation_id=p_obligation_id and kind in ('receipt','payment','cancellation','write_off');
  if obligation.id is null or obligation.state in ('settled','cancelled','written_off') or p_amount<=0 or settled+p_amount>obligation.original_amount then raise exception 'invalid obligation settlement' using errcode='23514'; end if;
  if not exists(select 1 from public.accounts where id=p_account_id and household_id=p_household_id and deactivated_at is null) then raise exception 'active household account required' using errcode='23514'; end if;
  insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,source_account_id,destination_account_id,counterparty_id,obligation_id,movement_date,competence_date,notes,realized_at)
  values(p_household_id,caller.id,case when obligation.kind='receivable' then 'receivable_collection'::public.money_movement_kind else 'payable_payment'::public.money_movement_kind end,'realized',p_amount,obligation.description,case when obligation.kind='payable' then p_account_id end,case when obligation.kind='receivable' then p_account_id end,obligation.counterparty_id,obligation.id,p_occurred_at::date,date_trunc('month',p_occurred_at)::date,p_notes,p_occurred_at) returning id into movement_id;
  insert into public.obligation_events(household_id,obligation_id,created_by_member_id,kind,amount,movement_id,occurred_at,notes) values(p_household_id,obligation.id,caller.id,case when obligation.kind='receivable' then 'receipt'::public.obligation_event_kind else 'payment'::public.obligation_event_kind end,p_amount,movement_id,p_occurred_at,p_notes) returning id into event_id;
  if obligation.kind='payable' and obligation.source_transaction_id is not null and p_funder_member_id is not null then
    if not exists(select 1 from public.household_members where id=p_funder_member_id and household_id=p_household_id and deactivated_at is null) then raise exception 'funder must be active in household' using errcode='23514'; end if;
    insert into public.transactions(household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at) values(p_household_id,caller.id,'adjustment','paid','realized','Liquidação de obrigação',p_amount,p_amount,p_amount,p_amount,p_occurred_at::date,date_trunc('month',p_occurred_at)::date,p_occurred_at) returning id into payment_tx;
    insert into public.funding_events(household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,amount,funded_at) values(p_household_id,obligation.source_transaction_id,payment_tx,p_funder_member_id,p_account_id,p_amount,p_occurred_at);
  end if;
  update public.financial_obligations set state=case when settled+p_amount=original_amount then 'settled'::public.obligation_state else 'partially_settled'::public.obligation_state end,closed_at=case when settled+p_amount=original_amount then p_occurred_at else null end,updated_at=now() where id=obligation.id;
  return event_id;
end $$;

revoke all on function public.settle_financial_obligation(uuid,uuid,uuid,numeric,timestamptz,uuid,text) from public,anon;
grant execute on function public.settle_financial_obligation(uuid,uuid,uuid,numeric,timestamptz,uuid,text) to authenticated;
