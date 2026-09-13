-- Recorrência de cartão à vista.
--
-- Futuro: a ocorrência permanece forecast e não materializa fatura nem consome
-- limite real. Quando o usuário confirma que a cobrança aconteceu, o MESMO fato
-- recorrente vira despesa econômica realizada e entra na fatura canônica do
-- cartão. O pagamento posterior da fatura continua sendo somente liquidação.

create or replace function public.create_recurring_expense_rule_from_transaction(
  p_household_id uuid,
  p_template_transaction_id uuid,
  p_frequency text,
  p_interval_count integer,
  p_start_date date,
  p_end_date date default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  tx public.transactions;
  instrument public.transaction_payment_instruments;
  rule_id uuid;
begin
  caller:=public.require_active_member(p_household_id);
  select * into tx from public.transactions
   where id=p_template_transaction_id and household_id=p_household_id and type='expense' and deleted_at is null
   for update;
  if tx.id is null or tx.economic_state in ('cancelled','reversed') then
    raise exception 'active household expense template required' using errcode='23514';
  end if;
  if p_frequency not in ('weekly','monthly','yearly') or p_interval_count<1 then
    raise exception 'invalid recurring expense frequency' using errcode='22023';
  end if;
  if p_start_date is null or p_start_date<=tx.transaction_date then
    raise exception 'first recurring occurrence must be after the source expense date' using errcode='22023';
  end if;
  if p_end_date is not null and p_end_date<p_start_date then
    raise exception 'end date must not precede start date' using errcode='22023';
  end if;
  if not exists(select 1 from public.economic_allocations where transaction_id=tx.id) then
    raise exception 'expense template requires explicit economic responsibility' using errcode='23514';
  end if;
  if (select coalesce(sum(percentage),0) from public.economic_allocations where transaction_id=tx.id)<>100 then
    raise exception 'expense template responsibility must total 100 percent' using errcode='23514';
  end if;
  if exists(select 1 from public.economic_allocations where transaction_id=tx.id and responsible_party_id is not null) then
    raise exception 'third-party economic responsibility is not supported for recurring expenses' using errcode='0A000';
  end if;
  if exists(select 1 from public.installment_plans where household_id=p_household_id and purchase_transaction_id=tx.id) then
    raise exception 'installment purchases cannot become recurring series' using errcode='0A000';
  end if;
  if exists(select 1 from public.external_payment_events where household_id=p_household_id and source_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations where household_id=p_household_id and source_transaction_id=tx.id) then
    raise exception 'external payer or obligation requires a dedicated recurring route' using errcode='0A000';
  end if;
  if exists(select 1 from public.financing_allocations where household_id=p_household_id and transaction_id=tx.id and mechanism in ('card_pix','external')) then
    raise exception 'card PIX or external financing cannot become this recurring series' using errcode='0A000';
  end if;

  select * into instrument from public.transaction_payment_instruments
  where household_id=p_household_id and transaction_id=tx.id;
  if instrument.transaction_id is null then
    raise exception 'recurring expense template requires a payment instrument' using errcode='23514';
  end if;

  if instrument.kind='account' then
    if not exists(
      select 1 from public.accounts a
      where a.id=instrument.account_id and a.household_id=p_household_id and a.deactivated_at is null
        and a.type<>'meal_benefit'
    ) then
      if exists(select 1 from public.accounts a where a.id=instrument.account_id and a.household_id=p_household_id and a.type='meal_benefit') then
        raise exception 'benefit expenses cannot become recurring series' using errcode='0A000';
      end if;
      raise exception 'active recurring account required' using errcode='23514';
    end if;
  elsif instrument.kind='card' then
    if not exists(select 1 from public.cards c where c.id=instrument.card_id and c.household_id=p_household_id and c.deactivated_at is null) then
      raise exception 'active recurring card required' using errcode='23514';
    end if;
    if tx.invoice_id is null then
      raise exception 'only a canonical one-time card purchase can become a card recurring series' using errcode='0A000';
    end if;
  else
    raise exception 'unsupported recurring expense instrument' using errcode='0A000';
  end if;

  insert into public.recurring_rules(
    household_id,created_by_member_id,template_transaction_id,frequency,interval_count,start_date,end_date,next_occurrence_date,amount_mode,estimated_amount
  ) values(
    p_household_id,caller.id,tx.id,p_frequency,p_interval_count,p_start_date,p_end_date,p_start_date,
    case when tx.economic_state='forecast' then 'estimated' else 'fixed' end,
    coalesce(tx.confirmed_amount,tx.estimated_amount,tx.amount)
  ) returning id into rule_id;
  return rule_id;
end
$$;

create or replace function public.generate_recurring_occurrence(
  p_household_id uuid,
  p_rule_id uuid,
  p_occurrence_date date
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  rule public.recurring_rules;
  template public.transactions;
  instrument public.transaction_payment_instruments;
  card public.cards;
  dates record;
  existing uuid;
  tx uuid;
  key text:=p_occurrence_date::text;
  estimate numeric;
  projected_due date:=p_occurrence_date;
begin
  caller:=public.require_active_member(p_household_id);
  select * into rule from public.recurring_rules where id=p_rule_id and household_id=p_household_id and deactivated_at is null for update;
  if rule.id is null or p_occurrence_date<rule.start_date or (rule.end_date is not null and p_occurrence_date>rule.end_date) then
    raise exception 'invalid recurring occurrence' using errcode='23514';
  end if;
  select transaction_id into existing from public.recurring_occurrences where recurring_rule_id=p_rule_id and idempotency_key=key;
  if existing is not null then return existing; end if;
  select * into template from public.transactions where id=rule.template_transaction_id and household_id=p_household_id and deleted_at is null;
  if template.id is null then raise exception 'active recurring template required' using errcode='23514'; end if;

  select * into instrument from public.transaction_payment_instruments
  where household_id=p_household_id and transaction_id=template.id;
  if instrument.kind='card' then
    select * into card from public.cards where id=instrument.card_id and household_id=p_household_id;
    if card.id is null then raise exception 'recurring card required' using errcode='23514'; end if;
    select * into dates from public.invoice_dates(card,p_occurrence_date);
    projected_due:=dates.due_date;
  end if;

  estimate:=coalesce(rule.estimated_amount,template.estimated_amount,template.amount);
  insert into public.transactions(
    household_id,created_by_member_id,buyer_member_id,category_id,type,status,economic_state,
    description,amount,estimated_amount,confirmed_amount,realized_amount,
    transaction_date,competence_date,due_date,notes
  ) values(
    p_household_id,caller.id,template.buyer_member_id,template.category_id,template.type,'planned','forecast',
    template.description,estimate,estimate,null,0,
    p_occurrence_date,date_trunc('month',p_occurrence_date)::date,projected_due,template.notes
  ) returning id into tx;

  if template.type='expense' then
    insert into public.transaction_payment_instruments(household_id,transaction_id,kind,account_id,card_id)
      select p_household_id,tx,kind,account_id,card_id from public.transaction_payment_instruments where transaction_id=template.id;
    insert into public.economic_allocations(household_id,transaction_id,responsible_member_id,responsible_party_id,allocation_order,percentage,amount)
      select p_household_id,tx,responsible_member_id,responsible_party_id,allocation_order,percentage,amount from public.economic_allocations where transaction_id=template.id;
    insert into public.transaction_splits(household_id,transaction_id,responsible_member_id,percentage,amount)
      select p_household_id,tx,responsible_member_id,percentage,amount from public.transaction_splits where transaction_id=template.id;
    perform public.rescale_economic_allocations(tx,estimate);
  end if;

  insert into public.recurring_occurrences(
    household_id,recurring_rule_id,transaction_id,competence_date,due_date,status,idempotency_key,estimated_amount
  ) values(
    p_household_id,p_rule_id,tx,p_occurrence_date,projected_due,'planned',key,estimate
  );
  return tx;
end
$$;

create or replace function public.confirm_recurring_card_expense_occurrence(
  p_household_id uuid,
  p_occurrence_id uuid,
  p_confirmed_amount numeric
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  occurrence public.recurring_occurrences;
  tx public.transactions;
  instrument public.transaction_payment_instruments;
  card public.cards;
  dates record;
  invoice uuid;
  event_id uuid;
  event_key text;
begin
  caller:=public.require_active_member(p_household_id);
  select * into occurrence from public.recurring_occurrences
  where id=p_occurrence_id and household_id=p_household_id for update;
  if occurrence.id is null or occurrence.status='cancelled' then
    raise exception 'active recurring expense occurrence required' using errcode='23514';
  end if;

  select * into tx from public.transactions
  where id=occurrence.transaction_id and household_id=p_household_id and type='expense' and deleted_at is null for update;
  if tx.id is null or tx.economic_state not in ('forecast','confirmed') or tx.realized_amount<>0 or tx.invoice_id is not null then
    raise exception 'unrealized uninvoiced recurring card expense required' using errcode='0A000';
  end if;
  if p_confirmed_amount is null or p_confirmed_amount<=0 then
    raise exception 'positive confirmed amount required' using errcode='22023';
  end if;

  select * into instrument from public.transaction_payment_instruments
  where household_id=p_household_id and transaction_id=tx.id and kind='card';
  if instrument.transaction_id is null then
    raise exception 'recurring card payment instrument required' using errcode='23514';
  end if;
  select * into card from public.cards
  where id=instrument.card_id and household_id=p_household_id and deactivated_at is null;
  if card.id is null then raise exception 'active recurring card required' using errcode='23514'; end if;

  if exists(select 1 from public.installment_plans where household_id=p_household_id and purchase_transaction_id=tx.id)
     or exists(select 1 from public.funding_events where household_id=p_household_id and financed_transaction_id=tx.id)
     or exists(select 1 from public.financial_obligations where household_id=p_household_id and source_transaction_id=tx.id)
     or exists(select 1 from public.external_payment_events where household_id=p_household_id and source_transaction_id=tx.id)
     or exists(
       select 1 from public.recurring_rules rr
       join public.financing_allocations fa on fa.transaction_id=rr.template_transaction_id and fa.household_id=rr.household_id
       where rr.id=occurrence.recurring_rule_id and rr.household_id=p_household_id and fa.mechanism='card_pix'
     ) then
    raise exception 'dependent or unsupported card facts require a dedicated route' using errcode='0A000';
  end if;

  select * into dates from public.invoice_dates(card,tx.transaction_date);
  insert into public.card_invoices(household_id,card_id,competence_date,closing_date,due_date,total_amount)
  values(p_household_id,card.id,dates.competence,dates.closing_date,dates.due_date,p_confirmed_amount)
  on conflict(card_id,competence_date) do update
    set total_amount=public.card_invoices.total_amount+excluded.total_amount,updated_at=now()
  returning id into invoice;

  perform public.rescale_economic_allocations(tx.id,p_confirmed_amount);
  event_key:='recurring-card-confirm:'||occurrence.id::text||':'||gen_random_uuid()::text;
  insert into public.transaction_adjustment_events(
    household_id,source_transaction_id,kind,before_payload,after_payload,reason,request_key,created_by_member_id
  ) values (
    p_household_id,tx.id,'correction',
    jsonb_build_object('amount',tx.amount,'economic_state',tx.economic_state,'invoice_id',tx.invoice_id,'recurring_occurrence_id',occurrence.id),
    jsonb_build_object('amount',p_confirmed_amount,'economic_state','realized','invoice_id',invoice,'recurring_occurrence_id',occurrence.id),
    'Cobrança recorrente confirmada no cartão pelo usuário',event_key,caller.id
  ) returning id into event_id;

  update public.transactions
  set amount=p_confirmed_amount,
      confirmed_amount=p_confirmed_amount,
      realized_amount=p_confirmed_amount,
      economic_state='realized',
      status='pending',
      invoice_id=invoice,
      due_date=dates.due_date,
      settled_at=null,
      updated_at=now()
  where id=tx.id;

  update public.recurring_occurrences
  set status='pending',confirmed_amount=p_confirmed_amount,confirmed_at=now(),due_date=dates.due_date,settled_at=null
  where id=occurrence.id;

  return event_id;
end
$$;

create or replace function public.confirm_recurring_card_expense_occurrence_idempotent(
  p_household_id uuid,
  p_occurrence_id uuid,
  p_confirmed_amount numeric,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare result uuid; existing uuid; op constant text:='confirm_recurring_card_expense_occurrence';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then return existing; end if;
  result:=public.confirm_recurring_card_expense_occurrence(p_household_id,p_occurrence_id,p_confirmed_amount);
  perform public.financial_command_store(p_household_id,op,p_request_key,result);
  return result;
end
$$;

-- Atenção operacional: antes da cobrança acontecer, cartão usa a data econômica
-- da ocorrência para pedir confirmação. A data financeira continua disponível
-- separadamente como vencimento projetado da fatura. Depois de confirmada, a
-- ocorrência sai deste centro e passa a ser resolvida pela própria fatura.
create or replace view public.financial_recurring_expense_attention_positions
with (security_invoker=true) as
with base as (
  select c.household_id,c.source_recurring_occurrence_id as occurrence_id,c.source_transaction_id as transaction_id,
         c.source_invoice_id,o.recurring_rule_id,c.description,
         c.effective_amount::numeric(19,2) as expected_amount,c.remaining_amount::numeric(19,2) as remaining_amount,
         case when pi.kind='card' and c.source_invoice_id is null then o.competence_date else c.due_date end as due_date,
         c.due_date as financial_due_date,c.economic_state,c.commitment_state,
         pi.kind as payment_instrument_kind,
         pi.account_id as planned_account_id,a.name as planned_account_name,
         pi.card_id as planned_card_id,card.name as planned_card_name
  from public.financial_commitment_positions c
  join public.recurring_occurrences o on o.id=c.source_recurring_occurrence_id and o.household_id=c.household_id
  left join public.transaction_payment_instruments pi on pi.transaction_id=c.source_transaction_id and pi.household_id=c.household_id
  left join public.accounts a on a.id=pi.account_id and a.household_id=c.household_id and pi.kind='account'
  left join public.cards card on card.id=pi.card_id and card.household_id=c.household_id and pi.kind='card'
  where c.source_type='recurring_occurrence'
    and c.remaining_amount>0
    and c.commitment_state not in ('cancelled','reversed')
    and not (pi.kind='card' and c.source_invoice_id is not null)
)
select household_id,occurrence_id,transaction_id,recurring_rule_id,description,
       expected_amount,remaining_amount,due_date,financial_due_date,economic_state,commitment_state,
       payment_instrument_kind,planned_account_id,planned_account_name,planned_card_id,planned_card_name,
       case when due_date<current_date then 'overdue'
            when due_date=current_date then 'due_today'
            when due_date between current_date+1 and current_date+3 then 'due_soon'
            else 'upcoming' end as attention_state
from base
where due_date<=current_date+7;

comment on view public.financial_recurring_expense_attention_positions is
  'Actionable recurring expenses. Direct account occurrences are acted on by payment date; uninvoiced card occurrences are acted on by expected charge date while retaining their projected invoice due date. Confirmed card charges leave this center and are settled only through the invoice.';

-- Projeções futuras no cartão são expectativas, não consumo real de limite.
-- Elas continuam visíveis em financial_card_future_commitments, mas somente
-- compromissos não-forecast entram na exposição/limite atual do instrumento.
create or replace view public.financial_card_exposure_positions
with (security_invoker=true) as
with invoice_amounts as (
 select household_id,card_id,
   coalesce(sum(remaining_amount) filter(where not is_future_invoice),0)::numeric(19,2) current_invoice_remaining,
   coalesce(sum(remaining_amount) filter(where is_future_invoice),0)::numeric(19,2) future_invoice_remaining,
   coalesce(bool_or(is_overdue),false) has_overdue
 from public.financial_card_invoice_positions
 where state<>'cancelled' and remaining_amount>0
 group by household_id,card_id
), uninvoiced as (
 select household_id,card_id,coalesce(sum(remaining_amount),0)::numeric(19,2) amount
 from public.financial_card_commitment_positions
 where exposure_bucket='future_uninvoiced' and remaining_amount>0 and commitment_state<>'forecast'
 group by household_id,card_id
), amounts as (
 select c.household_id,c.id as card_id,c.owner_member_id,c.name as card_name,
        c.credit_limit,c.default_payment_account_id,
        coalesce(i.current_invoice_remaining,0)::numeric(19,2) as current_invoice_remaining,
        (coalesce(i.future_invoice_remaining,0)+coalesce(u.amount,0))::numeric(19,2) as future_known_commitments,
        (coalesce(i.current_invoice_remaining,0)+coalesce(i.future_invoice_remaining,0)+coalesce(u.amount,0))::numeric(19,2) as total_exposure,
        coalesce(i.has_overdue,false) as has_overdue
 from public.cards c
 left join invoice_amounts i on i.card_id=c.id and i.household_id=c.household_id
 left join uninvoiced u on u.card_id=c.id and u.household_id=c.household_id
 where c.deactivated_at is null
)
select household_id,card_id,owner_member_id,card_name,
       credit_limit::numeric(19,2),default_payment_account_id,
       current_invoice_remaining,future_known_commitments,total_exposure,
       (credit_limit-total_exposure)::numeric(19,2) as available_limit,
       case when credit_limit=0 then case when total_exposure=0 then 0::numeric else null::numeric end
            else round(total_exposure/credit_limit,6) end as utilization_ratio,
       greatest(total_exposure-credit_limit,0)::numeric(19,2) as over_limit_amount,
       has_overdue
from amounts;

comment on view public.financial_card_exposure_positions is
  'Actual instrument-level limit exposure. Forecast card recurrence remains a projection and does not consume current available limit until the charge is confirmed/materialized.';

create or replace view public.financial_member_card_positions
with (security_invoker=true) as
with card_members as (
 select c.household_id,c.id as card_id,m.id as member_id
 from public.cards c
 join public.household_members m on m.household_id=c.household_id and m.deactivated_at is null
 where c.deactivated_at is null
), responsibility as (
 select p.household_id,p.card_id,r.member_id,
   coalesce(sum(r.remaining_responsibility_amount),0)::numeric(19,2) as member_responsibility_exposure,
   coalesce(sum(r.remaining_responsibility_amount) filter(where p.exposure_bucket='current_invoice'),0)::numeric(19,2) as member_current_invoice_responsibility,
   coalesce(sum(r.remaining_responsibility_amount) filter(where p.exposure_bucket in ('future_invoice','future_uninvoiced')),0)::numeric(19,2) as member_future_responsibility
 from public.financial_card_commitment_positions p
 join public.financial_member_commitment_responsibility_positions r
   on r.household_id=p.household_id and r.commitment_key=p.commitment_key
 where r.member_id is not null and p.remaining_amount>0 and p.commitment_state<>'forecast'
 group by p.household_id,p.card_id,r.member_id
)
select cm.household_id,cm.card_id,cm.member_id,e.owner_member_id,
       e.credit_limit,e.total_exposure,e.available_limit,e.utilization_ratio,e.over_limit_amount,
       coalesce(r.member_current_invoice_responsibility,0)::numeric(19,2) as member_current_invoice_responsibility,
       coalesce(r.member_future_responsibility,0)::numeric(19,2) as member_future_responsibility,
       coalesce(r.member_responsibility_exposure,0)::numeric(19,2) as member_responsibility_exposure
from card_members cm
join public.financial_card_exposure_positions e
  on e.household_id=cm.household_id and e.card_id=cm.card_id
left join responsibility r
  on r.household_id=cm.household_id and r.card_id=cm.card_id and r.member_id=cm.member_id;

comment on view public.financial_member_card_positions is
  'Member responsibility inside actual card exposure. Forecast recurring card charges stay projected and do not become current member exposure before confirmation.';

revoke all on function public.create_recurring_expense_rule_from_transaction(uuid,uuid,text,integer,date,date) from public,anon;
revoke all on function public.generate_recurring_occurrence(uuid,uuid,date) from public,anon;
revoke all on function public.confirm_recurring_card_expense_occurrence(uuid,uuid,numeric) from public,anon;
revoke all on function public.confirm_recurring_card_expense_occurrence_idempotent(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.create_recurring_expense_rule_from_transaction(uuid,uuid,text,integer,date,date) to authenticated;
grant execute on function public.generate_recurring_occurrence(uuid,uuid,date) to authenticated;
grant execute on function public.confirm_recurring_card_expense_occurrence(uuid,uuid,numeric) to authenticated;
grant execute on function public.confirm_recurring_card_expense_occurrence_idempotent(uuid,uuid,numeric,text) to authenticated;

revoke all on public.financial_recurring_expense_attention_positions from public,anon;
grant select on public.financial_recurring_expense_attention_positions to authenticated;
revoke all on public.financial_card_exposure_positions from public,anon;
grant select on public.financial_card_exposure_positions to authenticated;
revoke all on public.financial_member_card_positions from public,anon;
grant select on public.financial_member_card_positions to authenticated;

comment on function public.create_recurring_expense_rule_from_transaction(uuid,uuid,text,integer,date,date) is
  'Creates recurring direct-account or one-time-card expense series only. Benefit, installments, card PIX, external payer and third-party responsibility remain unsupported.';
comment on function public.confirm_recurring_card_expense_occurrence(uuid,uuid,numeric) is
  'Confirms that an existing forecast recurring card charge actually happened. The existing transaction becomes economically realized and is attached exactly once to the canonical invoice; no cash or funding is created.';
