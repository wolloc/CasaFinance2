-- Etapa 9: operacoes compostas. Cada funcao executa em uma unica transacao PostgreSQL.

create or replace function public.invoice_dates(p_card public.cards,p_purchase_date date)
returns table(competence date,closing_date date,due_date date) language plpgsql immutable set search_path=public,pg_temp as $$
declare base_month date:=date_trunc('month',p_purchase_date)::date; close_day int; due_month date;
begin
 close_day:=least(p_card.closing_day,extract(day from (base_month+interval '1 month-1 day'))::int);
 if p_purchase_date>make_date(extract(year from base_month)::int,extract(month from base_month)::int,close_day) then base_month:=(base_month+interval '1 month')::date; end if;
 competence:=base_month;
 closing_date:=make_date(extract(year from base_month)::int,extract(month from base_month)::int,least(p_card.closing_day,extract(day from (base_month+interval '1 month-1 day'))::int));
 due_month:=case when p_card.due_day>p_card.closing_day then base_month else (base_month+interval '1 month')::date end;
 due_date:=make_date(extract(year from due_month)::int,extract(month from due_month)::int,least(p_card.due_day,extract(day from (due_month+interval '1 month-1 day'))::int)); return next;
end $$;
revoke all on function public.invoice_dates(public.cards,date) from public,anon,authenticated;

create or replace function public.create_financial_transaction(
 p_household_id uuid,p_type public.transaction_kind,p_description text,p_amount numeric,p_transaction_date date,p_category_id uuid,
 p_buyer_member_id uuid default null,p_instrument_kind public.payment_instrument_kind default null,p_account_id uuid default null,p_card_id uuid default null,
 p_splits jsonb default '[]',p_installment_count integer default 1,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; tx uuid; split jsonb; split_sum numeric:=0; pct_sum numeric:=0; plan uuid; cents bigint; base bigint; remainder int; i int; part numeric; card public.cards; dates record; invoice uuid; part_date date;
begin
 caller:=public.require_active_member(p_household_id);
 if p_type not in ('expense','income') or p_amount<=0 then raise exception 'positive expense or income required' using errcode='22023'; end if;
 if p_type='expense' and (p_buyer_member_id is null or p_instrument_kind is null or jsonb_array_length(p_splits)=0) then raise exception 'expense requires buyer, instrument, and economic splits' using errcode='23514'; end if;
 if p_type='income' and (p_buyer_member_id is not null or p_instrument_kind is not null or jsonb_array_length(p_splits)>0 or p_installment_count<>1) then raise exception 'income cannot contain expense roles' using errcode='23514'; end if;
 if p_installment_count<1 or (p_installment_count>1 and p_type<>'expense') then raise exception 'invalid installment count' using errcode='22023'; end if;
 insert into public.transactions(household_id,created_by_member_id,buyer_member_id,category_id,type,status,description,amount,transaction_date,competence_date,notes)
 values(p_household_id,caller.id,p_buyer_member_id,p_category_id,p_type,'pending',trim(p_description),p_amount,p_transaction_date,p_transaction_date,p_notes) returning id into tx;
 if p_type='expense' then
   insert into public.transaction_payment_instruments(household_id,transaction_id,kind,account_id,card_id) values(p_household_id,tx,p_instrument_kind,case when p_instrument_kind='account' then p_account_id end,case when p_instrument_kind='card' then p_card_id end);
   for split in select * from jsonb_array_elements(p_splits) loop
     split_sum:=split_sum+(split->>'amount')::numeric; pct_sum:=pct_sum+(split->>'percentage')::numeric;
     insert into public.transaction_splits(household_id,transaction_id,responsible_member_id,percentage,amount) values(p_household_id,tx,(split->>'member_id')::uuid,(split->>'percentage')::numeric,(split->>'amount')::numeric);
   end loop;
   if split_sum<>p_amount or pct_sum<>100 then raise exception 'economic splits must equal transaction amount and 100 percent' using errcode='23514'; end if;
 end if;
 if p_installment_count>1 then
   insert into public.installment_plans(household_id,purchase_transaction_id,installment_count,total_amount) values(p_household_id,tx,p_installment_count,p_amount) returning id into plan;
   cents:=round(p_amount*100); base:=cents/p_installment_count; remainder:=(cents%p_installment_count)::int;
   if p_instrument_kind='card' then select * into card from public.cards where id=p_card_id and household_id=p_household_id; end if;
   for i in 1..p_installment_count loop
     part:=(base+case when i<=remainder then 1 else 0 end)::numeric/100; part_date:=(p_transaction_date+((i-1)||' months')::interval)::date; invoice:=null;
     if p_instrument_kind='card' then
       select * into dates from public.invoice_dates(card,part_date);
       insert into public.card_invoices(household_id,card_id,competence_date,closing_date,due_date) values(p_household_id,p_card_id,dates.competence,dates.closing_date,dates.due_date)
       on conflict(card_id,competence_date) do update set updated_at=now() returning id into invoice;
       update public.card_invoices set total_amount=total_amount+part,updated_at=now() where id=invoice;
     end if;
     insert into public.installments(household_id,installment_plan_id,invoice_id,number,amount,competence_date,due_date) values(p_household_id,plan,invoice,i,part,date_trunc('month',part_date)::date,case when invoice is null then part_date else dates.due_date end);
   end loop;
 elsif p_type='expense' and p_instrument_kind='card' then
   select * into card from public.cards where id=p_card_id and household_id=p_household_id; select * into dates from public.invoice_dates(card,p_transaction_date);
   insert into public.card_invoices(household_id,card_id,competence_date,closing_date,due_date,total_amount) values(p_household_id,p_card_id,dates.competence,dates.closing_date,dates.due_date,p_amount)
   on conflict(card_id,competence_date) do update set total_amount=public.card_invoices.total_amount+excluded.total_amount,updated_at=now() returning id into invoice;
   update public.transactions set invoice_id=invoice,due_date=dates.due_date where id=tx;
 end if;
 return tx;
end $$;

create or replace function public.pay_card_invoice(p_household_id uuid,p_invoice_id uuid,p_source_account_id uuid,p_funder_member_id uuid,p_amount numeric,p_paid_at timestamptz default now())
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; inv public.card_invoices; payment_tx uuid; movement uuid; purchase record; allocation numeric; remaining numeric;
begin
 caller:=public.require_active_member(p_household_id); select * into inv from public.card_invoices where id=p_invoice_id and household_id=p_household_id and deleted_at is null for update;
 if inv.id is null or p_amount<=0 or inv.settled_amount+p_amount>inv.total_amount then raise exception 'invalid invoice payment' using errcode='23514'; end if;
 if not exists(select 1 from public.household_members where id=p_funder_member_id and household_id=p_household_id and deactivated_at is null) then raise exception 'funder must be active in household' using errcode='23514'; end if;
 insert into public.transactions(household_id,created_by_member_id,type,status,description,amount,transaction_date,competence_date,settled_at) values(p_household_id,caller.id,'invoice_payment','paid','Pagamento de fatura',p_amount,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at) returning id into payment_tx;
 insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,source_account_id,invoice_id,movement_date,competence_date,realized_at) values(p_household_id,caller.id,'invoice_payment','realized',p_amount,'Pagamento de fatura',p_source_account_id,p_invoice_id,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at) returning id into movement;
 insert into public.card_invoice_payments(household_id,invoice_id,payment_transaction_id,source_account_id,amount,paid_at) values(p_household_id,p_invoice_id,payment_tx,p_source_account_id,p_amount,p_paid_at);
 remaining:=p_amount;
 for purchase in select t.id,case when t.invoice_id=p_invoice_id then t.amount else sum(ins.amount) end amount from public.transactions t left join public.installment_plans ip on ip.purchase_transaction_id=t.id left join public.installments ins on ins.installment_plan_id=ip.id and ins.invoice_id=p_invoice_id where (t.invoice_id=p_invoice_id or ins.id is not null) and t.deleted_at is null group by t.id,t.invoice_id,t.amount,t.created_at order by t.created_at,t.id loop
   allocation:=least(remaining,purchase.amount-coalesce((select sum(f.amount) from public.funding_events f where f.financed_transaction_id=purchase.id),0));
   if allocation>0 then insert into public.funding_events(household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,amount,funded_at) values(p_household_id,purchase.id,payment_tx,p_funder_member_id,p_source_account_id,allocation,p_paid_at); remaining:=remaining-allocation; end if;
   exit when remaining=0;
 end loop;
 if remaining<>0 then raise exception 'invoice purchases do not support requested funding' using errcode='23514'; end if;
 update public.card_invoices set settled_amount=settled_amount+p_amount,status=case when settled_amount+p_amount=total_amount then 'paid' else status end,settled_at=case when settled_amount+p_amount=total_amount then p_paid_at else null end,updated_at=now() where id=p_invoice_id;
 return payment_tx;
end $$;

create or replace function public.create_transfer(p_household_id uuid,p_source_account_id uuid,p_destination_account_id uuid,p_amount numeric,p_date date,p_description text default 'Transferência')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; tx uuid;
begin caller:=public.require_active_member(p_household_id); if p_amount<=0 or p_source_account_id=p_destination_account_id then raise exception 'invalid transfer' using errcode='22023'; end if;
 insert into public.transactions(household_id,created_by_member_id,type,status,description,amount,transaction_date,competence_date,settled_at) values(p_household_id,caller.id,'transfer','paid',p_description,p_amount,p_date,date_trunc('month',p_date)::date,p_date::timestamptz) returning id into tx;
 insert into public.transfers(household_id,transaction_id,source_account_id,destination_account_id,settled_at) values(p_household_id,tx,p_source_account_id,p_destination_account_id,p_date::timestamptz);
 insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,source_account_id,destination_account_id,movement_date,competence_date,realized_at) values(p_household_id,caller.id,'transfer','realized',p_amount,p_description,p_source_account_id,p_destination_account_id,p_date,date_trunc('month',p_date)::date,p_date::timestamptz); return tx; end $$;

create or replace function public.generate_recurring_occurrence(p_household_id uuid,p_rule_id uuid,p_occurrence_date date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare caller public.household_members; rule public.recurring_rules; template public.transactions; existing uuid; tx uuid; key text:=p_occurrence_date::text;
begin caller:=public.require_active_member(p_household_id); select * into rule from public.recurring_rules where id=p_rule_id and household_id=p_household_id and deactivated_at is null for update;
 if rule.id is null or p_occurrence_date<rule.start_date or (rule.end_date is not null and p_occurrence_date>rule.end_date) then raise exception 'invalid recurring occurrence' using errcode='23514'; end if;
 select transaction_id into existing from public.recurring_occurrences where recurring_rule_id=p_rule_id and idempotency_key=key; if existing is not null then return existing; end if;
 select * into template from public.transactions where id=rule.template_transaction_id and household_id=p_household_id and deleted_at is null;
 if template.id is null then raise exception 'active recurring template required' using errcode='23514'; end if;
 insert into public.transactions(household_id,created_by_member_id,buyer_member_id,category_id,type,status,description,amount,transaction_date,competence_date,due_date,notes) values(p_household_id,caller.id,template.buyer_member_id,template.category_id,template.type,'pending',template.description,template.amount,p_occurrence_date,p_occurrence_date,p_occurrence_date,template.notes) returning id into tx;
 if template.type='expense' then insert into public.transaction_payment_instruments(household_id,transaction_id,kind,account_id,card_id) select p_household_id,tx,kind,account_id,card_id from public.transaction_payment_instruments where transaction_id=template.id; insert into public.transaction_splits(household_id,transaction_id,responsible_member_id,percentage,amount) select p_household_id,tx,responsible_member_id,percentage,amount from public.transaction_splits where transaction_id=template.id; end if;
 insert into public.recurring_occurrences(household_id,recurring_rule_id,transaction_id,competence_date,due_date,status,idempotency_key) values(p_household_id,p_rule_id,tx,p_occurrence_date,p_occurrence_date,'pending',key); return tx;
end $$;

revoke all on function public.create_financial_transaction(uuid,public.transaction_kind,text,numeric,date,uuid,uuid,public.payment_instrument_kind,uuid,uuid,jsonb,integer,text) from public,anon;
grant execute on function public.create_financial_transaction(uuid,public.transaction_kind,text,numeric,date,uuid,uuid,public.payment_instrument_kind,uuid,uuid,jsonb,integer,text) to authenticated;
revoke all on function public.pay_card_invoice(uuid,uuid,uuid,uuid,numeric,timestamptz) from public,anon; grant execute on function public.pay_card_invoice(uuid,uuid,uuid,uuid,numeric,timestamptz) to authenticated;
revoke all on function public.create_transfer(uuid,uuid,uuid,numeric,date,text) from public,anon; grant execute on function public.create_transfer(uuid,uuid,uuid,numeric,date,text) to authenticated;
revoke all on function public.generate_recurring_occurrence(uuid,uuid,date) from public,anon; grant execute on function public.generate_recurring_occurrence(uuid,uuid,date) to authenticated;
