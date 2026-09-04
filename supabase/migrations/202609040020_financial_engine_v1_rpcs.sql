-- Etapa 10C: comandos atomicos do Motor Financeiro v1.

create or replace function public.create_financial_party(p_household_id uuid,p_name text,p_kind public.financial_party_kind default 'person',p_tax_id text default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; result uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if length(trim(coalesce(p_name,'')))=0 then raise exception 'party name is required' using errcode='22023'; end if;
  insert into public.financial_parties(household_id,kind,name,tax_id,notes,created_by_member_id) values(p_household_id,p_kind,trim(p_name),nullif(trim(p_tax_id),''),p_notes,caller.id) returning id into result;
  return result;
end $$;

create or replace function public.set_account_ownerships(p_household_id uuid,p_account_id uuid,p_member_ids uuid[])
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; member_id uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if not exists(select 1 from public.accounts where id=p_account_id and household_id=p_household_id and deactivated_at is null) then raise exception 'active household account required' using errcode='23514'; end if;
  if cardinality(p_member_ids) not between 1 and 2 or cardinality(p_member_ids)<>(select count(distinct x) from unnest(p_member_ids) x) then raise exception 'one or two distinct owners required' using errcode='22023'; end if;
  foreach member_id in array p_member_ids loop
    if not exists(select 1 from public.household_members where id=member_id and household_id=p_household_id and deactivated_at is null) then raise exception 'owner must be active in household' using errcode='23514'; end if;
  end loop;
  delete from public.account_ownerships where account_id=p_account_id and household_id=p_household_id;
  insert into public.account_ownerships(account_id,household_id,member_id) select p_account_id,p_household_id,x from unnest(p_member_ids) x;
end $$;

create or replace function public.record_account_opening_position(p_household_id uuid,p_account_id uuid,p_amount numeric,p_effective_date date,p_description text default 'Posição inicial')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; result uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if not exists(select 1 from public.accounts where id=p_account_id and household_id=p_household_id and deactivated_at is null) then raise exception 'active household account required' using errcode='23514'; end if;
  insert into public.account_balance_events(household_id,account_id,created_by_member_id,kind,amount,effective_date,description) values(p_household_id,p_account_id,caller.id,'opening',p_amount,p_effective_date,trim(p_description)) returning id into result;
  return result;
end $$;

-- Internal largest-remainder allocator. Percentages remain authoritative and
-- the last cent is assigned deterministically by fractional remainder + input order.
create or replace function public.rescale_economic_allocations(p_transaction_id uuid,p_new_amount numeric)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_new_amount<=0 then raise exception 'positive allocation total required' using errcode='22023'; end if;
  if not exists(select 1 from public.economic_allocations where transaction_id=p_transaction_id) then return; end if;
  if (select sum(percentage) from public.economic_allocations where transaction_id=p_transaction_id)<>100 then raise exception 'allocation percentages must total 100' using errcode='23514'; end if;
  with calculated as (
    select id,floor(round(p_new_amount*100)*percentage/100)::bigint base_cents,
           row_number() over(order by (round(p_new_amount*100)*percentage/100)-floor(round(p_new_amount*100)*percentage/100) desc,allocation_order) priority
    from public.economic_allocations where transaction_id=p_transaction_id
  ), totals as (
    select round(p_new_amount*100)::bigint target_cents,sum(base_cents)::bigint base_total from calculated
  ), final as (
    select c.id,(c.base_cents+case when c.priority<=t.target_cents-t.base_total then 1 else 0 end)::numeric/100 amount from calculated c cross join totals t
  ) update public.economic_allocations a set amount=f.amount from final f where a.id=f.id;
  update public.transaction_splits s set amount=a.amount from public.economic_allocations a
   where s.transaction_id=p_transaction_id and a.transaction_id=s.transaction_id and a.responsible_member_id=s.responsible_member_id;
end $$;
revoke all on function public.rescale_economic_allocations(uuid,numeric) from public,anon,authenticated;

create or replace function public.confirm_financial_transaction(p_household_id uuid,p_transaction_id uuid,p_confirmed_amount numeric)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; tx public.transactions;
begin
  caller:=public.require_active_member(p_household_id);
  select * into tx from public.transactions where id=p_transaction_id and household_id=p_household_id and deleted_at is null for update;
  if tx.id is null or tx.economic_state in ('cancelled','reversed') or p_confirmed_amount<=0 then raise exception 'transaction cannot be confirmed' using errcode='23514'; end if;
  perform public.rescale_economic_allocations(tx.id,p_confirmed_amount);
  update public.transactions set amount=p_confirmed_amount,confirmed_amount=p_confirmed_amount,economic_state='confirmed',updated_at=now() where id=tx.id;
  update public.recurring_occurrences set confirmed_amount=p_confirmed_amount,confirmed_at=now() where transaction_id=tx.id;
  return tx.id;
end $$;

create or replace function public.settle_direct_expense(p_household_id uuid,p_transaction_id uuid,p_source_account_id uuid,p_funder_member_id uuid,p_amount numeric,p_paid_at timestamptz default now())
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; tx public.transactions; payment_tx uuid; movement_id uuid; already numeric;
begin
  caller:=public.require_active_member(p_household_id);
  select * into tx from public.transactions where id=p_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null for update;
  if tx.id is null or tx.economic_state in ('cancelled','reversed') or p_amount<=0 then raise exception 'active expense and positive amount required' using errcode='23514'; end if;
  if not exists(select 1 from public.accounts where id=p_source_account_id and household_id=p_household_id and deactivated_at is null) or not exists(select 1 from public.household_members where id=p_funder_member_id and household_id=p_household_id and deactivated_at is null) then raise exception 'source account and funder must belong to household' using errcode='23514'; end if;
  select coalesce(sum(amount),0) into already from public.funding_events where financed_transaction_id=tx.id and invoice_id is null;
  if already+p_amount>tx.amount then raise exception 'expense funding exceeds economic amount' using errcode='23514'; end if;
  insert into public.transactions(household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at)
  values(p_household_id,caller.id,'adjustment','paid','realized','Liquidação: '||tx.description,p_amount,p_amount,p_amount,p_amount,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at) returning id into payment_tx;
  insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,source_account_id,related_transaction_id,movement_date,competence_date,realized_at)
  values(p_household_id,caller.id,'expense_payment','realized',p_amount,tx.description,p_source_account_id,tx.id,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at) returning id into movement_id;
  insert into public.funding_events(household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,amount,funded_at) values(p_household_id,tx.id,payment_tx,p_funder_member_id,p_source_account_id,p_amount,p_paid_at);
  update public.transactions set realized_amount=already+p_amount,economic_state='realized',status=case when already+p_amount=amount then 'paid' else 'pending' end,settled_at=case when already+p_amount=amount then p_paid_at else null end,updated_at=now() where id=tx.id;
  return movement_id;
end $$;

create or replace function public.settle_income(p_household_id uuid,p_transaction_id uuid,p_destination_account_id uuid,p_beneficiary_member_id uuid,p_amount numeric,p_received_at timestamptz default now())
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; tx public.transactions; movement_id uuid;
begin
  caller:=public.require_active_member(p_household_id);
  select * into tx from public.transactions where id=p_transaction_id and household_id=p_household_id and type='income' and deleted_at is null for update;
  if tx.id is null or tx.economic_state in ('cancelled','reversed') or p_amount<=0 or tx.realized_amount+p_amount>coalesce(tx.confirmed_amount,tx.amount) then raise exception 'invalid income settlement' using errcode='23514'; end if;
  if not exists(select 1 from public.accounts where id=p_destination_account_id and household_id=p_household_id and deactivated_at is null) or not exists(select 1 from public.household_members where id=p_beneficiary_member_id and household_id=p_household_id and deactivated_at is null) then raise exception 'destination and beneficiary must belong to household' using errcode='23514'; end if;
  insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,beneficiary_member_id,destination_account_id,category_id,related_transaction_id,movement_date,competence_date,realized_at)
  values(p_household_id,caller.id,'income','realized',p_amount,tx.description,p_beneficiary_member_id,p_destination_account_id,tx.category_id,tx.id,p_received_at::date,date_trunc('month',p_received_at)::date,p_received_at) returning id into movement_id;
  update public.transactions set realized_amount=realized_amount+p_amount,economic_state=case when realized_amount+p_amount=coalesce(confirmed_amount,amount) then 'realized' else 'confirmed' end,status=case when realized_amount+p_amount=coalesce(confirmed_amount,amount) then 'received' else 'pending' end,settled_at=case when realized_amount+p_amount=coalesce(confirmed_amount,amount) then p_received_at else null end,updated_at=now() where id=tx.id;
  return movement_id;
end $$;

create or replace function public.create_financial_obligation(p_household_id uuid,p_kind public.obligation_kind,p_origin_kind public.obligation_origin_kind,p_counterparty_id uuid,p_original_amount numeric,p_obligation_date date,p_due_date date,p_description text,p_source_transaction_id uuid default null,p_invoice_id uuid default null,p_disbursement_account_id uuid default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; result uuid; movement_id uuid;
begin
  caller:=public.require_active_member(p_household_id);
  if p_original_amount<=0 or (p_due_date is not null and p_due_date<p_obligation_date) then raise exception 'invalid obligation amount or dates' using errcode='22023'; end if;
  insert into public.financial_obligations(household_id,created_by_member_id,kind,origin_kind,counterparty_id,source_transaction_id,invoice_id,original_amount,obligation_date,due_date,description,notes)
  values(p_household_id,caller.id,p_kind,p_origin_kind,p_counterparty_id,p_source_transaction_id,p_invoice_id,p_original_amount,p_obligation_date,p_due_date,trim(p_description),p_notes) returning id into result;
  if p_disbursement_account_id is not null then
    if p_kind<>'receivable' or not exists(select 1 from public.accounts where id=p_disbursement_account_id and household_id=p_household_id and deactivated_at is null) then raise exception 'only a receivable can be disbursed from a household account' using errcode='23514'; end if;
    insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,source_account_id,counterparty_id,obligation_id,movement_date,competence_date,realized_at)
    values(p_household_id,caller.id,'receivable_disbursement','realized',p_original_amount,p_description,p_disbursement_account_id,p_counterparty_id,result,p_obligation_date,date_trunc('month',p_obligation_date)::date,p_obligation_date::timestamptz) returning id into movement_id;
  end if;
  return result;
end $$;

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
  update public.financial_obligations set state=case when settled+p_amount=original_amount then 'settled' else 'partially_settled' end,closed_at=case when settled+p_amount=original_amount then p_occurred_at else null end,updated_at=now() where id=obligation.id;
  return event_id;
end $$;

create or replace function public.write_off_receivable(p_household_id uuid,p_obligation_id uuid,p_amount numeric,p_loss_date date,p_splits jsonb,p_category_id uuid default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; obligation public.financial_obligations; settled numeric; loss_tx uuid; event_id uuid; split jsonb; split_sum numeric:=0; pct_sum numeric:=0; allocation_order integer:=0;
begin
  caller:=public.require_active_member(p_household_id);
  select * into obligation from public.financial_obligations where id=p_obligation_id and household_id=p_household_id and kind='receivable' for update;
  select coalesce(sum(amount),0) into settled from public.obligation_events where obligation_id=p_obligation_id and kind in ('receipt','cancellation','write_off');
  if obligation.id is null or obligation.state in ('settled','cancelled','written_off') or p_amount<=0 or settled+p_amount>obligation.original_amount then raise exception 'invalid receivable write-off' using errcode='23514'; end if;
  insert into public.transactions(household_id,created_by_member_id,category_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at,notes)
  values(p_household_id,caller.id,p_category_id,'expense','paid','realized','Perda: '||obligation.description,p_amount,p_amount,p_amount,p_amount,p_loss_date,date_trunc('month',p_loss_date)::date,p_loss_date::timestamptz,p_notes) returning id into loss_tx;
  insert into public.transaction_components(household_id,transaction_id,kind,amount) values(p_household_id,loss_tx,'loss',p_amount);
  if jsonb_array_length(coalesce(p_splits,'[]'))=0 then raise exception 'loss requires explicit economic allocations' using errcode='23514'; end if;
  for split in select * from jsonb_array_elements(p_splits) loop
    allocation_order:=allocation_order+1;
    if (split ? 'member_id') = (split ? 'party_id') then raise exception 'each loss split requires exactly one member_id or party_id' using errcode='23514'; end if;
    split_sum:=split_sum+(split->>'amount')::numeric; pct_sum:=pct_sum+(split->>'percentage')::numeric;
    insert into public.economic_allocations(household_id,transaction_id,responsible_member_id,responsible_party_id,allocation_order,percentage,amount)
    values(p_household_id,loss_tx,case when split ? 'member_id' then (split->>'member_id')::uuid end,case when split ? 'party_id' then (split->>'party_id')::uuid end,allocation_order,(split->>'percentage')::numeric,(split->>'amount')::numeric);
  end loop;
  if split_sum<>p_amount or pct_sum<>100 then raise exception 'loss allocations must equal loss amount and 100 percent' using errcode='23514'; end if;
  if obligation.source_transaction_id is not null then insert into public.transaction_links(household_id,source_transaction_id,related_transaction_id,kind,amount) values(p_household_id,obligation.source_transaction_id,loss_tx,'loss',p_amount); end if;
  insert into public.obligation_events(household_id,obligation_id,created_by_member_id,kind,amount,economic_transaction_id,occurred_at,notes) values(p_household_id,obligation.id,caller.id,'write_off',p_amount,loss_tx,p_loss_date::timestamptz,p_notes) returning id into event_id;
  update public.financial_obligations set state=case when settled+p_amount=original_amount then 'written_off' else 'partially_settled' end,closed_at=case when settled+p_amount=original_amount then p_loss_date::timestamptz else null end,updated_at=now() where id=obligation.id;
  return event_id;
end $$;

-- Same public signature as Etapa 9; old clients remain compatible.
create or replace function public.create_financial_transaction(
 p_household_id uuid,p_type public.transaction_kind,p_description text,p_amount numeric,p_transaction_date date,p_category_id uuid,
 p_buyer_member_id uuid default null,p_instrument_kind public.payment_instrument_kind default null,p_account_id uuid default null,p_card_id uuid default null,
 p_splits jsonb default '[]',p_installment_count integer default 1,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; tx uuid; split jsonb; split_sum numeric:=0; pct_sum numeric:=0; has_external boolean:=false; allocation_order integer:=0; plan uuid; cents bigint; base bigint; remainder int; i int; part numeric; card public.cards; dates record; invoice uuid; part_date date;
begin
 caller:=public.require_active_member(p_household_id);
 if p_type not in ('expense','income') or p_amount<=0 then raise exception 'positive expense or income required' using errcode='22023'; end if;
 if p_type='expense' and (p_buyer_member_id is null or p_instrument_kind is null or jsonb_array_length(p_splits)=0) then raise exception 'expense requires buyer, instrument, and economic splits' using errcode='23514'; end if;
 if p_type='income' and (p_buyer_member_id is not null or p_instrument_kind is not null or jsonb_array_length(p_splits)>0 or p_installment_count<>1) then raise exception 'income cannot contain expense roles' using errcode='23514'; end if;
 if p_installment_count<1 or (p_installment_count>1 and (p_type<>'expense' or p_instrument_kind<>'card')) then raise exception 'installments require a card expense' using errcode='22023'; end if;
 insert into public.transactions(household_id,created_by_member_id,buyer_member_id,category_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,notes)
 values(p_household_id,caller.id,p_buyer_member_id,p_category_id,p_type,'pending',case when p_type='income' then 'confirmed'::public.economic_state else 'realized'::public.economic_state end,trim(p_description),p_amount,p_amount,p_amount,case when p_type='income' then 0 else p_amount end,p_transaction_date,date_trunc('month',p_transaction_date)::date,p_notes) returning id into tx;
 if p_type='expense' then
   insert into public.transaction_payment_instruments(household_id,transaction_id,kind,account_id,card_id) values(p_household_id,tx,p_instrument_kind,case when p_instrument_kind='account' then p_account_id end,case when p_instrument_kind='card' then p_card_id end);
   select exists(select 1 from jsonb_array_elements(p_splits) s where s ? 'party_id') into has_external;
   for split in select * from jsonb_array_elements(p_splits) loop
     allocation_order:=allocation_order+1;
     split_sum:=split_sum+(split->>'amount')::numeric; pct_sum:=pct_sum+(split->>'percentage')::numeric;
     if (split ? 'member_id') = (split ? 'party_id') then raise exception 'each split requires exactly one member_id or party_id' using errcode='23514'; end if;
     insert into public.economic_allocations(household_id,transaction_id,responsible_member_id,responsible_party_id,allocation_order,percentage,amount)
     values(p_household_id,tx,case when split ? 'member_id' then (split->>'member_id')::uuid end,case when split ? 'party_id' then (split->>'party_id')::uuid end,allocation_order,(split->>'percentage')::numeric,(split->>'amount')::numeric);
     -- The legacy table requires 100% member-only totals; mixed allocations live
     -- solely in the canonical table rather than corrupting that invariant.
     if not has_external then insert into public.transaction_splits(household_id,transaction_id,responsible_member_id,percentage,amount) values(p_household_id,tx,(split->>'member_id')::uuid,(split->>'percentage')::numeric,(split->>'amount')::numeric); end if;
   end loop;
   if split_sum<>p_amount or pct_sum<>100 then raise exception 'economic splits must equal transaction amount and 100 percent' using errcode='23514'; end if;
 end if;
 if p_installment_count>1 then
   insert into public.installment_plans(household_id,purchase_transaction_id,installment_count,total_amount) values(p_household_id,tx,p_installment_count,p_amount) returning id into plan;
   cents:=round(p_amount*100); base:=cents/p_installment_count; remainder:=(cents%p_installment_count)::int; select * into card from public.cards where id=p_card_id and household_id=p_household_id;
   for i in 1..p_installment_count loop
     part:=(base+case when i<=remainder then 1 else 0 end)::numeric/100; part_date:=(p_transaction_date+((i-1)||' months')::interval)::date;
     select * into dates from public.invoice_dates(card,part_date);
     insert into public.card_invoices(household_id,card_id,competence_date,closing_date,due_date) values(p_household_id,p_card_id,dates.competence,dates.closing_date,dates.due_date) on conflict(card_id,competence_date) do update set updated_at=now() returning id into invoice;
     update public.card_invoices set total_amount=total_amount+part,updated_at=now() where id=invoice;
     insert into public.installments(household_id,installment_plan_id,invoice_id,number,amount,competence_date,due_date,original_due_date) values(p_household_id,plan,invoice,i,part,date_trunc('month',part_date)::date,dates.due_date,dates.due_date);
   end loop;
 elsif p_type='expense' and p_instrument_kind='card' then
   select * into card from public.cards where id=p_card_id and household_id=p_household_id; select * into dates from public.invoice_dates(card,p_transaction_date);
   insert into public.card_invoices(household_id,card_id,competence_date,closing_date,due_date,total_amount) values(p_household_id,p_card_id,dates.competence,dates.closing_date,dates.due_date,p_amount) on conflict(card_id,competence_date) do update set total_amount=public.card_invoices.total_amount+excluded.total_amount,updated_at=now() returning id into invoice;
   update public.transactions set invoice_id=invoice,due_date=dates.due_date where id=tx;
 end if;
 -- Settlement is intentionally separate: this compatible signature has no
 -- explicit funder and buyer/owner must never be inferred as the funder.
 return tx;
end $$;

-- Direct shared purchase: gross cash outflow is funded once, while every
-- external allocation becomes its own receivable linked to the gross event.
create or replace function public.create_and_settle_shared_expense(
 p_household_id uuid,p_description text,p_gross_amount numeric,p_transaction_date date,p_category_id uuid,p_buyer_member_id uuid,
 p_source_account_id uuid,p_funder_member_id uuid,p_splits jsonb,p_receivable_due_date date default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare tx uuid; split jsonb; party_id uuid; party_amount numeric;
begin
  perform public.require_active_member(p_household_id);
  tx:=public.create_financial_transaction(p_household_id,'expense',p_description,p_gross_amount,p_transaction_date,p_category_id,p_buyer_member_id,'account',p_source_account_id,null,p_splits,1,p_notes);
  perform public.settle_direct_expense(p_household_id,tx,p_source_account_id,p_funder_member_id,p_gross_amount,p_transaction_date::timestamptz);
  for split in select * from jsonb_array_elements(p_splits) loop
    if split ? 'party_id' then
      party_id:=(split->>'party_id')::uuid; party_amount:=(split->>'amount')::numeric;
      perform public.create_financial_obligation(p_household_id,'receivable','shared_expense',party_id,party_amount,p_transaction_date,p_receivable_due_date,'Rateio de terceiro: '||p_description,tx,null,null,p_notes);
    end if;
  end loop;
  return tx;
end $$;

-- Preserve recurrence idempotency while making the generated event a forecast.
create or replace function public.generate_recurring_occurrence(p_household_id uuid,p_rule_id uuid,p_occurrence_date date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; rule public.recurring_rules; template public.transactions; existing uuid; tx uuid; key text:=p_occurrence_date::text; estimate numeric;
begin
 caller:=public.require_active_member(p_household_id); select * into rule from public.recurring_rules where id=p_rule_id and household_id=p_household_id and deactivated_at is null for update;
 if rule.id is null or p_occurrence_date<rule.start_date or (rule.end_date is not null and p_occurrence_date>rule.end_date) then raise exception 'invalid recurring occurrence' using errcode='23514'; end if;
 select transaction_id into existing from public.recurring_occurrences where recurring_rule_id=p_rule_id and idempotency_key=key; if existing is not null then return existing; end if;
 select * into template from public.transactions where id=rule.template_transaction_id and household_id=p_household_id and deleted_at is null; if template.id is null then raise exception 'active recurring template required' using errcode='23514'; end if;
 estimate:=coalesce(rule.estimated_amount,template.estimated_amount,template.amount);
 insert into public.transactions(household_id,created_by_member_id,buyer_member_id,category_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,due_date,notes) values(p_household_id,caller.id,template.buyer_member_id,template.category_id,template.type,'planned','forecast',template.description,estimate,estimate,null,0,p_occurrence_date,date_trunc('month',p_occurrence_date)::date,p_occurrence_date,template.notes) returning id into tx;
 if template.type='expense' then
   insert into public.transaction_payment_instruments(household_id,transaction_id,kind,account_id,card_id) select p_household_id,tx,kind,account_id,card_id from public.transaction_payment_instruments where transaction_id=template.id;
   insert into public.economic_allocations(household_id,transaction_id,responsible_member_id,responsible_party_id,allocation_order,percentage,amount) select p_household_id,tx,responsible_member_id,responsible_party_id,allocation_order,percentage,amount from public.economic_allocations where transaction_id=template.id;
   insert into public.transaction_splits(household_id,transaction_id,responsible_member_id,percentage,amount) select p_household_id,tx,responsible_member_id,percentage,amount from public.transaction_splits where transaction_id=template.id;
   perform public.rescale_economic_allocations(tx,estimate);
 end if;
 insert into public.recurring_occurrences(household_id,recurring_rule_id,transaction_id,competence_date,due_date,status,idempotency_key,estimated_amount) values(p_household_id,p_rule_id,tx,p_occurrence_date,p_occurrence_date,'planned',key,estimate); return tx;
end $$;

do $$ declare signature text; begin
  foreach signature in array array[
    'public.create_financial_party(uuid,text,public.financial_party_kind,text,text)',
    'public.set_account_ownerships(uuid,uuid,uuid[])',
    'public.record_account_opening_position(uuid,uuid,numeric,date,text)',
    'public.confirm_financial_transaction(uuid,uuid,numeric)',
    'public.settle_direct_expense(uuid,uuid,uuid,uuid,numeric,timestamptz)',
    'public.settle_income(uuid,uuid,uuid,uuid,numeric,timestamptz)',
    'public.create_financial_obligation(uuid,public.obligation_kind,public.obligation_origin_kind,uuid,numeric,date,date,text,uuid,uuid,uuid,text)',
    'public.settle_financial_obligation(uuid,uuid,uuid,numeric,timestamptz,uuid,text)',
    'public.write_off_receivable(uuid,uuid,numeric,date,jsonb,uuid,text)',
    'public.create_financial_transaction(uuid,public.transaction_kind,text,numeric,date,uuid,uuid,public.payment_instrument_kind,uuid,uuid,jsonb,integer,text)',
    'public.create_and_settle_shared_expense(uuid,text,numeric,date,uuid,uuid,uuid,uuid,jsonb,date,text)',
    'public.generate_recurring_occurrence(uuid,uuid,date)'
  ] loop
    execute 'revoke all on function '||signature||' from public,anon';
    execute 'grant execute on function '||signature||' to authenticated';
  end loop;
end $$;
