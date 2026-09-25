-- Calendário de dias úteis da Release 1.
-- Fonte fixa, auditável e sem dependência de rede: feriados nacionais brasileiros.
-- Não representa feriados estaduais, municipais ou pontos facultativos.

create table if not exists public.brazil_national_holidays (
  holiday_date date primary key,
  name text not null check (length(trim(name)) > 0),
  legal_basis text not null check (length(trim(legal_basis)) > 0),
  created_at timestamptz not null default now()
);

comment on table public.brazil_national_holidays is
  'Reference calendar of Brazilian national holidays. Release 1 covers 2000-01-01 through 2030-12-31; state, municipal and optional public holidays are deliberately excluded.';
comment on column public.brazil_national_holidays.legal_basis is
  'Federal legal source that makes the date a national holiday. It is reference metadata, not a household financial fact.';

alter table public.brazil_national_holidays enable row level security;

drop policy if exists brazil_national_holidays_authenticated_read on public.brazil_national_holidays;
create policy brazil_national_holidays_authenticated_read
  on public.brazil_national_holidays
  for select
  to authenticated
  using (true);

revoke all on table public.brazil_national_holidays from public, anon;
revoke insert, update, delete on table public.brazil_national_holidays from authenticated;
grant select on table public.brazil_national_holidays to authenticated;

with years as (
  select extract(year from d)::integer as year
  from generate_series(date '2000-01-01', date '2030-01-01', interval '1 year') as d
), fixed_holidays(month_number, day_number, holiday_name, holiday_legal_basis) as (
  values
    (1, 1, 'Confraternização Universal', 'Lei nº 662/1949, com redação da Lei nº 10.607/2002'),
    (4, 21, 'Tiradentes', 'Lei nº 662/1949, com redação da Lei nº 10.607/2002'),
    (5, 1, 'Dia Mundial do Trabalho', 'Lei nº 662/1949, com redação da Lei nº 10.607/2002'),
    (9, 7, 'Independência do Brasil', 'Lei nº 662/1949, com redação da Lei nº 10.607/2002'),
    (10, 12, 'Nossa Senhora Aparecida', 'Lei nº 6.802/1980'),
    (11, 15, 'Proclamação da República', 'Lei nº 662/1949, com redação da Lei nº 10.607/2002'),
    (12, 25, 'Natal', 'Lei nº 662/1949, com redação da Lei nº 10.607/2002')
), seeded_holidays as (
  select make_date(y.year, h.month_number, h.day_number) as holiday_date,
         h.holiday_name as name,
         h.holiday_legal_basis as legal_basis
    from years y
    cross join fixed_holidays h

  union all

  select make_date(y.year, 11, 2),
         'Finados',
         'Lei nº 662/1949, com redação da Lei nº 10.607/2002'
    from years y
   where y.year >= 2003

  union all

  select make_date(y.year, 11, 20),
         'Dia Nacional de Zumbi e da Consciência Negra',
         'Lei nº 14.759/2023'
    from years y
   where y.year >= 2024
)
insert into public.brazil_national_holidays(holiday_date, name, legal_basis)
select holiday_date, name, legal_basis
  from seeded_holidays
on conflict (holiday_date) do update
  set name = excluded.name,
      legal_basis = excluded.legal_basis;

create or replace function public.is_brazil_national_business_day(
  p_date date
) returns boolean
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_date is null then
    raise exception 'date is required' using errcode='22004';
  end if;

  if p_date < date '2000-01-01' or p_date > date '2030-12-31' then
    raise exception 'Brazilian national calendar is configured from 2000 through 2030'
      using errcode='22023';
  end if;

  return extract(isodow from p_date) between 1 and 5
    and not exists (
      select 1
        from public.brazil_national_holidays h
       where h.holiday_date = p_date
    );
end
$$;

create or replace function public.adjust_projected_business_date(
  p_date date,
  p_direction text
) returns date
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  candidate date := p_date;
  step integer;
  attempt integer;
begin
  if p_date is null then
    raise exception 'date is required' using errcode='22004';
  end if;

  if p_direction = 'next' then
    step := 1;
  elsif p_direction = 'previous' then
    step := -1;
  else
    raise exception 'business-date direction must be next or previous' using errcode='22023';
  end if;

  for attempt in 0..7 loop
    if public.is_brazil_national_business_day(candidate) then
      return candidate;
    end if;
    candidate := candidate + step;
  end loop;

  raise exception 'national business-date adjustment exceeded seven days' using errcode='22023';
end
$$;

revoke all on function public.is_brazil_national_business_day(date) from public, anon;
revoke all on function public.adjust_projected_business_date(date,text) from public, anon;
grant execute on function public.is_brazil_national_business_day(date) to authenticated;
grant execute on function public.adjust_projected_business_date(date,text) to authenticated;

comment on function public.is_brazil_national_business_day(date) is
  'Returns whether a date is a Brazilian national business day within the Release 1 coverage through 2030. It deliberately excludes regional holidays and optional public holidays.';
comment on function public.adjust_projected_business_date(date,text) is
  'Moves a projected date to the next or previous Brazilian national business day. It is pure and never creates a financial fact, movement, funding or settlement.';

-- Preserve the recurrence anchor (competence_date and transaction_date). Only
-- the planned direct-account settlement date is adjusted. Card dates remain
-- governed by invoice_dates and are intentionally outside this calendar rule.
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

  select * into rule
    from public.recurring_rules
   where id=p_rule_id
     and household_id=p_household_id
     and deactivated_at is null
   for update;
  if rule.id is null
     or p_occurrence_date<rule.start_date
     or (rule.end_date is not null and p_occurrence_date>rule.end_date)
  then
    raise exception 'invalid recurring occurrence' using errcode='23514';
  end if;

  select transaction_id into existing
    from public.recurring_occurrences
   where recurring_rule_id=p_rule_id
     and idempotency_key=key;
  if existing is not null then
    return existing;
  end if;

  select * into template
    from public.transactions
   where id=rule.template_transaction_id
     and household_id=p_household_id
     and deleted_at is null;
  if template.id is null then
    raise exception 'active recurring template required' using errcode='23514';
  end if;

  select * into instrument
    from public.transaction_payment_instruments
   where household_id=p_household_id
     and transaction_id=template.id;
  if instrument.transaction_id is null then
    raise exception 'recurring expense template requires a payment instrument' using errcode='23514';
  end if;

  if instrument.kind='card' then
    select * into card
      from public.cards
     where id=instrument.card_id
       and household_id=p_household_id;
    if card.id is null then
      raise exception 'recurring card required' using errcode='23514';
    end if;

    select * into dates from public.invoice_dates(card,p_occurrence_date);
    projected_due:=dates.due_date;
  elsif instrument.kind='account' then
    projected_due:=public.adjust_projected_business_date(p_occurrence_date,'next');
  else
    raise exception 'unsupported recurring expense instrument' using errcode='0A000';
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
      select p_household_id,tx,kind,account_id,card_id
        from public.transaction_payment_instruments
       where transaction_id=template.id;

    insert into public.economic_allocations(
      household_id,transaction_id,responsible_member_id,responsible_party_id,allocation_order,percentage,amount
    )
      select p_household_id,tx,responsible_member_id,responsible_party_id,allocation_order,percentage,amount
        from public.economic_allocations
       where transaction_id=template.id;

    insert into public.transaction_splits(household_id,transaction_id,responsible_member_id,percentage,amount)
      select p_household_id,tx,responsible_member_id,percentage,amount
        from public.transaction_splits
       where transaction_id=template.id;

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

-- Recurring income preserves its economic date/anchor but exposes the expected
-- receipt on the previous business day when the nominal date is non-business.
create or replace function public.materialize_recurring_income_occurrences(
  p_household_id uuid,
  p_rule_id uuid,
  p_through_date date
) returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  r public.recurring_rules;
  occurrence_date date;
  projected_receipt_date date;
  tx_id uuid;
  created_count integer:=0;
  n integer;
  max_steps integer:=240;
begin
  caller:=public.require_active_member(p_household_id);

  select * into r
    from public.recurring_rules
   where id=p_rule_id
     and household_id=p_household_id
     and deactivated_at is null
   for update;

  if r.id is null
     or r.income_nature is null
     or r.income_beneficiary_member_id is null
     or r.income_destination_account_id is null
     or r.income_economic_state not in ('forecast','confirmed')
  then
    raise exception 'active recurring income rule required' using errcode='23514';
  end if;
  if p_through_date<r.start_date then
    return 0;
  end if;

  for n in 0..max_steps loop
    occurrence_date:=case r.frequency
      when 'monthly' then (r.start_date + make_interval(months=>n*r.interval_count))::date
      when 'yearly' then (r.start_date + make_interval(years=>n*r.interval_count))::date
      else null
    end;

    if occurrence_date is null then
      raise exception 'recurring income supports monthly or yearly frequency' using errcode='22023';
    end if;
    exit when occurrence_date>p_through_date;
    if r.end_date is not null and occurrence_date>r.end_date then
      exit;
    end if;

    if exists(
      select 1
        from public.recurring_occurrences
       where household_id=p_household_id
         and recurring_rule_id=r.id
         and competence_date=occurrence_date
    ) then
      continue;
    end if;

    projected_receipt_date:=public.adjust_projected_business_date(occurrence_date,'previous');

    insert into public.transactions(
      household_id,created_by_member_id,category_id,type,status,economic_state,
      description,amount,estimated_amount,confirmed_amount,realized_amount,
      transaction_date,competence_date,due_date,notes,income_nature
    ) values(
      p_household_id,caller.id,r.income_category_id,'income','pending',r.income_economic_state,
      r.income_description,r.estimated_amount,r.estimated_amount,
      case when r.income_economic_state='confirmed' then r.estimated_amount end,
      0,occurrence_date,date_trunc('month',occurrence_date)::date,projected_receipt_date,r.income_notes,r.income_nature
    ) returning id into tx_id;

    insert into public.money_movements(
      household_id,created_by_member_id,kind,state,amount,description,
      beneficiary_member_id,destination_account_id,category_id,related_transaction_id,
      movement_date,competence_date
    ) values(
      p_household_id,caller.id,'income','projected',r.estimated_amount,r.income_description,
      r.income_beneficiary_member_id,r.income_destination_account_id,r.income_category_id,tx_id,
      projected_receipt_date,date_trunc('month',occurrence_date)::date
    );

    insert into public.recurring_occurrences(
      household_id,recurring_rule_id,transaction_id,competence_date,due_date,status,
      estimated_amount,confirmed_amount,confirmed_at
    ) values(
      p_household_id,r.id,tx_id,occurrence_date,projected_receipt_date,'planned',r.estimated_amount,
      case when r.income_economic_state='confirmed' then r.estimated_amount end,
      case when r.income_economic_state='confirmed' then now() end
    );
    created_count:=created_count+1;
  end loop;

  update public.recurring_rules
     set next_occurrence_date=(
       select min(x.d)
         from (
           select case r.frequency
             when 'monthly' then (r.start_date + make_interval(months=>g*r.interval_count))::date
             else (r.start_date + make_interval(years=>g*r.interval_count))::date
           end as d
             from generate_series(0,max_steps) g
         ) x
        where x.d>p_through_date
          and (r.end_date is null or x.d<=r.end_date)
     ),
         updated_at=now()
   where id=r.id;

  return created_count;
end
$$;

-- Existing open, unrealized recurring facts inside the imported calendar
-- coverage are re-dated in place. No new transaction, movement, funding event,
-- invoice or settlement is created by this migration.
with adjusted as (
  select o.id as occurrence_id,
         public.adjust_projected_business_date(o.competence_date,'next') as projected_due_date
    from public.recurring_occurrences o
    join public.transactions t
      on t.id=o.transaction_id
     and t.household_id=o.household_id
    join public.transaction_payment_instruments pi
      on pi.transaction_id=t.id
     and pi.household_id=t.household_id
   where pi.kind='account'
     and o.status in ('planned','pending')
     and t.type='expense'
     and t.economic_state in ('forecast','confirmed')
     and t.realized_amount=0
     and o.competence_date between date '2000-01-01' and date '2030-12-31'
)
update public.recurring_occurrences o
   set due_date=a.projected_due_date
  from adjusted a
 where o.id=a.occurrence_id;

with adjusted as (
  select o.transaction_id,
         public.adjust_projected_business_date(o.competence_date,'next') as projected_due_date
    from public.recurring_occurrences o
    join public.transactions t
      on t.id=o.transaction_id
     and t.household_id=o.household_id
    join public.transaction_payment_instruments pi
      on pi.transaction_id=t.id
     and pi.household_id=t.household_id
   where pi.kind='account'
     and o.status in ('planned','pending')
     and t.type='expense'
     and t.economic_state in ('forecast','confirmed')
     and t.realized_amount=0
     and o.competence_date between date '2000-01-01' and date '2030-12-31'
)
update public.transactions t
   set due_date=a.projected_due_date,
       updated_at=now()
  from adjusted a
 where t.id=a.transaction_id;

with adjusted as (
  select o.id as occurrence_id,
         public.adjust_projected_business_date(o.competence_date,'previous') as projected_receipt_date
    from public.recurring_occurrences o
    join public.transactions t
      on t.id=o.transaction_id
     and t.household_id=o.household_id
   where o.status='planned'
     and t.type='income'
     and t.economic_state in ('forecast','confirmed')
     and t.realized_amount=0
     and o.competence_date between date '2000-01-01' and date '2030-12-31'
)
update public.recurring_occurrences o
   set due_date=a.projected_receipt_date
  from adjusted a
 where o.id=a.occurrence_id;

with adjusted as (
  select o.transaction_id,
         public.adjust_projected_business_date(o.competence_date,'previous') as projected_receipt_date
    from public.recurring_occurrences o
    join public.transactions t
      on t.id=o.transaction_id
     and t.household_id=o.household_id
   where o.status='planned'
     and t.type='income'
     and t.economic_state in ('forecast','confirmed')
     and t.realized_amount=0
     and o.competence_date between date '2000-01-01' and date '2030-12-31'
)
update public.transactions t
   set due_date=a.projected_receipt_date,
       updated_at=now()
  from adjusted a
 where t.id=a.transaction_id;

with adjusted as (
  select m.id as movement_id,
         public.adjust_projected_business_date(o.competence_date,'previous') as projected_receipt_date
    from public.money_movements m
    join public.recurring_occurrences o
      on o.transaction_id=m.related_transaction_id
     and o.household_id=m.household_id
    join public.transactions t
      on t.id=o.transaction_id
     and t.household_id=o.household_id
   where m.kind='income'
     and m.state='projected'
     and o.status='planned'
     and t.type='income'
     and t.economic_state in ('forecast','confirmed')
     and t.realized_amount=0
     and o.competence_date between date '2000-01-01' and date '2030-12-31'
)
update public.money_movements m
   set movement_date=a.projected_receipt_date
  from adjusted a
 where m.id=a.movement_id;

revoke all on function public.generate_recurring_occurrence(uuid,uuid,date) from public,anon;
revoke all on function public.materialize_recurring_income_occurrences(uuid,uuid,date) from public,anon;
grant execute on function public.generate_recurring_occurrence(uuid,uuid,date) to authenticated;
grant execute on function public.materialize_recurring_income_occurrences(uuid,uuid,date) to authenticated;

comment on function public.generate_recurring_occurrence(uuid,uuid,date) is
  'Creates one forecast recurrence per anchor date. For direct-account expenses only, the planned settlement date moves to the next Brazilian national business day; the economic anchor is preserved and card invoice dates remain unchanged.';
comment on function public.materialize_recurring_income_occurrences(uuid,uuid,date) is
  'Creates one forecast income occurrence per anchor date. The expected receipt moves to the previous Brazilian national business day, while the economic anchor remains unchanged and no realized cash is created.';
