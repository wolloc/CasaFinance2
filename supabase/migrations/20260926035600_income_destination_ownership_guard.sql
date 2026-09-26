-- Owner-first income hardening.
-- The UI filters destination accounts by beneficiary, but the invariant must also
-- be enforced in the canonical database write path so stale/direct callers
-- cannot create an income movement for a non-owner destination.

create or replace function public.enforce_income_destination_ownership()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if new.kind='income'
     and new.beneficiary_member_id is not null
     and new.destination_account_id is not null
     and not exists(
       select 1
       from public.account_ownerships ownership
       where ownership.household_id=new.household_id
         and ownership.account_id=new.destination_account_id
         and ownership.member_id=new.beneficiary_member_id
     )
  then
    raise exception 'income destination account must belong to beneficiary'
      using errcode='23514';
  end if;

  return new;
end
$$;

drop trigger if exists money_movements_income_destination_owner_guard
  on public.money_movements;

create trigger money_movements_income_destination_owner_guard
before insert or update of beneficiary_member_id,destination_account_id
on public.money_movements
for each row
execute function public.enforce_income_destination_ownership();

comment on function public.enforce_income_destination_ownership() is
  'Ensures income movements use a destination account owned by the beneficiary. Protects owner-first income semantics against stale or direct callers.';
