-- Etapa 10H.4: fundacao minima do Motor Financeiro v2.
-- Forward-only: migrations 001-021 permanecem imutaveis.

alter table public.accounts
  add column if not exists overdraft_enabled boolean not null default false,
  add column if not exists overdraft_limit numeric(19,2) not null default 0;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.accounts'::regclass
       and conname = 'accounts_overdraft_limit_nonnegative'
  ) then
    alter table public.accounts
      add constraint accounts_overdraft_limit_nonnegative check (overdraft_limit >= 0);
  end if;
end
$$;

comment on column public.accounts.overdraft_enabled is
  'Whether emergency overdraft credit is enabled. Overdraft is credit and never increases the account balance.';
comment on column public.accounts.overdraft_limit is
  'Contracted overdraft credit limit. It is not cash and must not be added to current balance or the main projection.';

-- Returns one applicable economic total. Versioned amounts are alternatives,
-- never additive. The fallback preserves compatibility with legacy `amount`.
create or replace function public.financial_effective_total_amount(
  p_economic_state public.economic_state,
  p_estimated_amount numeric,
  p_confirmed_amount numeric,
  p_realized_amount numeric,
  p_fallback_amount numeric default null
)
returns numeric
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select case
    when p_economic_state in ('cancelled', 'reversed') then 0::numeric
    when coalesce(p_realized_amount, 0) > 0
      and coalesce(p_realized_amount, 0) >= coalesce(
        p_confirmed_amount,
        p_estimated_amount,
        p_fallback_amount,
        p_realized_amount,
        0
      )
      then p_realized_amount
    else coalesce(
      p_confirmed_amount,
      p_estimated_amount,
      p_fallback_amount,
      p_realized_amount,
      0
    )
  end
$$;

comment on function public.financial_effective_total_amount(public.economic_state,numeric,numeric,numeric,numeric) is
  'Applicable economic total: completed realization, otherwise confirmation, otherwise estimate/legacy amount; cancelled and reversed events return zero.';

create or replace function public.financial_remaining_amount(
  p_economic_state public.economic_state,
  p_estimated_amount numeric,
  p_confirmed_amount numeric,
  p_realized_amount numeric,
  p_fallback_amount numeric default null
)
returns numeric
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select greatest(
    public.financial_effective_total_amount(
      p_economic_state,
      p_estimated_amount,
      p_confirmed_amount,
      p_realized_amount,
      p_fallback_amount
    ) - coalesce(p_realized_amount, 0),
    0::numeric
  )
$$;

comment on function public.financial_remaining_amount(public.economic_state,numeric,numeric,numeric,numeric) is
  'Unrealized portion of the applicable economic total, clamped at zero; cancelled and reversed events return zero.';

revoke all on function public.financial_effective_total_amount(public.economic_state,numeric,numeric,numeric,numeric) from public, anon;
revoke all on function public.financial_remaining_amount(public.economic_state,numeric,numeric,numeric,numeric) from public, anon;
grant execute on function public.financial_effective_total_amount(public.economic_state,numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.financial_remaining_amount(public.economic_state,numeric,numeric,numeric,numeric) to authenticated;

-- Same public contract and security boundary as migration 020. Only the state
-- transition changes: partial realization remains confirmed until fully funded.
create or replace function public.settle_direct_expense(p_household_id uuid,p_transaction_id uuid,p_source_account_id uuid,p_funder_member_id uuid,p_amount numeric,p_paid_at timestamptz default now())
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  caller public.household_members;
  tx public.transactions;
  payment_tx uuid;
  movement_id uuid;
  already numeric;
  applicable_amount numeric;
  new_realized_amount numeric;
begin
  caller:=public.require_active_member(p_household_id);
  select * into tx from public.transactions where id=p_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null for update;
  if tx.id is null or tx.economic_state in ('cancelled','reversed') or p_amount<=0 then raise exception 'active expense and positive amount required' using errcode='23514'; end if;
  if not exists(select 1 from public.accounts where id=p_source_account_id and household_id=p_household_id and deactivated_at is null) or not exists(select 1 from public.household_members where id=p_funder_member_id and household_id=p_household_id and deactivated_at is null) then raise exception 'source account and funder must belong to household' using errcode='23514'; end if;
  select coalesce(sum(amount),0) into already from public.funding_events where financed_transaction_id=tx.id and invoice_id is null;
  applicable_amount:=public.financial_effective_total_amount(tx.economic_state,tx.estimated_amount,tx.confirmed_amount,tx.realized_amount,tx.amount);
  new_realized_amount:=already+p_amount;
  if new_realized_amount>applicable_amount then raise exception 'expense funding exceeds economic amount' using errcode='23514'; end if;
  insert into public.transactions(household_id,created_by_member_id,type,status,economic_state,description,amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,competence_date,settled_at)
  values(p_household_id,caller.id,'adjustment','paid','realized','Liquidação: '||tx.description,p_amount,p_amount,p_amount,p_amount,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at) returning id into payment_tx;
  insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,source_account_id,related_transaction_id,movement_date,competence_date,realized_at)
  values(p_household_id,caller.id,'expense_payment','realized',p_amount,tx.description,p_source_account_id,tx.id,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at) returning id into movement_id;
  insert into public.funding_events(household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,amount,funded_at) values(p_household_id,tx.id,payment_tx,p_funder_member_id,p_source_account_id,p_amount,p_paid_at);
  update public.transactions
     set realized_amount=new_realized_amount,
         economic_state=case when new_realized_amount=applicable_amount then 'realized'::public.economic_state else 'confirmed'::public.economic_state end,
         status=case when new_realized_amount=applicable_amount then 'paid'::public.transaction_state else 'pending'::public.transaction_state end,
         settled_at=case when new_realized_amount=applicable_amount then p_paid_at else null end,
         updated_at=now()
   where id=tx.id;
  return movement_id;
end $$;

revoke all on function public.settle_direct_expense(uuid,uuid,uuid,uuid,numeric,timestamptz) from public,anon;
grant execute on function public.settle_direct_expense(uuid,uuid,uuid,uuid,numeric,timestamptz) to authenticated;
