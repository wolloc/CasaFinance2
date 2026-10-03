-- Go-live etapa 1: posição inicial auditável e compromissos históricos de cartão.
-- Nenhuma posição de abertura cria renda, despesa, funding ou movimento de caixa.
-- Migrations anteriores permanecem imutáveis; esta evolução é estritamente forward-only.

alter table public.households
  add column if not exists financial_tracking_started_on date;

comment on column public.households.financial_tracking_started_on is
  'Data de corte a partir da qual relatórios representam o controle financeiro do usuário; posições anteriores são abertura, não renda/despesa nova.';

alter table public.card_invoices
  add column if not exists opening_settled_amount numeric(19,2) not null default 0;

alter table public.installments
  add column if not exists opening_settled_amount numeric(19,2) not null default 0;

alter table public.card_invoices
  drop constraint if exists card_invoices_opening_settled_amount_valid;
alter table public.card_invoices
  add constraint card_invoices_opening_settled_amount_valid
  check (opening_settled_amount >= 0 and opening_settled_amount <= total_amount);

alter table public.installments
  drop constraint if exists installments_opening_settled_amount_valid;
alter table public.installments
  add constraint installments_opening_settled_amount_valid
  check (opening_settled_amount >= 0 and opening_settled_amount <= amount);

comment on column public.card_invoices.opening_settled_amount is
  'Parte da fatura já liquidada antes da data de corte. Não é pagamento nem funding registrado no período controlado.';
comment on column public.installments.opening_settled_amount is
  'Parcela histórica já liquidada antes da data de corte. Não cria money_movement ou funding_event.';

create or replace function public.set_household_financial_tracking_start(
  p_household_id uuid,
  p_started_on date
) returns date
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare current_start date;
begin
  perform public.require_active_member(p_household_id);
  if p_started_on is null or p_started_on>current_date then
    raise exception 'financial tracking start must be today or earlier' using errcode='22023';
  end if;
  select financial_tracking_started_on into current_start
  from public.households where id=p_household_id and deleted_at is null for update;
  if not found then raise exception 'active household required' using errcode='23514'; end if;
  if current_start is not null and current_start<>p_started_on then
    raise exception 'financial tracking start is immutable after configuration' using errcode='23514';
  end if;
  update public.households
     set financial_tracking_started_on=coalesce(financial_tracking_started_on,p_started_on),
         updated_at=now()
   where id=p_household_id
  returning financial_tracking_started_on into current_start;
  return current_start;
end
$$;

create or replace function public.create_account_with_opening_position(
  p_household_id uuid,
  p_name text,
  p_type public.account_kind,
  p_institution text,
  p_owner_member_ids uuid[],
  p_opening_amount numeric,
  p_effective_date date,
  p_resource_restriction text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare caller public.household_members; account_id uuid; owner_count integer;
begin
  caller:=public.require_active_member(p_household_id);
  if nullif(trim(p_name),'') is null or p_opening_amount is null or p_effective_date is null then
    raise exception 'account name, opening amount and effective date are required' using errcode='22023';
  end if;
  perform public.set_household_financial_tracking_start(p_household_id,p_effective_date);
  owner_count:=coalesce(array_length(p_owner_member_ids,1),0);
  if owner_count<1 or owner_count>2
     or (select count(distinct member_id) from unnest(p_owner_member_ids) member_id)<>owner_count
     or exists(
       select 1 from unnest(p_owner_member_ids) member_id
       where not exists(
         select 1 from public.household_members m
         where m.id=member_id and m.household_id=p_household_id and m.deactivated_at is null
       )
     ) then
    raise exception 'one or two active household owners are required' using errcode='23514';
  end if;
  if p_resource_restriction is not null
     and p_resource_restriction not in ('meal_benefit','reserve') then
    raise exception 'invalid account resource restriction' using errcode='22023';
  end if;
  if p_type='meal_benefit'::public.account_kind
     and coalesce(p_resource_restriction,'meal_benefit')<>'meal_benefit' then
    raise exception 'meal benefit must remain restricted' using errcode='23514';
  end if;

  insert into public.accounts(
    household_id,owner_member_id,name,type,institution,opening_balance,opened_at,resource_restriction
  ) values(
    p_household_id,
    case when owner_count=1 then p_owner_member_ids[1] else null end,
    trim(p_name),p_type,nullif(trim(coalesce(p_institution,'')),''),0,null,
    case when p_type='meal_benefit'::public.account_kind then 'meal_benefit' else p_resource_restriction end
  ) returning id into account_id;

  insert into public.account_ownerships(account_id,household_id,member_id)
  select account_id,p_household_id,member_id from unnest(p_owner_member_ids) member_id;

  insert into public.account_balance_events(
    household_id,account_id,created_by_member_id,kind,amount,effective_date,description
  ) values(
    p_household_id,account_id,caller.id,'opening',p_opening_amount,p_effective_date,'Posição inicial'
  );
  return account_id;
end
$$;

create or replace function public.create_account_with_opening_position_idempotent(
  p_household_id uuid,
  p_name text,
  p_type public.account_kind,
  p_institution text,
  p_owner_member_ids uuid[],
  p_opening_amount numeric,
  p_effective_date date,
  p_resource_restriction text,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare existing uuid; result uuid; op constant text:='create_account_with_opening_position';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then return existing; end if;
  result:=public.create_account_with_opening_position(
    p_household_id,p_name,p_type,p_institution,p_owner_member_ids,p_opening_amount,p_effective_date,p_resource_restriction
  );
  perform public.financial_command_store(p_household_id,op,p_request_key,result);
  return result;
end
$$;

create or replace function public.record_opening_card_purchase(
  p_household_id uuid,
  p_card_id uuid,
  p_description text,
  p_original_purchase_date date,
  p_amount numeric,
  p_category_id uuid,
  p_buyer_member_id uuid,
  p_splits jsonb,
  p_installment_count integer,
  p_paid_installment_count integer,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare tracking_start date; tx_id uuid; plan_id uuid; row_installment record; invoice_id uuid;
begin
  perform public.require_active_member(p_household_id);
  select financial_tracking_started_on into tracking_start
    from public.households where id=p_household_id and deleted_at is null for update;
  if tracking_start is null then raise exception 'financial tracking start must be configured before opening card positions' using errcode='23514'; end if;
  if p_original_purchase_date is null or p_original_purchase_date>=tracking_start
     or p_amount is null or p_amount<=0 or nullif(trim(p_description),'') is null
     or p_installment_count is null or p_installment_count<1
     or p_paid_installment_count is null or p_paid_installment_count<0 or p_paid_installment_count>p_installment_count
     or (p_installment_count=1 and p_paid_installment_count not in (0,1)) then
    raise exception 'invalid historical card purchase opening' using errcode='22023';
  end if;
  if not exists(select 1 from public.cards where id=p_card_id and household_id=p_household_id and deactivated_at is null) then
    raise exception 'active household card required' using errcode='23514';
  end if;

  tx_id:=public.create_financial_transaction(
    p_household_id,'expense',trim(p_description),p_amount,p_original_purchase_date,p_category_id,p_buyer_member_id,
    'card',null,p_card_id,p_splits,p_installment_count,p_notes
  );

  if p_installment_count=1 then
    if p_paid_installment_count=1 then
      select invoice_id into invoice_id from public.transactions where id=tx_id;
      update public.card_invoices
         set opening_settled_amount=opening_settled_amount+p_amount,
             status=case when settled_amount+opening_settled_amount+p_amount>=total_amount then 'paid' else status end,
             settled_at=null,
             updated_at=now()
       where id=invoice_id and household_id=p_household_id;
    end if;
  else
    select id into plan_id from public.installment_plans
      where household_id=p_household_id and purchase_transaction_id=tx_id;
    for row_installment in
      select i.id,i.invoice_id,i.number,i.amount from public.installments i
       where i.household_id=p_household_id and i.installment_plan_id=plan_id and i.number<=p_paid_installment_count
       order by i.number
    loop
      update public.installments
         set opening_settled_amount=amount,status='paid',settled_at=null
       where id=row_installment.id;
      update public.card_invoices
         set opening_settled_amount=opening_settled_amount+row_installment.amount,
             status=case when settled_amount+opening_settled_amount+row_installment.amount>=total_amount then 'paid' else status end,
             settled_at=null,
             updated_at=now()
       where id=row_installment.invoice_id and household_id=p_household_id;
    end loop;
  end if;
  return tx_id;
end
$$;

create or replace function public.record_opening_card_purchase_idempotent(
  p_household_id uuid,
  p_card_id uuid,
  p_description text,
  p_original_purchase_date date,
  p_amount numeric,
  p_category_id uuid,
  p_buyer_member_id uuid,
  p_splits jsonb,
  p_installment_count integer,
  p_paid_installment_count integer,
  p_notes text,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare existing uuid; result uuid; op constant text:='record_opening_card_purchase';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then return existing; end if;
  result:=public.record_opening_card_purchase(
    p_household_id,p_card_id,p_description,p_original_purchase_date,p_amount,p_category_id,p_buyer_member_id,
    p_splits,p_installment_count,p_paid_installment_count,p_notes
  );
  perform public.financial_command_store(p_household_id,op,p_request_key,result);
  return result;
end
$$;

create or replace function public.record_opening_card_balance_adjustment(
  p_household_id uuid,
  p_card_id uuid,
  p_amount numeric,
  p_description text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare caller public.household_members; tracking_start date; card public.cards; dates record; invoice_id uuid; tx_id uuid;
begin
  caller:=public.require_active_member(p_household_id);
  select financial_tracking_started_on into tracking_start
    from public.households where id=p_household_id and deleted_at is null for update;
  if tracking_start is null then raise exception 'financial tracking start must be configured before opening card positions' using errcode='23514'; end if;
  if p_amount is null or p_amount<=0 or nullif(trim(p_description),'') is null then
    raise exception 'positive opening card balance and description are required' using errcode='22023';
  end if;
  select * into card from public.cards where id=p_card_id and household_id=p_household_id and deactivated_at is null for update;
  if card.id is null then raise exception 'active household card required' using errcode='23514'; end if;
  select * into dates from public.invoice_dates(card,tracking_start);
  insert into public.card_invoices(household_id,card_id,competence_date,closing_date,due_date,total_amount)
  values(p_household_id,p_card_id,dates.competence,dates.closing_date,dates.due_date,p_amount)
  on conflict(card_id,competence_date) do update
    set total_amount=public.card_invoices.total_amount+excluded.total_amount,updated_at=now()
  returning id into invoice_id;
  insert into public.transactions(
    household_id,created_by_member_id,invoice_id,type,status,economic_state,
    description,amount,estimated_amount,confirmed_amount,realized_amount,
    transaction_date,competence_date,due_date,notes
  ) values(
    p_household_id,caller.id,invoice_id,'adjustment','pending','confirmed',
    trim(p_description),p_amount,p_amount,p_amount,0,
    tracking_start,dates.competence,dates.due_date,'Posição inicial agregada do cartão'
  ) returning id into tx_id;
  return tx_id;
end
$$;

create or replace function public.record_opening_card_balance_adjustment_idempotent(
  p_household_id uuid,
  p_card_id uuid,
  p_amount numeric,
  p_description text,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare existing uuid; result uuid; op constant text:='record_opening_card_balance_adjustment';
begin
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then return existing; end if;
  result:=public.record_opening_card_balance_adjustment(p_household_id,p_card_id,p_amount,p_description);
  perform public.financial_command_store(p_household_id,op,p_request_key,result);
  return result;
end
$$;

CREATE OR REPLACE FUNCTION public.pay_card_invoice(p_household_id uuid, p_invoice_id uuid, p_source_account_id uuid, p_funder_member_id uuid, p_amount numeric, p_paid_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare caller public.household_members; inv public.card_invoices; payment_tx uuid; movement uuid; purchase record; allocation numeric; remaining numeric;
begin
 caller:=public.require_active_member(p_household_id); select * into inv from public.card_invoices where id=p_invoice_id and household_id=p_household_id and deleted_at is null for update;
 if inv.id is null or p_amount<=0 or inv.settled_amount+inv.opening_settled_amount+p_amount>inv.total_amount then raise exception 'invalid invoice payment' using errcode='23514'; end if;
 if not exists(select 1 from public.household_members where id=p_funder_member_id and household_id=p_household_id and deactivated_at is null) then raise exception 'funder must be active in household' using errcode='23514'; end if;
 insert into public.transactions(household_id,created_by_member_id,type,status,description,amount,transaction_date,competence_date,settled_at) values(p_household_id,caller.id,'invoice_payment','paid','Pagamento de fatura',p_amount,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at) returning id into payment_tx;
 insert into public.money_movements(household_id,created_by_member_id,kind,state,amount,description,source_account_id,invoice_id,movement_date,competence_date,realized_at) values(p_household_id,caller.id,'invoice_payment','realized',p_amount,'Pagamento de fatura',p_source_account_id,p_invoice_id,p_paid_at::date,date_trunc('month',p_paid_at)::date,p_paid_at) returning id into movement;
 insert into public.card_invoice_payments(household_id,invoice_id,payment_transaction_id,source_account_id,amount,paid_at) values(p_household_id,p_invoice_id,payment_tx,p_source_account_id,p_amount,p_paid_at);
 remaining:=p_amount;
 -- Cada parcela e uma unidade de alocacao independente. Assim, funding de uma
 -- fatura anterior da mesma compra nunca reduz o saldo financiavel desta fatura.
 for purchase in
   select t.id, null::uuid installment_id, t.amount, t.created_at, 0::numeric opening_settled_amount
     from public.transactions t
    where t.invoice_id=p_invoice_id and t.household_id=p_household_id and t.deleted_at is null
   union all
   select t.id, ins.id, ins.amount, t.created_at, ins.opening_settled_amount
     from public.installments ins
     join public.installment_plans ip on ip.id=ins.installment_plan_id and ip.household_id=p_household_id
     join public.transactions t on t.id=ip.purchase_transaction_id and t.household_id=p_household_id and t.deleted_at is null
    where ins.invoice_id=p_invoice_id and ins.household_id=p_household_id
   order by created_at,id,installment_id nulls first
 loop
   allocation:=least(remaining,purchase.amount-purchase.opening_settled_amount-coalesce((select sum(f.amount) from public.funding_events f where f.invoice_id=p_invoice_id and f.financed_transaction_id=purchase.id and f.installment_id is not distinct from purchase.installment_id),0));
   if allocation>0 then insert into public.funding_events(household_id,financed_transaction_id,funding_transaction_id,funder_member_id,source_account_id,invoice_id,installment_id,amount,funded_at) values(p_household_id,purchase.id,payment_tx,p_funder_member_id,p_source_account_id,p_invoice_id,purchase.installment_id,allocation,p_paid_at); remaining:=remaining-allocation; end if;
   exit when remaining=0;
 end loop;
 if remaining<>0 then raise exception 'invoice purchases do not support requested funding' using errcode='23514'; end if;
 update public.card_invoices set settled_amount=settled_amount+p_amount,status=case when settled_amount+opening_settled_amount+p_amount=total_amount then 'paid' else status end,settled_at=case when settled_amount+opening_settled_amount+p_amount=total_amount then p_paid_at else null end,updated_at=now() where id=p_invoice_id;
 return payment_tx;
end
$function$
;

create or replace view public.financial_invoice_positions with (security_invoker=true) as
 SELECT i.household_id,
    i.id AS invoice_id,
    i.card_id,
    i.competence_date,
    i.closing_date,
    i.due_date,
    i.status,
    i.total_amount,
    (i.settled_amount + i.opening_settled_amount)::numeric(19,2) AS settled_amount,
    GREATEST(i.total_amount - i.settled_amount - i.opening_settled_amount - i.financed_balance, 0::numeric) AS outstanding_amount,
    i.financed_balance,
    i.minimum_payment_amount,
    i.due_date < CURRENT_DATE AND (i.status <> ALL (ARRAY['paid'::invoice_state, 'cancelled'::invoice_state])) AND i.total_amount > (i.settled_amount + i.opening_settled_amount + i.financed_balance) AS is_overdue,
    c.default_payment_account_id AS planned_payment_account_id,
    i.opening_settled_amount,
    (i.settled_amount + i.opening_settled_amount)::numeric(19,2) AS paid_amount
   FROM card_invoices i
     JOIN cards c ON c.id = i.card_id AND c.household_id = i.household_id
  WHERE i.deleted_at IS NULL;;

create or replace view public.financial_card_invoice_positions with (security_invoker=true) as
 SELECT i.household_id,
    i.card_id,
    i.id AS invoice_id,
    i.competence_date AS invoice_month,
    i.competence_date AS competence,
    i.closing_date,
    i.due_date,
    i.total_amount AS known_invoice_amount,
    (i.settled_amount + i.opening_settled_amount)::numeric(19,2) AS paid_amount,
    GREATEST(i.total_amount - i.settled_amount - i.opening_settled_amount - i.financed_balance, 0::numeric)::numeric(19,2) AS remaining_amount,
    i.status AS state,
    i.due_date < CURRENT_DATE AND (i.status <> ALL (ARRAY['paid'::invoice_state, 'cancelled'::invoice_state])) AND i.total_amount > (i.settled_amount + i.opening_settled_amount + i.financed_balance) AS is_overdue,
    i.competence_date = date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)::date AS is_current_invoice,
    i.competence_date > date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)::date AS is_future_invoice,
    i.due_date - CURRENT_DATE AS days_until_due,
    i.opening_settled_amount
   FROM card_invoices i
     JOIN cards c ON c.id = i.card_id AND c.household_id = i.household_id
  WHERE i.deleted_at IS NULL AND c.deactivated_at IS NULL;;

create or replace view public.financial_commitment_positions with (security_invoker=true) as
 WITH invoice_payment_evidence AS (
         SELECT cip.household_id,
            cip.invoice_id,
            cip.payment_transaction_id,
            cip.source_account_id
           FROM card_invoice_payments cip
             JOIN transactions payment ON payment.id = cip.payment_transaction_id AND payment.household_id = cip.household_id AND payment.type = 'invoice_payment'::transaction_kind AND payment.status = 'paid'::transaction_state AND payment.settled_at IS NOT NULL AND payment.deleted_at IS NULL AND payment.amount = cip.amount
             JOIN funding_events allocated ON allocated.household_id = cip.household_id AND allocated.invoice_id = cip.invoice_id AND allocated.funding_transaction_id = cip.payment_transaction_id AND allocated.source_account_id = cip.source_account_id
          GROUP BY cip.household_id, cip.invoice_id, cip.payment_transaction_id, cip.source_account_id, cip.amount
         HAVING sum(allocated.amount) = cip.amount
        ), installment_funding AS (
         SELECT f.household_id,
            f.installment_id,
            sum(f.amount)::numeric(19,2) AS realized_amount
           FROM funding_events f
             JOIN installments i ON i.id = f.installment_id AND i.household_id = f.household_id AND i.invoice_id = f.invoice_id
             JOIN installment_plans ip ON ip.id = i.installment_plan_id AND ip.household_id = f.household_id AND ip.purchase_transaction_id = f.financed_transaction_id
             JOIN invoice_payment_evidence paid ON paid.household_id = f.household_id AND paid.invoice_id = f.invoice_id AND paid.payment_transaction_id = f.funding_transaction_id AND paid.source_account_id = f.source_account_id
          WHERE f.installment_id IS NOT NULL AND f.invoice_id IS NOT NULL
          GROUP BY f.household_id, f.installment_id
        ), invoice_direct_funding AS (
         SELECT f.household_id,
            f.financed_transaction_id,
            sum(f.amount)::numeric(19,2) AS realized_amount
           FROM funding_events f
             JOIN transactions t ON t.id = f.financed_transaction_id AND t.household_id = f.household_id AND t.invoice_id = f.invoice_id AND t.deleted_at IS NULL
             JOIN invoice_payment_evidence paid ON paid.household_id = f.household_id AND paid.invoice_id = f.invoice_id AND paid.payment_transaction_id = f.funding_transaction_id AND paid.source_account_id = f.source_account_id
          WHERE f.installment_id IS NULL AND f.invoice_id IS NOT NULL
          GROUP BY f.household_id, f.financed_transaction_id
        ), direct_funding AS (
         SELECT funding_events.household_id,
            funding_events.financed_transaction_id,
            sum(funding_events.amount)::numeric(19,2) AS realized_amount
           FROM funding_events
          WHERE funding_events.installment_id IS NULL AND funding_events.invoice_id IS NULL
          GROUP BY funding_events.household_id, funding_events.financed_transaction_id
        ), obligation_realization AS (
         SELECT obligation_events.household_id,
            obligation_events.obligation_id,
            sum(obligation_events.amount) FILTER (WHERE obligation_events.kind = 'payment'::obligation_event_kind)::numeric(19,2) AS realized_amount
           FROM obligation_events
          GROUP BY obligation_events.household_id, obligation_events.obligation_id
        ), raw_positions AS (
         SELECT i.household_id,
            'installment:'::text || i.id::text AS commitment_key,
            'card_installment'::text AS source_type,
            i.id AS source_id,
            p.purchase_transaction_id AS source_transaction_id,
            i.id AS source_installment_id,
            i.invoice_id AS source_invoice_id,
            NULL::uuid AS source_obligation_id,
            NULL::uuid AS source_recurring_occurrence_id,
            'card_installment'::text AS commitment_type,
            'outflow'::text AS direction,
            t.type::text AS economic_type,
            COALESCE(i.due_date, i.competence_date) AS financial_date,
            i.due_date,
            t.transaction_date AS economic_date,
                CASE
                    WHEN i.status = 'cancelled'::installment_state THEN 'cancelled'::economic_state
                    WHEN i.status = 'refunded'::installment_state THEN 'reversed'::economic_state
                    ELSE t.economic_state
                END AS source_state,
            i.amount AS estimated_amount,
            i.amount AS confirmed_amount,
            LEAST(GREATEST(COALESCE(f.realized_amount, 0::numeric), COALESCE(i.opening_settled_amount, 0::numeric)), i.amount)::numeric(19,2) AS realized_amount,
            t.description,
            t.category_id,
            t.created_by_member_id
           FROM installments i
             JOIN installment_plans p ON p.id = i.installment_plan_id AND p.household_id = i.household_id
             JOIN transactions t ON t.id = p.purchase_transaction_id AND t.household_id = i.household_id
             LEFT JOIN installment_funding f ON f.installment_id = i.id AND f.household_id = i.household_id
          WHERE t.deleted_at IS NULL
        UNION ALL
         SELECT o.household_id,
            'recurring_occurrence:'::text || o.id::text,
            'recurring_occurrence'::text,
            o.id,
            t.id,
            NULL::uuid AS uuid,
            t.invoice_id,
            NULL::uuid AS uuid,
            o.id,
            'recurring_expense'::text,
            'outflow'::text,
            t.type::text AS type,
            COALESCE(o.due_date, o.competence_date, t.due_date, t.competence_date) AS "coalesce",
            COALESCE(o.due_date, t.due_date) AS "coalesce",
            t.transaction_date,
                CASE
                    WHEN o.status = 'cancelled'::occurrence_state THEN 'cancelled'::economic_state
                    ELSE t.economic_state
                END AS economic_state,
            COALESCE(o.estimated_amount, t.estimated_amount, t.amount) AS "coalesce",
            COALESCE(o.confirmed_amount, t.confirmed_amount) AS "coalesce",
                CASE
                    WHEN t.invoice_id IS NOT NULL THEN LEAST(COALESCE(ifund.realized_amount, 0::numeric), COALESCE(o.confirmed_amount, o.estimated_amount, t.confirmed_amount, t.estimated_amount, t.amount))
                    ELSE GREATEST(t.realized_amount, COALESCE(df.realized_amount, 0::numeric))
                END::numeric(19,2) AS "greatest",
            t.description,
            t.category_id,
            t.created_by_member_id
           FROM recurring_occurrences o
             JOIN transactions t ON t.id = o.transaction_id AND t.household_id = o.household_id
             LEFT JOIN direct_funding df ON df.financed_transaction_id = t.id AND df.household_id = t.household_id
             LEFT JOIN invoice_direct_funding ifund ON ifund.financed_transaction_id = t.id AND ifund.household_id = t.household_id
          WHERE t.type = 'expense'::transaction_kind AND t.deleted_at IS NULL AND NOT (EXISTS ( SELECT 1
                   FROM installment_plans p
                  WHERE p.purchase_transaction_id = t.id)) AND NOT (EXISTS ( SELECT 1
                   FROM financial_obligations x
                  WHERE x.kind = 'payable'::obligation_kind AND x.source_transaction_id = t.id))
        UNION ALL
         SELECT t.household_id,
            'transaction:'::text || t.id::text,
            'direct_expense'::text,
            t.id,
            t.id,
            NULL::uuid AS uuid,
            t.invoice_id,
            NULL::uuid AS uuid,
            NULL::uuid AS uuid,
            'direct_expense'::text,
            'outflow'::text,
            t.type::text AS type,
            COALESCE(t.due_date, t.competence_date, t.transaction_date) AS "coalesce",
            t.due_date,
            t.transaction_date,
            t.economic_state,
            COALESCE(t.estimated_amount, t.amount) AS "coalesce",
            t.confirmed_amount,
                CASE
                    WHEN t.invoice_id IS NOT NULL THEN LEAST(COALESCE(ifund.realized_amount, 0::numeric), COALESCE(t.confirmed_amount, t.estimated_amount, t.amount))
                    ELSE GREATEST(t.realized_amount, COALESCE(df.realized_amount, 0::numeric))
                END::numeric(19,2) AS "greatest",
            t.description,
            t.category_id,
            t.created_by_member_id
           FROM transactions t
             LEFT JOIN direct_funding df ON df.financed_transaction_id = t.id AND df.household_id = t.household_id
             LEFT JOIN invoice_direct_funding ifund ON ifund.financed_transaction_id = t.id AND ifund.household_id = t.household_id
          WHERE t.type = 'expense'::transaction_kind AND t.deleted_at IS NULL AND NOT (EXISTS ( SELECT 1
                   FROM installment_plans p
                  WHERE p.purchase_transaction_id = t.id)) AND NOT (EXISTS ( SELECT 1
                   FROM recurring_occurrences o
                  WHERE o.transaction_id = t.id)) AND NOT (EXISTS ( SELECT 1
                   FROM financial_obligations x
                  WHERE x.kind = 'payable'::obligation_kind AND x.source_transaction_id = t.id))
        UNION ALL
         SELECT t.household_id,
            'card_opening_adjustment:'::text || t.id::text,
            'card_opening_adjustment'::text,
            t.id,
            t.id,
            NULL::uuid AS uuid,
            t.invoice_id,
            NULL::uuid AS uuid,
            NULL::uuid AS uuid,
            'card_opening_adjustment'::text,
            'outflow'::text,
            t.type::text AS type,
            COALESCE(t.due_date, t.competence_date, t.transaction_date) AS "coalesce",
            t.due_date,
            t.transaction_date,
            t.economic_state,
            t.estimated_amount,
            t.confirmed_amount,
            LEAST(COALESCE(ifund.realized_amount, 0::numeric), COALESCE(t.confirmed_amount, t.estimated_amount, t.amount))::numeric(19,2) AS "least",
            t.description,
            NULL::uuid AS uuid,
            t.created_by_member_id
           FROM transactions t
             LEFT JOIN invoice_direct_funding ifund ON ifund.financed_transaction_id = t.id AND ifund.household_id = t.household_id
          WHERE t.type = 'adjustment'::transaction_kind AND t.invoice_id IS NOT NULL AND t.deleted_at IS NULL
        UNION ALL
         SELECT o.household_id,
            'payable_schedule:'::text || s.id::text,
            'payable_schedule_item'::text,
            s.id,
            o.source_transaction_id,
            NULL::uuid AS uuid,
            o.invoice_id,
            o.id,
            NULL::uuid AS uuid,
            'payable'::text,
            'outflow'::text,
            'obligation'::text,
            s.due_date,
            s.due_date,
            o.obligation_date,
                CASE
                    WHEN o.state = 'cancelled'::obligation_state THEN 'cancelled'::economic_state
                    WHEN o.state = 'written_off'::obligation_state THEN 'reversed'::economic_state
                    WHEN s.remaining_amount = 0::numeric THEN 'realized'::economic_state
                    ELSE 'confirmed'::economic_state
                END AS "case",
            NULL::numeric(19,2) AS "numeric",
            s.amount,
            s.realized_amount,
            (((o.description || ' — '::text) || s.number::text) || '/'::text) || s.installment_count::text,
            NULL::uuid AS uuid,
            o.created_by_member_id
           FROM financial_obligations o
             JOIN obligation_repayment_schedule_positions s ON s.obligation_id = o.id AND s.household_id = o.household_id
          WHERE o.kind = 'payable'::obligation_kind
        UNION ALL
         SELECT o.household_id,
            'payable:'::text || o.id::text,
            'payable'::text,
            o.id,
            o.source_transaction_id,
            NULL::uuid AS uuid,
            o.invoice_id,
            o.id,
            NULL::uuid AS uuid,
            'payable'::text,
            'outflow'::text,
            'obligation'::text,
            COALESCE(o.due_date, o.obligation_date) AS "coalesce",
            o.due_date,
            o.obligation_date,
                CASE
                    WHEN o.state = 'cancelled'::obligation_state THEN 'cancelled'::economic_state
                    WHEN o.state = 'written_off'::obligation_state THEN 'reversed'::economic_state
                    WHEN o.state = 'settled'::obligation_state THEN 'realized'::economic_state
                    ELSE 'confirmed'::economic_state
                END AS "case",
            NULL::numeric(19,2) AS "numeric",
            o.original_amount,
            LEAST(COALESCE(r.realized_amount, 0::numeric), o.original_amount)::numeric(19,2) AS "least",
            o.description,
            NULL::uuid AS uuid,
            o.created_by_member_id
           FROM financial_obligations o
             LEFT JOIN obligation_realization r ON r.obligation_id = o.id AND r.household_id = o.household_id
          WHERE o.kind = 'payable'::obligation_kind AND NOT (EXISTS ( SELECT 1
                   FROM obligation_repayment_schedule_items s
                  WHERE s.obligation_id = o.id))
        ), amounts AS (
         SELECT r.household_id,
            r.commitment_key,
            r.source_type,
            r.source_id,
            r.source_transaction_id,
            r.source_installment_id,
            r.source_invoice_id,
            r.source_obligation_id,
            r.source_recurring_occurrence_id,
            r.commitment_type,
            r.direction,
            r.economic_type,
            r.financial_date,
            r.due_date,
            r.economic_date,
            r.source_state,
            r.estimated_amount,
            r.confirmed_amount,
            r.realized_amount,
            r.description,
            r.category_id,
            r.created_by_member_id,
            financial_effective_total_amount(r.source_state, r.estimated_amount, r.confirmed_amount, r.realized_amount, r.confirmed_amount)::numeric(19,2) AS effective_amount,
            financial_remaining_amount(r.source_state, r.estimated_amount, r.confirmed_amount, r.realized_amount, r.confirmed_amount)::numeric(19,2) AS remaining_amount
           FROM raw_positions r
        ), dated AS (
         SELECT a.household_id,
            a.commitment_key,
            a.source_type,
            a.source_id,
            a.source_transaction_id,
            a.source_installment_id,
            a.source_invoice_id,
            a.source_obligation_id,
            a.source_recurring_occurrence_id,
            a.commitment_type,
            a.direction,
            a.economic_type,
            a.financial_date,
            a.due_date,
            a.economic_date,
            a.source_state,
            a.estimated_amount,
            a.confirmed_amount,
            a.realized_amount,
            a.description,
            a.category_id,
            a.created_by_member_id,
            a.effective_amount,
            a.remaining_amount,
            date_trunc('month'::text, a.financial_date::timestamp with time zone)::date AS financial_month
           FROM amounts a
        )
 SELECT household_id,
    commitment_key,
    source_type,
    source_id,
    source_transaction_id,
    source_installment_id,
    source_invoice_id,
    source_obligation_id,
    source_recurring_occurrence_id,
    commitment_type,
    direction,
    economic_type,
    financial_date,
    financial_month,
    due_date,
    economic_date,
    effective_amount,
    realized_amount,
    remaining_amount,
    source_state AS economic_state,
        CASE
            WHEN source_state = ANY (ARRAY['cancelled'::economic_state, 'reversed'::economic_state]) THEN source_state
            WHEN remaining_amount = 0::numeric THEN 'realized'::economic_state
            WHEN source_state = 'forecast'::economic_state THEN 'forecast'::economic_state
            ELSE 'confirmed'::economic_state
        END AS commitment_state,
    COALESCE(due_date < CURRENT_DATE, false) AND remaining_amount > 0::numeric AND (source_state <> ALL (ARRAY['cancelled'::economic_state, 'reversed'::economic_state])) AS is_overdue,
    financial_month < date_trunc('month'::text, CURRENT_DATE::timestamp with time zone)::date AND remaining_amount > 0::numeric AND (source_state <> ALL (ARRAY['cancelled'::economic_state, 'reversed'::economic_state])) AS is_prior_pending,
    description,
    category_id,
    created_by_member_id
   FROM dated;;

revoke all on function public.set_household_financial_tracking_start(uuid,date) from public,anon;
revoke all on function public.create_account_with_opening_position(uuid,text,public.account_kind,text,uuid[],numeric,date,text) from public,anon;
revoke all on function public.create_account_with_opening_position_idempotent(uuid,text,public.account_kind,text,uuid[],numeric,date,text,text) from public,anon;
revoke all on function public.record_opening_card_purchase(uuid,uuid,text,date,numeric,uuid,uuid,jsonb,integer,integer,text) from public,anon;
revoke all on function public.record_opening_card_purchase_idempotent(uuid,uuid,text,date,numeric,uuid,uuid,jsonb,integer,integer,text,text) from public,anon;
revoke all on function public.record_opening_card_balance_adjustment(uuid,uuid,numeric,text) from public,anon;
revoke all on function public.record_opening_card_balance_adjustment_idempotent(uuid,uuid,numeric,text,text) from public,anon;
grant execute on function public.set_household_financial_tracking_start(uuid,date) to authenticated;
grant execute on function public.create_account_with_opening_position(uuid,text,public.account_kind,text,uuid[],numeric,date,text) to authenticated;
grant execute on function public.create_account_with_opening_position_idempotent(uuid,text,public.account_kind,text,uuid[],numeric,date,text,text) to authenticated;
grant execute on function public.record_opening_card_purchase(uuid,uuid,text,date,numeric,uuid,uuid,jsonb,integer,integer,text) to authenticated;
grant execute on function public.record_opening_card_purchase_idempotent(uuid,uuid,text,date,numeric,uuid,uuid,jsonb,integer,integer,text,text) to authenticated;
grant execute on function public.record_opening_card_balance_adjustment(uuid,uuid,numeric,text) to authenticated;
grant execute on function public.record_opening_card_balance_adjustment_idempotent(uuid,uuid,numeric,text,text) to authenticated;

comment on function public.record_opening_card_balance_adjustment(uuid,uuid,numeric,text) is
  'Registra apenas exposição/obrigação agregada existente na data de corte. Não cria compra econômica, renda, despesa, comprador, categoria, responsabilidade, funding ou caixa.';
comment on function public.record_opening_card_purchase(uuid,uuid,text,date,numeric,uuid,uuid,jsonb,integer,integer,text) is
  'Registra uma compra econômica histórica uma única vez e marca somente as parcelas já liquidadas antes da data de corte como opening_settled_amount, sem money_movement ou funding_event.';
