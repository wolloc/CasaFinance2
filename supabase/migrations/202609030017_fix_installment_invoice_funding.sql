-- Correcao posterior a Etapa 9: aplica, sem reescrever migrations ja executadas,
-- o funding de pagamentos de fatura por compra e parcela.

alter table public.funding_events
  add column if not exists invoice_id uuid references public.card_invoices(id) on delete restrict;
alter table public.funding_events
  add column if not exists installment_id uuid references public.installments(id) on delete restrict;

alter table public.funding_events
  drop constraint if exists funding_events_financed_transaction_id_funding_transaction_id_funder_key;

create unique index if not exists funding_events_allocation_unique
  on public.funding_events (
    financed_transaction_id,
    funding_transaction_id,
    funder_member_id,
    invoice_id,
    installment_id
  ) nulls not distinct;

create index if not exists funding_events_invoice_allocation
  on public.funding_events (invoice_id, financed_transaction_id, installment_id);

create or replace function public.assert_financial_household_links()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare h uuid := new.household_id;
begin
  if tg_table_name = 'transaction_splits' then
    if not exists(select 1 from public.transactions t where t.id=new.transaction_id and t.household_id=h and t.deleted_at is null) then raise exception 'split transaction belongs to another household' using errcode='23514'; end if;
    if not exists(select 1 from public.household_members m where m.id=new.responsible_member_id and m.household_id=h and m.deactivated_at is null) then raise exception 'responsible member must be active in household' using errcode='23514'; end if;
  elsif tg_table_name = 'installment_plans' then
    if not exists(select 1 from public.transactions t where t.id=new.purchase_transaction_id and t.household_id=h and t.type='expense' and t.amount=new.total_amount and t.deleted_at is null) then raise exception 'installment purchase must match household and total' using errcode='23514'; end if;
  elsif tg_table_name = 'installments' then
    if not exists(select 1 from public.installment_plans p where p.id=new.installment_plan_id and p.household_id=h) then raise exception 'installment plan belongs to another household' using errcode='23514'; end if;
    if new.invoice_id is not null and not exists(select 1 from public.card_invoices i where i.id=new.invoice_id and i.household_id=h and i.deleted_at is null) then raise exception 'invoice belongs to another household' using errcode='23514'; end if;
  elsif tg_table_name = 'card_invoices' then
    if not exists(select 1 from public.cards c where c.id=new.card_id and c.household_id=h and c.deactivated_at is null) then raise exception 'card belongs to another household' using errcode='23514'; end if;
  elsif tg_table_name = 'card_invoice_payments' then
    if not exists(select 1 from public.card_invoices i where i.id=new.invoice_id and i.household_id=h and i.deleted_at is null) or not exists(select 1 from public.accounts a where a.id=new.source_account_id and a.household_id=h and a.deactivated_at is null) then raise exception 'invoice payment has cross-household reference' using errcode='23514'; end if;
  elsif tg_table_name = 'funding_events' then
    if not exists(select 1 from public.household_members m where m.id=new.funder_member_id and m.household_id=h and m.deactivated_at is null) or not exists(select 1 from public.accounts a where a.id=new.source_account_id and a.household_id=h and a.deactivated_at is null) or not exists(select 1 from public.transactions t where t.id=new.financed_transaction_id and t.household_id=h and t.deleted_at is null) or not exists(select 1 from public.transactions t where t.id=new.funding_transaction_id and t.household_id=h and t.deleted_at is null) then raise exception 'funding has cross-household reference' using errcode='23514'; end if;
    if new.installment_id is not null and new.invoice_id is null then raise exception 'installment funding requires an invoice' using errcode='23514'; end if;
    if new.invoice_id is not null and not exists(select 1 from public.card_invoices i where i.id=new.invoice_id and i.household_id=h and i.deleted_at is null) then raise exception 'funding invoice belongs to another household' using errcode='23514'; end if;
    if new.invoice_id is not null and not exists(
      select 1 from public.card_invoice_payments p where p.invoice_id=new.invoice_id and p.payment_transaction_id=new.funding_transaction_id and p.source_account_id=new.source_account_id and p.household_id=h
    ) then raise exception 'funding must match its invoice payment' using errcode='23514'; end if;
    if new.installment_id is not null and not exists(
      select 1 from public.installments i join public.installment_plans p on p.id=i.installment_plan_id
       where i.id=new.installment_id and i.household_id=h and i.invoice_id=new.invoice_id and p.household_id=h and p.purchase_transaction_id=new.financed_transaction_id
    ) then raise exception 'funding installment does not match invoice and purchase' using errcode='23514'; end if;
    if new.invoice_id is not null and new.installment_id is null and not exists(
      select 1 from public.transactions t where t.id=new.financed_transaction_id and t.household_id=h and t.invoice_id=new.invoice_id and t.deleted_at is null
    ) then raise exception 'funding invoice does not match purchase' using errcode='23514'; end if;
  elsif tg_table_name = 'transfers' then
    if not exists(select 1 from public.accounts a where a.id=new.source_account_id and a.household_id=h and a.deactivated_at is null) or not exists(select 1 from public.accounts a where a.id=new.destination_account_id and a.household_id=h and a.deactivated_at is null) then raise exception 'transfer accounts must belong to household' using errcode='23514'; end if;
  elsif tg_table_name = 'money_movements' then
    if new.created_by_member_id is null or not exists(select 1 from public.household_members m where m.id=new.created_by_member_id and m.household_id=h and m.deactivated_at is null) then raise exception 'movement creator must be active in household' using errcode='23514'; end if;
    if new.source_account_id is not null and not exists(select 1 from public.accounts a where a.id=new.source_account_id and a.household_id=h) then raise exception 'movement source belongs to another household' using errcode='23514'; end if;
    if new.destination_account_id is not null and not exists(select 1 from public.accounts a where a.id=new.destination_account_id and a.household_id=h) then raise exception 'movement destination belongs to another household' using errcode='23514'; end if;
  elsif tg_table_name = 'recurring_rules' then
    if not exists(select 1 from public.household_members m where m.id=new.created_by_member_id and m.household_id=h and m.deactivated_at is null) then raise exception 'recurring creator must be active in household' using errcode='23514'; end if;
    if new.template_transaction_id is not null and not exists(select 1 from public.transactions t where t.id=new.template_transaction_id and t.household_id=h and t.deleted_at is null) then raise exception 'recurring template belongs to another household' using errcode='23514'; end if;
  elsif tg_table_name = 'recurring_occurrences' then
    if not exists(select 1 from public.recurring_rules r where r.id=new.recurring_rule_id and r.household_id=h and r.deactivated_at is null) then raise exception 'recurring rule belongs to another household' using errcode='23514'; end if;
  end if;
  return new;
end
$$;

revoke all on function public.assert_financial_household_links() from public, anon, authenticated;

create or replace function public.pay_card_invoice(
  p_household_id uuid,
  p_invoice_id uuid,
  p_source_account_id uuid,
  p_funder_member_id uuid,
  p_amount numeric,
  p_paid_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare caller public.household_members; inv public.card_invoices; payment_tx uuid; movement uuid; purchase record; allocation numeric; remaining numeric;
begin
 caller:=public.require_active_member(p_household_id); select * into inv from public.card_invoices where id=p_invoice_id and household_id=p_household_id and deleted_at is null for update;
 if inv.id is null or p_amount<=0 or inv.settled_amount+p_amount>inv.total_amount then raise exception 'invalid invoice payment' using errcode='23514'; end if;
 if not exists(select 1 from public.household_members where id=p_funder_member_id and household_id=p_household_id and deactivated_at is null) then raise exception 'funder must be active in household' using errcode='23514'; end if;
 insert into public.transactions(household_id,created_by_member_id,type,status,description,amount,transaction_date,competence_date,settled_at) values(p_household_id,caller.id,'invoice_payment','paid','Pagamento de fatura',p_amount,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at) returning id into payment_tx;
 insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,source_account_id,invoice_id,movement_date,competence_date,realized_at) values(p_household_id,caller.id,'invoice_payment','realized',p_amount,'Pagamento de fatura',p_source_account_id,p_invoice_id,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at) returning id into movement;
 insert into public.card_invoice_payments(household_id,invoice_id,payment_transaction_id,source_account_id,amount,paid_at) values(p_household_id,p_invoice_id,payment_tx,p_source_account_id,p_amount,p_paid_at);
 remaining:=p_amount;
 -- Cada parcela e uma unidade de alocacao independente. Assim, funding de uma
 -- fatura anterior da mesma compra nunca reduz o saldo financiavel desta fatura.
 for purchase in
   select t.id, null::uuid installment_id, t.amount, t.created_at
     from public.transactions t
    where t.invoice_id=p_invoice_id and t.household_id=p_household_id and t.deleted_at is null
   union all
   select t.id, ins.id, ins.amount, t.created_at
     from public.installments ins
     join public.installment_plans ip on ip.id=ins.installment_plan_id and ip.household_id=p_household_id
     join public.transactions t on t.id=ip.purchase_transaction_id and t.household_id=p_household_id and t.deleted_at is null
    where ins.invoice_id=p_invoice_id and ins.household_id=p_household_id
   order by created_at,id,installment_id nulls first
 loop
   allocation:=least(remaining,purchase.amount-coalesce((select sum(f.amount) from public.funding_events f where f.invoice_id=p_invoice_id and f.financed_transaction_id=purchase.id and f.installment_id is not distinct from purchase.installment_id),0));
   if allocation>0 then insert into public.funding_events(household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,invoice_id,installment_id,amount,funded_at) values(p_household_id,purchase.id,payment_tx,p_funder_member_id,p_source_account_id,p_invoice_id,purchase.installment_id,allocation,p_paid_at); remaining:=remaining-allocation; end if;
   exit when remaining=0;
 end loop;
 if remaining<>0 then raise exception 'invoice purchases do not support requested funding' using errcode='23514'; end if;
 update public.card_invoices set settled_amount=settled_amount+p_amount,status=case when settled_amount+p_amount=total_amount then 'paid' else status end,settled_at=case when settled_amount+p_amount=total_amount then p_paid_at else null end,updated_at=now() where id=p_invoice_id;
 return payment_tx;
end
$$;

revoke all on function public.pay_card_invoice(uuid,uuid,uuid,uuid,numeric,timestamptz) from public, anon;
grant execute on function public.pay_card_invoice(uuid,uuid,uuid,uuid,numeric,timestamptz) to authenticated;
