-- Etapa 10AT: perdão de dívida a pagar.
-- O credor abriu mão de um passivo que existia de verdade. Isso reduz a obrigação e
-- reconhece um ganho econômico, mas NÃO simula pagamento, funding ou saída/entrada de caixa.

create table if not exists public.payable_forgiveness_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  obligation_id uuid not null references public.financial_obligations(id) on delete restrict,
  economic_transaction_id uuid not null references public.transactions(id) on delete restrict,
  amount numeric(19,2) not null check (amount > 0),
  forgiven_date date not null,
  request_key text not null check (length(trim(request_key)) > 0),
  notes text,
  created_by_member_id uuid not null references public.household_members(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (household_id, request_key)
);

comment on table public.payable_forgiveness_events is
  'Immutable history of payable debt forgiveness. Forgiveness reduces a real liability and recognizes economic gain, but never creates cash or funding.';

alter table public.payable_forgiveness_events enable row level security;
drop policy if exists payable_forgiveness_events_select_active_member on public.payable_forgiveness_events;
create policy payable_forgiveness_events_select_active_member
  on public.payable_forgiveness_events for select to authenticated
  using (public.is_active_household_member(household_id));
revoke all on public.payable_forgiveness_events from public,anon;
grant select on public.payable_forgiveness_events to authenticated;

create or replace function public.forgive_payable_obligation(
  p_household_id uuid,
  p_obligation_id uuid,
  p_amount numeric,
  p_forgiven_date date,
  p_allocations jsonb,
  p_request_key text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  obligation public.financial_obligations;
  already_reduced numeric;
  gain_tx uuid;
  event_id uuid;
  existing public.payable_forgiveness_events;
  allocation jsonb;
  allocation_sum numeric:=0;
  percentage_sum numeric:=0;
  allocation_order integer:=0;
begin
  caller:=public.require_active_member(p_household_id);

  if p_amount is null or p_amount<=0 or p_forgiven_date is null
     or length(trim(coalesce(p_request_key,'')))=0
     or jsonb_typeof(coalesce(p_allocations,'[]'::jsonb))<>'array'
  then
    raise exception 'invalid payable forgiveness command' using errcode='22023';
  end if;

  select * into existing
  from public.payable_forgiveness_events
  where household_id=p_household_id and request_key=trim(p_request_key);
  if existing.id is not null then
    if existing.obligation_id<>p_obligation_id
       or existing.amount<>p_amount
       or existing.forgiven_date<>p_forgiven_date
    then
      raise exception 'idempotency key already used with different payload' using errcode='23505';
    end if;
    return existing.id;
  end if;

  select * into obligation
  from public.financial_obligations
  where id=p_obligation_id and household_id=p_household_id
  for update;

  select coalesce(sum(amount),0) into already_reduced
  from public.obligation_events
  where obligation_id=p_obligation_id and kind in ('receipt','payment','cancellation','write_off');

  if obligation.id is null
     or obligation.kind<>'payable'
     or obligation.state in ('settled','cancelled','written_off')
     or already_reduced+p_amount>obligation.original_amount
  then
    raise exception 'invalid payable forgiveness' using errcode='23514';
  end if;

  if jsonb_array_length(coalesce(p_allocations,'[]'::jsonb))=0 then
    raise exception 'forgiveness requires explicit beneficiary allocations' using errcode='23514';
  end if;

  for allocation in select value from jsonb_array_elements(p_allocations)
  loop
    if not (allocation ? 'member_id')
       or (allocation->>'member_id') is null
       or (allocation->>'amount') is null
       or (allocation->>'percentage') is null
    then
      raise exception 'each forgiveness allocation requires member_id, amount and percentage' using errcode='23514';
    end if;
    if not exists(
      select 1 from public.household_members
      where id=(allocation->>'member_id')::uuid and household_id=p_household_id and deactivated_at is null
    ) then
      raise exception 'forgiveness beneficiary must be an active household member' using errcode='23514';
    end if;
    allocation_sum:=allocation_sum+(allocation->>'amount')::numeric;
    percentage_sum:=percentage_sum+(allocation->>'percentage')::numeric;
  end loop;

  if allocation_sum<>p_amount or percentage_sum<>100 then
    raise exception 'forgiveness allocations must equal amount and 100 percent' using errcode='23514';
  end if;

  insert into public.transactions(
    household_id,created_by_member_id,type,status,economic_state,description,
    amount,estimated_amount,confirmed_amount,realized_amount,transaction_date,
    competence_date,settled_at,notes
  ) values (
    p_household_id,caller.id,'income','received','realized','Perdão de dívida: '||obligation.description,
    p_amount,p_amount,p_amount,p_amount,p_forgiven_date,date_trunc('month',p_forgiven_date)::date,
    p_forgiven_date::timestamptz,p_notes
  ) returning id into gain_tx;

  insert into public.transaction_components(household_id,transaction_id,kind,amount)
  values(p_household_id,gain_tx,'other',p_amount);

  for allocation in select value from jsonb_array_elements(p_allocations)
  loop
    allocation_order:=allocation_order+1;
    insert into public.economic_allocations(
      household_id,transaction_id,responsible_member_id,allocation_order,percentage,amount
    ) values (
      p_household_id,gain_tx,(allocation->>'member_id')::uuid,allocation_order,
      (allocation->>'percentage')::numeric,(allocation->>'amount')::numeric
    );
  end loop;

  insert into public.obligation_events(
    household_id,obligation_id,created_by_member_id,kind,amount,economic_transaction_id,occurred_at,notes
  ) values (
    p_household_id,obligation.id,caller.id,'write_off',p_amount,gain_tx,p_forgiven_date::timestamptz,p_notes
  ) returning id into event_id;

  update public.financial_obligations
  set state=case when already_reduced+p_amount=original_amount then 'written_off' else 'partially_settled' end,
      closed_at=case when already_reduced+p_amount=original_amount then p_forgiven_date::timestamptz else null end,
      updated_at=now()
  where id=obligation.id;

  insert into public.payable_forgiveness_events(
    household_id,obligation_id,economic_transaction_id,amount,forgiven_date,request_key,notes,created_by_member_id
  ) values (
    p_household_id,obligation.id,gain_tx,p_amount,p_forgiven_date,trim(p_request_key),p_notes,caller.id
  ) returning id into event_id;

  -- Deliberadamente sem money_movements e sem funding_events: perdão não é pagamento.
  return event_id;
end
$$;

comment on function public.forgive_payable_obligation(uuid,uuid,numeric,date,jsonb,text,text) is
  'Writes off an existing payable because the creditor forgave it. Recognizes one realized economic gain with explicit member allocation and no cash/funding.';

revoke all on function public.forgive_payable_obligation(uuid,uuid,numeric,date,jsonb,text,text) from public,anon;
grant execute on function public.forgive_payable_obligation(uuid,uuid,numeric,date,jsonb,text,text) to authenticated;
