-- Etapa 10T: comando atomico para principal de emprestimo.
-- Principal nunca e reconhecido como renda ou despesa; juros/taxas/perdas ficam fora deste fluxo.

create or replace function public.create_loan_principal(
  p_household_id uuid,
  p_direction text,
  p_counterparty_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_occurred_at date,
  p_due_date date default null,
  p_description text default 'Empréstimo',
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  obligation_id uuid;
  obligation_kind public.obligation_kind;
begin
  caller:=public.require_active_member(p_household_id);

  if p_direction not in ('granted','taken') then
    raise exception 'loan direction must be granted or taken' using errcode='22023';
  end if;
  if p_amount<=0 or length(trim(coalesce(p_description,'')))=0 then
    raise exception 'positive amount and description are required' using errcode='22023';
  end if;
  if p_due_date is not null and p_due_date<p_occurred_at then
    raise exception 'due date cannot precede loan date' using errcode='22023';
  end if;
  if not exists(
    select 1 from public.financial_parties
    where id=p_counterparty_id and household_id=p_household_id and deactivated_at is null
  ) then
    raise exception 'active household counterparty required' using errcode='23514';
  end if;
  if not exists(
    select 1 from public.accounts
    where id=p_account_id
      and household_id=p_household_id
      and deactivated_at is null
      and type in ('cash','checking','savings','digital_wallet')
      and resource_restriction is null
  ) then
    raise exception 'active unrestricted transactional household account required' using errcode='23514';
  end if;

  obligation_kind:=case when p_direction='granted' then 'receivable'::public.obligation_kind else 'payable'::public.obligation_kind end;

  insert into public.financial_obligations(
    household_id,created_by_member_id,kind,origin_kind,counterparty_id,
    original_amount,obligation_date,due_date,description,notes
  ) values(
    p_household_id,caller.id,obligation_kind,'loan',p_counterparty_id,
    p_amount,p_occurred_at,p_due_date,trim(p_description),nullif(trim(coalesce(p_notes,'')),'')
  ) returning id into obligation_id;

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,
    source_account_id,destination_account_id,counterparty_id,obligation_id,
    movement_date,competence_date,notes,realized_at
  ) values(
    p_household_id,caller.id,'loan_principal','realized',p_amount,trim(p_description),
    case when p_direction='granted' then p_account_id end,
    case when p_direction='taken' then p_account_id end,
    p_counterparty_id,obligation_id,
    p_occurred_at,date_trunc('month',p_occurred_at)::date,nullif(trim(coalesce(p_notes,'')),''),p_occurred_at::timestamptz
  );

  return obligation_id;
end
$$;

revoke all on function public.create_loan_principal(uuid,text,uuid,uuid,numeric,date,date,text,text) from public,anon;
grant execute on function public.create_loan_principal(uuid,text,uuid,uuid,numeric,date,date,text,text) to authenticated;

comment on function public.create_loan_principal(uuid,text,uuid,uuid,numeric,date,date,text,text) is
  'Creates loan principal atomically as obligation plus cash movement. granted => receivable + cash out; taken => payable + cash in. Principal is economically neutral.';
