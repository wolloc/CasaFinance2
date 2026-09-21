-- Release 1: preserve enum typing when a true income becomes partially or fully realized.
-- Forward-only fix: historical migrations remain untouched.

create or replace function public.settle_income(
  p_household_id uuid,
  p_transaction_id uuid,
  p_destination_account_id uuid,
  p_beneficiary_member_id uuid,
  p_amount numeric,
  p_received_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx public.transactions;
  movement_id uuid;
begin
  caller:=public.require_active_member(p_household_id);

  select * into tx
  from public.transactions
  where id=p_transaction_id
    and household_id=p_household_id
    and type='income'
    and deleted_at is null
  for update;

  if tx.id is null
     or tx.economic_state in ('cancelled','reversed')
     or p_amount<=0
     or tx.realized_amount+p_amount>coalesce(tx.confirmed_amount,tx.amount)
  then
    raise exception 'invalid income settlement' using errcode='23514';
  end if;

  if not exists(
       select 1 from public.accounts
       where id=p_destination_account_id and household_id=p_household_id and deactivated_at is null
     )
     or not exists(
       select 1 from public.household_members
       where id=p_beneficiary_member_id and household_id=p_household_id and deactivated_at is null
     )
  then
    raise exception 'destination and beneficiary must belong to household' using errcode='23514';
  end if;

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,
    beneficiary_member_id,destination_account_id,category_id,related_transaction_id,
    movement_date,competence_date,realized_at
  )
  values(
    p_household_id,caller.id,'income','realized',p_amount,tx.description,
    p_beneficiary_member_id,p_destination_account_id,tx.category_id,tx.id,
    p_received_at::date,date_trunc('month',p_received_at)::date,p_received_at
  )
  returning id into movement_id;

  update public.transactions
  set
    realized_amount=realized_amount+p_amount,
    economic_state=case
      when realized_amount+p_amount=coalesce(confirmed_amount,amount)
        then 'realized'::public.economic_state
      else 'confirmed'::public.economic_state
    end,
    status=case
      when realized_amount+p_amount=coalesce(confirmed_amount,amount)
        then 'received'::public.transaction_state
      else 'pending'::public.transaction_state
    end,
    settled_at=case
      when realized_amount+p_amount=coalesce(confirmed_amount,amount) then p_received_at
      else null
    end,
    updated_at=now()
  where id=tx.id;

  return movement_id;
end $$;

revoke all on function public.settle_income(uuid,uuid,uuid,uuid,numeric,timestamptz) from public,anon;
grant execute on function public.settle_income(uuid,uuid,uuid,uuid,numeric,timestamptz) to authenticated;
