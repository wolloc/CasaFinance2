-- Etapa 9: invariantes e RLS do nucleo financeiro canonico.
-- A migration e estritamente aditiva e nao transforma dados legados.

alter table public.card_invoices add column if not exists deleted_at timestamptz;
alter table public.recurring_occurrences add column if not exists idempotency_key text;
-- Funding de cartao precisa identificar a obrigacao liquidada. A transacao da
-- compra, sozinha, nao distingue parcelas que caem em faturas diferentes.
alter table public.funding_events add column if not exists invoice_id uuid references public.card_invoices(id) on delete restrict;
alter table public.funding_events add column if not exists installment_id uuid references public.installments(id) on delete restrict;
alter table public.funding_events drop constraint if exists funding_events_financed_transaction_id_funding_transaction_id_funder_key;
create unique index if not exists funding_events_allocation_unique
  on public.funding_events(financed_transaction_id, funding_transaction_id, funder_member_id, invoice_id, installment_id) nulls not distinct;
create index if not exists funding_events_invoice_allocation
  on public.funding_events(invoice_id, financed_transaction_id, installment_id);
create unique index if not exists recurring_occurrences_idempotency
  on public.recurring_occurrences(recurring_rule_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.require_active_member(p_household_id uuid)
returns public.household_members language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare result public.household_members;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into result from public.household_members m
   where m.household_id = p_household_id and m.profile_id = auth.uid() and m.deactivated_at is null;
  if result.id is null then raise exception 'active household membership required' using errcode = '42501'; end if;
  return result;
end $$;
revoke all on function public.require_active_member(uuid) from public, anon, authenticated;

create or replace function public.assert_financial_household_links()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
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
end $$;
revoke all on function public.assert_financial_household_links() from public, anon, authenticated;

do $$ declare n text; begin
  foreach n in array array['transaction_splits','installment_plans','installments','card_invoices','card_invoice_payments','funding_events','transfers','money_movements','recurring_rules','recurring_occurrences'] loop
    execute format('drop trigger if exists financial_household_links on public.%I',n);
    execute format('create trigger financial_household_links before insert or update on public.%I for each row execute function public.assert_financial_household_links()',n);
  end loop;
end $$;

create or replace function public.assert_installment_total() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare plan_id uuid := coalesce(new.installment_plan_id,old.installment_plan_id); expected numeric; actual numeric; expected_count integer; actual_count integer;
begin
 select total_amount,installment_count into expected,expected_count from public.installment_plans where id=plan_id;
 select coalesce(sum(amount),0),count(*) into actual,actual_count from public.installments where installment_plan_id=plan_id;
 if expected is not null and (actual<>expected or actual_count<>expected_count) then raise exception 'installments must exactly match plan total and count' using errcode='23514'; end if;
 return null;
end $$;
drop trigger if exists installments_exact_total on public.installments;
create constraint trigger installments_exact_total after insert or update or delete on public.installments deferrable initially deferred for each row execute function public.assert_installment_total();

-- Historico financeiro: leitura pela Casa; escrita composta somente pelas RPCs.
do $$ declare t text; p record; begin
 foreach t in array array['transaction_splits','installment_plans','installments','card_invoices','card_invoice_payments','funding_events','transfers','money_movements','recurring_rules','recurring_occurrences'] loop
   execute format('alter table public.%I enable row level security',t);
   for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t); end loop;
   execute format('create policy %I on public.%I for select to authenticated using (public.is_active_household_member(household_id))',t||'_household_select',t);
 end loop;
end $$;

comment on function public.require_active_member(uuid) is 'Internal authentication boundary; never executable through PostgREST.';
comment on table public.transaction_splits is 'Economic responsibility only; never inferred from buyer, instrument owner, or funder.';
