-- Casa XIV: projection continuity, planned income and canonical loan schedule.
-- Forward-only: historical migrations remain immutable.
-- No realized cash or economic fact is created by these read-model changes.

create or replace view public.financial_true_income_positions
with (security_invoker=true) as
select m.household_id,
       m.id as money_movement_id,
       m.state,
       m.amount::numeric(19,2) as amount,
       case when m.state='realized' then 0::numeric
            else least(m.amount,greatest(coalesce(t.confirmed_amount,t.estimated_amount,t.amount)-t.realized_amount,0))
        end::numeric(19,2) as reliable_remaining_amount,
       m.movement_date,
       m.competence_date as financial_month,
       m.destination_account_id
  from public.money_movements m
  join public.accounts destination
    on destination.id=m.destination_account_id
   and destination.household_id=m.household_id
   and destination.deactivated_at is null
  left join public.transactions t
    on t.id=m.related_transaction_id
   and t.household_id=m.household_id
   and t.type='income'
   and t.deleted_at is null
 where m.kind='income'
   and destination.type in ('cash','checking','savings','digital_wallet')
   and destination.resource_restriction is null
   and (
     m.state='realized'
     or (
       m.state='projected'
       and t.economic_state in ('forecast','confirmed')
       and coalesce(t.confirmed_amount,t.estimated_amount,t.amount) is not null
       and t.realized_amount<coalesce(t.confirmed_amount,t.estimated_amount,t.amount)
       and 1=(
         select count(*) from public.money_movements candidate
          where candidate.household_id=m.household_id
            and candidate.kind='income' and candidate.state='projected'
            and candidate.related_transaction_id=m.related_transaction_id
       )
     )
   );

comment on view public.financial_true_income_positions is
  'True-income movements into available cash. Explicit future income facts (forecast or confirmed) with one unique projected cash leg participate in planning without becoming realized cash. Unlinked projections and neutral movements remain excluded.';

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
            'loan_schedule:'::text || s.id::text,
            'loan_schedule_item'::text,
            s.id,
            o.source_transaction_id,
            NULL::uuid AS uuid,
            o.invoice_id,
            o.id,
            NULL::uuid AS uuid,
            'loan_repayment'::text,
            'outflow'::text,
            'obligation'::text,
            s.due_date,
            s.due_date,
            o.obligation_date,
                CASE
                    WHEN o.state = 'cancelled'::obligation_state THEN 'cancelled'::economic_state
                    WHEN o.state = 'written_off'::obligation_state THEN 'reversed'::economic_state
                    WHEN s.state = 'cancelled' THEN 'cancelled'::economic_state
                    WHEN greatest(s.principal_amount + s.projected_interest_amount + s.projected_fee_amount - s.paid_principal_amount - s.paid_interest_amount - s.paid_fee_amount,0::numeric) = 0::numeric THEN 'realized'::economic_state
                    ELSE 'confirmed'::economic_state
                END AS "case",
            NULL::numeric(19,2) AS "numeric",
            (s.principal_amount + s.projected_interest_amount + s.projected_fee_amount)::numeric(19,2),
            least(
              s.paid_principal_amount + s.paid_interest_amount + s.paid_fee_amount,
              s.principal_amount + s.projected_interest_amount + s.projected_fee_amount
            )::numeric(19,2),
            o.description || ' — parcela '::text || s.installment_number::text,
            NULL::uuid AS uuid,
            o.created_by_member_id
           FROM financial_obligations o
             JOIN loan_schedule_items s ON s.principal_obligation_id = o.id AND s.household_id = o.household_id
          WHERE o.kind = 'payable'::obligation_kind AND o.origin_kind = 'loan'::obligation_origin_kind
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
          WHERE o.kind = 'payable'::obligation_kind
            AND NOT (EXISTS ( SELECT 1
                   FROM obligation_repayment_schedule_items s
                  WHERE s.obligation_id = o.id))
            AND NOT (EXISTS ( SELECT 1
                   FROM loan_schedule_items ls
                  WHERE ls.principal_obligation_id = o.id AND ls.household_id = o.household_id))
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

comment on view public.financial_commitment_positions is
  'Canonical monthly outgoing commitments. Canonical loan_schedule_items replace the whole-loan payable in monthly planning so each repayment impacts its due month once; principal repayment remains cash/liability settlement, while projected interest/fees remain financial projections until economically accrued.';

create or replace function public.financial_attention_items(p_household_id uuid)
returns table (
  household_id uuid,attention_key text,attention_type text,severity text,amount numeric(19,2),due_date date,entity_type text,entity_id uuid,title text
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  with base as (
    select c.household_id,'commitment:'||c.commitment_key,'overdue_commitment',
           case when c.remaining_amount>greatest(coalesce(h.current_cash,0)+coalesce(h.expected_reliable_income_remaining,0),0) then 'red' else 'yellow' end,
           c.remaining_amount::numeric(19,2),c.due_date,case when c.source_type='loan_schedule_item' then 'loan_schedule_item' else 'commitment' end,c.source_id,c.description
      from public.financial_commitment_positions c
      left join lateral public.financial_household_health_position(p_household_id) h on true
     where c.household_id=p_household_id and c.remaining_amount>0 and c.is_overdue
       and c.commitment_state::text not in ('cancelled','reversed') and c.source_invoice_id is null and (c.source_obligation_id is null or c.source_type='loan_schedule_item')
    union all
    select i.household_id,'invoice:'||i.invoice_id::text,'overdue_invoice','red',i.remaining_amount::numeric(19,2),i.due_date,'invoice',i.invoice_id,'Fatura vencida'
      from public.financial_card_invoice_positions i where i.household_id=p_household_id and i.is_overdue and i.remaining_amount>0
    union all
    select b.household_id,'obligation:'||b.obligation_id::text,case when b.kind='payable' then 'overdue_payable' else 'overdue_receivable' end,'yellow',b.outstanding_amount::numeric(19,2),b.due_date,'obligation',b.obligation_id,case when b.kind='payable' then 'Valor a pagar vencido' else 'Valor a receber vencido' end
      from public.financial_obligation_balances b where b.household_id=p_household_id and b.is_overdue and b.outstanding_amount>0
       and not exists(select 1 from public.loan_schedule_items ls where ls.household_id=b.household_id and ls.principal_obligation_id=b.obligation_id)
    union all
    select i.household_id,'income:'||i.money_movement_id::text,'delayed_expected_income','yellow',i.reliable_remaining_amount::numeric(19,2),i.movement_date,'money_movement',i.money_movement_id,'Entrada esperada atrasada'
      from public.financial_true_income_positions i where i.household_id=p_household_id and i.state='projected' and i.reliable_remaining_amount>0 and i.movement_date<current_date
    union all
    select s.household_id,'settlement:'||s.id::text,'overdue_member_settlement','yellow',s.amount::numeric(19,2),s.due_date,'member_settlement_schedule',s.id,'Acerto programado vencido'
      from public.member_settlement_schedules s where s.household_id=p_household_id and s.state='scheduled' and s.due_date<current_date
    union all
    select o.household_id,'overdraft:'||o.account_id::text,'overdraft_in_use',case when o.overdraft_over_limit>0 then 'red' else 'yellow' end,o.overdraft_used::numeric(19,2),null::date,'account',o.account_id,'LIS em uso'
      from public.financial_overdraft_positions o where o.household_id=p_household_id and o.overdraft_used>0
    union all
    select c.household_id,'card-limit:'||c.card_id::text,'card_over_limit','red',c.over_limit_amount::numeric(19,2),c.next_due_date,'card',c.card_id,'Cartão acima do limite'
      from public.financial_card_health_positions c where c.household_id=p_household_id and c.over_limit_amount>0
    union all
    select i.household_id,'invoice-coverage:'||i.invoice_id::text,'card_coverage_risk','yellow',i.remaining_amount::numeric(19,2),i.due_date,'invoice',i.invoice_id,'Fatura próxima do vencimento sem cobertura projetada'
      from public.financial_card_invoice_positions i
      cross join lateral public.financial_household_health_position(p_household_id) h
     where i.household_id=p_household_id and i.state<>'cancelled' and not i.is_overdue and i.remaining_amount>0
       and i.due_date between current_date and current_date+7 and i.remaining_amount>greatest(coalesce(h.projected_ending_cash,0)+i.remaining_amount,0)
    union all
    select p_household_id,'projection:'||date_trunc('month',current_date)::date::text,'negative_projection','red',abs(h.projected_ending_cash)::numeric(19,2),(date_trunc('month',current_date)+interval '1 month'-interval '1 day')::date,'household',p_household_id,'Projeção do mês ficou negativa'
      from public.financial_household_health_position(p_household_id) h where coalesce(h.projected_ending_cash,0)<0
  ), recurring_due as (
    select r.household_id,'recurring-due:'||r.occurrence_id::text,'recurring_expense_due',
           case when r.attention_state='overdue' then 'yellow' else 'yellow' end,
           r.remaining_amount::numeric(19,2),r.due_date,'recurring_occurrence',r.occurrence_id,
           case when r.attention_state='overdue' then r.description||' · vencida'
                when r.attention_state='due_today' then r.description||' · vence hoje'
                else r.description||' · vence em breve' end
      from public.financial_recurring_expense_attention_positions r
     where r.household_id=p_household_id and r.attention_state in ('overdue','due_today','due_soon')
       and not (r.attention_state='overdue')
  )
  select * from base
  union all
  select * from recurring_due;
$$;

comment on function public.financial_attention_items(uuid) is
  'Actionable attention center. Future planned values remain projection only; an expected income or loan installment becomes attention when its expected/due date passes unresolved. Canonical loan schedules suppress duplicate whole-obligation overdue alerts.';

revoke all on public.financial_true_income_positions,public.financial_commitment_positions from public,anon;
grant select on public.financial_true_income_positions,public.financial_commitment_positions to authenticated;
revoke all on function public.financial_attention_items(uuid) from public,anon;
grant execute on function public.financial_attention_items(uuid) to authenticated;
