-- Etapa 10C: isolamento, invariantes e superficie de acesso.

create or replace function public.assert_financial_engine_v1_links()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare h uuid := new.household_id;
begin
  if tg_table_name='financial_parties' then
    if not exists(select 1 from public.household_members m where m.id=new.created_by_member_id and m.household_id=h and m.deactivated_at is null) then raise exception 'party creator must be active in household' using errcode='23514'; end if;
  elsif tg_table_name='account_ownerships' then
    if not exists(select 1 from public.accounts a where a.id=new.account_id and a.household_id=h and a.deactivated_at is null)
       or not exists(select 1 from public.household_members m where m.id=new.member_id and m.household_id=h and m.deactivated_at is null)
    then raise exception 'account ownership has cross-household reference' using errcode='23514'; end if;
  elsif tg_table_name='account_balance_events' then
    if not exists(select 1 from public.accounts a where a.id=new.account_id and a.household_id=h and a.deactivated_at is null)
       or not exists(select 1 from public.household_members m where m.id=new.created_by_member_id and m.household_id=h and m.deactivated_at is null)
    then raise exception 'balance event has cross-household reference' using errcode='23514'; end if;
  elsif tg_table_name='economic_allocations' then
    if not exists(select 1 from public.transactions t where t.id=new.transaction_id and t.household_id=h and t.deleted_at is null) then raise exception 'allocation transaction belongs to another household' using errcode='23514'; end if;
    if new.responsible_member_id is not null and not exists(select 1 from public.household_members m where m.id=new.responsible_member_id and m.household_id=h and m.deactivated_at is null) then raise exception 'responsible member belongs to another household' using errcode='23514'; end if;
    if new.responsible_party_id is not null and not exists(select 1 from public.financial_parties p where p.id=new.responsible_party_id and p.household_id=h and p.deactivated_at is null) then raise exception 'responsible party belongs to another household' using errcode='23514'; end if;
  elsif tg_table_name in ('transaction_links','transaction_components') then
    if tg_table_name='transaction_links' and (not exists(select 1 from public.transactions t where t.id=new.source_transaction_id and t.household_id=h and t.deleted_at is null) or not exists(select 1 from public.transactions t where t.id=new.related_transaction_id and t.household_id=h and t.deleted_at is null)) then raise exception 'transaction link has cross-household reference' using errcode='23514'; end if;
    if tg_table_name='transaction_components' and not exists(select 1 from public.transactions t where t.id=new.transaction_id and t.household_id=h and t.deleted_at is null) then raise exception 'component has cross-household reference' using errcode='23514'; end if;
  elsif tg_table_name='financial_obligations' then
    if not exists(select 1 from public.household_members m where m.id=new.created_by_member_id and m.household_id=h and m.deactivated_at is null) or not exists(select 1 from public.financial_parties p where p.id=new.counterparty_id and p.household_id=h and p.deactivated_at is null) then raise exception 'obligation party or creator belongs to another household' using errcode='23514'; end if;
    if new.source_transaction_id is not null and not exists(select 1 from public.transactions t where t.id=new.source_transaction_id and t.household_id=h and t.deleted_at is null) then raise exception 'obligation source belongs to another household' using errcode='23514'; end if;
    if new.invoice_id is not null and not exists(select 1 from public.card_invoices i where i.id=new.invoice_id and i.household_id=h and i.deleted_at is null) then raise exception 'obligation invoice belongs to another household' using errcode='23514'; end if;
  elsif tg_table_name='obligation_events' then
    if not exists(select 1 from public.financial_obligations o where o.id=new.obligation_id and o.household_id=h) or not exists(select 1 from public.household_members m where m.id=new.created_by_member_id and m.household_id=h and m.deactivated_at is null) then raise exception 'obligation event has cross-household reference' using errcode='23514'; end if;
    if new.movement_id is not null and not exists(select 1 from public.money_movements m where m.id=new.movement_id and m.household_id=h) then raise exception 'obligation movement belongs to another household' using errcode='23514'; end if;
    if new.economic_transaction_id is not null and not exists(select 1 from public.transactions t where t.id=new.economic_transaction_id and t.household_id=h and t.deleted_at is null) then raise exception 'obligation economic event belongs to another household' using errcode='23514'; end if;
  elsif tg_table_name='financing_allocations' then
    if new.transaction_id is not null and not exists(select 1 from public.transactions t where t.id=new.transaction_id and t.household_id=h and t.deleted_at is null) then raise exception 'financing transaction belongs to another household' using errcode='23514'; end if;
    if new.obligation_id is not null and not exists(select 1 from public.financial_obligations o where o.id=new.obligation_id and o.household_id=h) then raise exception 'financing obligation belongs to another household' using errcode='23514'; end if;
    if new.account_id is not null and not exists(select 1 from public.accounts a where a.id=new.account_id and a.household_id=h) then raise exception 'financing account belongs to another household' using errcode='23514'; end if;
    if new.card_id is not null and not exists(select 1 from public.cards c where c.id=new.card_id and c.household_id=h) then raise exception 'financing card belongs to another household' using errcode='23514'; end if;
    if new.invoice_id is not null and not exists(select 1 from public.card_invoices i where i.id=new.invoice_id and i.household_id=h and i.deleted_at is null) then raise exception 'financing invoice belongs to another household' using errcode='23514'; end if;
    if new.installment_id is not null and not exists(select 1 from public.installments i where i.id=new.installment_id and i.household_id=h) then raise exception 'financing installment belongs to another household' using errcode='23514'; end if;
  end if;
  return new;
end $$;
revoke all on function public.assert_financial_engine_v1_links() from public,anon,authenticated;

do $$ declare t text; begin
  foreach t in array array['financial_parties','account_ownerships','account_balance_events','transaction_links','transaction_components','economic_allocations','financial_obligations','obligation_events','financing_allocations'] loop
    execute format('create trigger financial_engine_v1_links before insert or update on public.%I for each row execute function public.assert_financial_engine_v1_links()',t);
  end loop;
end $$;

create or replace function public.assert_economic_allocation_total()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare tx_id uuid:=coalesce(new.transaction_id,old.transaction_id); expected numeric; allocated numeric; pct numeric;
begin
  select amount into expected from public.transactions where id=tx_id and deleted_at is null;
  select coalesce(sum(amount),0),coalesce(sum(percentage),0) into allocated,pct from public.economic_allocations where transaction_id=tx_id;
  if expected is not null and (allocated<>expected or pct<>100) then raise exception 'economic allocations must equal transaction amount and 100 percent' using errcode='23514'; end if;
  return null;
end $$;
revoke all on function public.assert_economic_allocation_total() from public,anon,authenticated;
create constraint trigger economic_allocations_exact_total after insert or update or delete on public.economic_allocations deferrable initially deferred for each row execute function public.assert_economic_allocation_total();

create or replace function public.assert_max_two_account_owners()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if (select count(*) from public.account_ownerships where account_id=new.account_id)>2 then raise exception 'an account supports at most two household owners' using errcode='23514'; end if;
  return null;
end $$;
revoke all on function public.assert_max_two_account_owners() from public,anon,authenticated;
create constraint trigger account_ownerships_max_two after insert or update on public.account_ownerships deferrable initially deferred for each row execute function public.assert_max_two_account_owners();

-- Extend the existing money movement validator for new optional links.
create or replace function public.assert_money_movement_v1_links()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.counterparty_id is not null and not exists(select 1 from public.financial_parties p where p.id=new.counterparty_id and p.household_id=new.household_id and p.deactivated_at is null) then raise exception 'movement counterparty belongs to another household' using errcode='23514'; end if;
  if new.related_transaction_id is not null and not exists(select 1 from public.transactions t where t.id=new.related_transaction_id and t.household_id=new.household_id and t.deleted_at is null) then raise exception 'movement transaction belongs to another household' using errcode='23514'; end if;
  if new.obligation_id is not null and not exists(select 1 from public.financial_obligations o where o.id=new.obligation_id and o.household_id=new.household_id) then raise exception 'movement obligation belongs to another household' using errcode='23514'; end if;
  return new;
end $$;
revoke all on function public.assert_money_movement_v1_links() from public,anon,authenticated;
create trigger money_movement_v1_links before insert or update on public.money_movements for each row execute function public.assert_money_movement_v1_links();

do $$ declare t text; begin
  foreach t in array array['financial_parties','account_ownerships','account_balance_events','transaction_links','transaction_components','economic_allocations','financial_obligations','obligation_events','financing_allocations'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public,anon',t);
    execute format('revoke insert,update,delete,truncate,references,trigger on table public.%I from authenticated',t);
    execute format('grant select on table public.%I to authenticated',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_active_household_member(household_id))',t||'_household_select',t);
  end loop;
end $$;
