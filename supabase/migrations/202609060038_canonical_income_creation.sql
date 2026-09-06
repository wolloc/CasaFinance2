-- Etapa 10V: criacao canonica de renda verdadeira.
-- Renda futura declara natureza, beneficiario e destino previsto sem antecipar caixa realizado.

do $$ begin
  create type public.income_nature as enum ('salary','rent','freelance','bonus','gift','interest_yield','other_true_income');
exception when duplicate_object then null; end $$;

alter table public.transactions add column if not exists income_nature public.income_nature;
comment on column public.transactions.income_nature is
  'Natureza explicita apenas para renda verdadeira. Fluxos neutros como transferencia, recebivel, emprestimo, acerto, refund e resgate usam seus motores proprios.';

create or replace function public.create_income_fact(
  p_household_id uuid,
  p_description text,
  p_amount numeric,
  p_expected_date date,
  p_category_id uuid,
  p_beneficiary_member_id uuid,
  p_planned_destination_account_id uuid,
  p_income_nature public.income_nature,
  p_economic_state public.economic_state default 'forecast',
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx_id uuid;
begin
  caller:=public.require_active_member(p_household_id);

  if p_amount<=0 or length(trim(coalesce(p_description,'')))=0 or p_expected_date is null then
    raise exception 'positive amount, description and expected date are required' using errcode='22023';
  end if;
  if p_income_nature is null then
    raise exception 'income nature is required' using errcode='22004';
  end if;
  if p_economic_state not in ('forecast','confirmed') then
    raise exception 'income creation state must be forecast or confirmed' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.categories
    where id=p_category_id and household_id=p_household_id and type='income' and deactivated_at is null
  ) then
    raise exception 'active household income category required' using errcode='23514';
  end if;
  if not exists(
    select 1 from public.household_members
    where id=p_beneficiary_member_id and household_id=p_household_id and deactivated_at is null
  ) then
    raise exception 'active household beneficiary required' using errcode='23514';
  end if;
  if not exists(
    select 1 from public.accounts
    where id=p_planned_destination_account_id
      and household_id=p_household_id
      and deactivated_at is null
      and type in ('cash','checking','savings','digital_wallet')
      and resource_restriction is null
  ) then
    raise exception 'active unrestricted transactional destination required' using errcode='23514';
  end if;

  insert into public.transactions(
    household_id,created_by_member_id,category_id,type,status,economic_state,
    description,amount,estimated_amount,confirmed_amount,realized_amount,
    transaction_date,competence_date,notes,income_nature
  ) values(
    p_household_id,caller.id,p_category_id,'income','pending',p_economic_state,
    trim(p_description),p_amount,
    p_amount,
    case when p_economic_state='confirmed' then p_amount end,
    0,
    p_expected_date,date_trunc('month',p_expected_date)::date,
    nullif(trim(coalesce(p_notes,'')),''),p_income_nature
  ) returning id into tx_id;

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,
    beneficiary_member_id,destination_account_id,category_id,related_transaction_id,
    movement_date,competence_date
  ) values(
    p_household_id,caller.id,'income','projected',p_amount,trim(p_description),
    p_beneficiary_member_id,p_planned_destination_account_id,p_category_id,tx_id,
    p_expected_date,date_trunc('month',p_expected_date)::date
  );

  return tx_id;
end
$$;

revoke all on function public.create_income_fact(uuid,text,numeric,date,uuid,uuid,uuid,public.income_nature,public.economic_state,text) from public,anon;
grant execute on function public.create_income_fact(uuid,text,numeric,date,uuid,uuid,uuid,public.income_nature,public.economic_state,text) to authenticated;

comment on function public.create_income_fact(uuid,text,numeric,date,uuid,uuid,uuid,public.income_nature,public.economic_state,text) is
  'Creates true income as one economic fact plus one projected cash leg. Beneficiary and planned destination are explicit; no realized cash is created.';