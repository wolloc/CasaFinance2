-- PR C hardening: the shared v1 link trigger must never inspect columns that
-- do not exist on the table currently firing it. The original implementation
-- grouped transaction_links and transaction_components in one branch and used
-- boolean guards before touching table-specific NEW fields. PostgreSQL still
-- resolves those record fields, so a transaction_components insert could fail
-- with "record NEW has no field source_transaction_id".
--
-- Forward-only correction: keep the same trigger function and existing
-- triggers, but isolate each table-specific field access in its own branch.

create or replace function public.assert_financial_engine_v1_links()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  h uuid := new.household_id;
begin
  if tg_table_name='financial_parties' then
    if not exists(
      select 1 from public.household_members m
      where m.id=new.created_by_member_id and m.household_id=h and m.deactivated_at is null
    ) then
      raise exception 'party creator must be active in household' using errcode='23514';
    end if;

  elsif tg_table_name='account_ownerships' then
    if not exists(
      select 1 from public.accounts a
      where a.id=new.account_id and a.household_id=h and a.deactivated_at is null
    ) or not exists(
      select 1 from public.household_members m
      where m.id=new.member_id and m.household_id=h and m.deactivated_at is null
    ) then
      raise exception 'account ownership has cross-household reference' using errcode='23514';
    end if;

  elsif tg_table_name='account_balance_events' then
    if not exists(
      select 1 from public.accounts a
      where a.id=new.account_id and a.household_id=h and a.deactivated_at is null
    ) or not exists(
      select 1 from public.household_members m
      where m.id=new.created_by_member_id and m.household_id=h and m.deactivated_at is null
    ) then
      raise exception 'balance event has cross-household reference' using errcode='23514';
    end if;

  elsif tg_table_name='economic_allocations' then
    if not exists(
      select 1 from public.transactions t
      where t.id=new.transaction_id and t.household_id=h and t.deleted_at is null
    ) then
      raise exception 'allocation transaction belongs to another household' using errcode='23514';
    end if;
    if new.responsible_member_id is not null and not exists(
      select 1 from public.household_members m
      where m.id=new.responsible_member_id and m.household_id=h and m.deactivated_at is null
    ) then
      raise exception 'responsible member belongs to another household' using errcode='23514';
    end if;
    if new.responsible_party_id is not null and not exists(
      select 1 from public.financial_parties p
      where p.id=new.responsible_party_id and p.household_id=h and p.deactivated_at is null
    ) then
      raise exception 'responsible party belongs to another household' using errcode='23514';
    end if;

  elsif tg_table_name='transaction_links' then
    if not exists(
      select 1 from public.transactions t
      where t.id=new.source_transaction_id and t.household_id=h and t.deleted_at is null
    ) or not exists(
      select 1 from public.transactions t
      where t.id=new.related_transaction_id and t.household_id=h and t.deleted_at is null
    ) then
      raise exception 'transaction link has cross-household reference' using errcode='23514';
    end if;

  elsif tg_table_name='transaction_components' then
    if not exists(
      select 1 from public.transactions t
      where t.id=new.transaction_id and t.household_id=h and t.deleted_at is null
    ) then
      raise exception 'component has cross-household reference' using errcode='23514';
    end if;

  elsif tg_table_name='financial_obligations' then
    if not exists(
      select 1 from public.household_members m
      where m.id=new.created_by_member_id and m.household_id=h and m.deactivated_at is null
    ) or not exists(
      select 1 from public.financial_parties p
      where p.id=new.counterparty_id and p.household_id=h and p.deactivated_at is null
    ) then
      raise exception 'obligation party or creator belongs to another household' using errcode='23514';
    end if;
    if new.source_transaction_id is not null and not exists(
      select 1 from public.transactions t
      where t.id=new.source_transaction_id and t.household_id=h and t.deleted_at is null
    ) then
      raise exception 'obligation source belongs to another household' using errcode='23514';
    end if;
    if new.invoice_id is not null and not exists(
      select 1 from public.card_invoices i
      where i.id=new.invoice_id and i.household_id=h and i.deleted_at is null
    ) then
      raise exception 'obligation invoice belongs to another household' using errcode='23514';
    end if;

  elsif tg_table_name='obligation_events' then
    if not exists(
      select 1 from public.financial_obligations o
      where o.id=new.obligation_id and o.household_id=h
    ) or not exists(
      select 1 from public.household_members m
      where m.id=new.created_by_member_id and m.household_id=h and m.deactivated_at is null
    ) then
      raise exception 'obligation event has cross-household reference' using errcode='23514';
    end if;
    if new.movement_id is not null and not exists(
      select 1 from public.money_movements m
      where m.id=new.movement_id and m.household_id=h
    ) then
      raise exception 'obligation movement belongs to another household' using errcode='23514';
    end if;
    if new.economic_transaction_id is not null and not exists(
      select 1 from public.transactions t
      where t.id=new.economic_transaction_id and t.household_id=h and t.deleted_at is null
    ) then
      raise exception 'obligation economic event belongs to another household' using errcode='23514';
    end if;

  elsif tg_table_name='financing_allocations' then
    if new.transaction_id is not null and not exists(
      select 1 from public.transactions t
      where t.id=new.transaction_id and t.household_id=h and t.deleted_at is null
    ) then
      raise exception 'financing transaction belongs to another household' using errcode='23514';
    end if;
    if new.obligation_id is not null and not exists(
      select 1 from public.financial_obligations o
      where o.id=new.obligation_id and o.household_id=h
    ) then
      raise exception 'financing obligation belongs to another household' using errcode='23514';
    end if;
    if new.account_id is not null and not exists(
      select 1 from public.accounts a
      where a.id=new.account_id and a.household_id=h
    ) then
      raise exception 'financing account belongs to another household' using errcode='23514';
    end if;
    if new.card_id is not null and not exists(
      select 1 from public.cards c
      where c.id=new.card_id and c.household_id=h
    ) then
      raise exception 'financing card belongs to another household' using errcode='23514';
    end if;
    if new.invoice_id is not null and not exists(
      select 1 from public.card_invoices i
      where i.id=new.invoice_id and i.household_id=h and i.deleted_at is null
    ) then
      raise exception 'financing invoice belongs to another household' using errcode='23514';
    end if;
    if new.installment_id is not null and not exists(
      select 1 from public.installments i
      where i.id=new.installment_id and i.household_id=h
    ) then
      raise exception 'financing installment belongs to another household' using errcode='23514';
    end if;
  end if;

  return new;
end
$$;

revoke all on function public.assert_financial_engine_v1_links() from public,anon,authenticated;

comment on function public.assert_financial_engine_v1_links() is
  'Validates household-local references for financial engine rows. Table-specific NEW fields are accessed only inside the matching TG_TABLE_NAME branch.';
