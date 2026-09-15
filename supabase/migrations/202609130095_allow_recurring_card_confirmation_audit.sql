-- Recorrência de cartão: a confirmação usa o mesmo fato projetado e precisa
-- registrar uma correção auditável própria. A guarda continua bloqueando
-- mutações genéricas de ocorrências materializadas.

create or replace function public.guard_adjustment_event_dependencies()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  linked_occurrence_id uuid;
  dedicated_recurring_confirmation boolean:=false;
begin
  if new.kind in ('correction','cancellation') then
    select o.id into linked_occurrence_id
    from public.recurring_occurrences o
    where o.household_id=new.household_id
      and o.transaction_id=new.source_transaction_id;

    if linked_occurrence_id is not null then
      dedicated_recurring_confirmation:=coalesce(
        (
          new.kind='correction'
          and new.reason='Valor desta ocorrência recorrente confirmado pelo usuário'
          and new.request_key like 'recurring-confirm:'||linked_occurrence_id::text||':%'
          and new.before_payload->>'recurring_occurrence_id'=linked_occurrence_id::text
          and new.after_payload->>'recurring_occurrence_id'=linked_occurrence_id::text
          and new.after_payload->>'economic_state'='confirmed'
        )
        or (
          new.kind='correction'
          and new.reason='Cobrança recorrente confirmada no cartão pelo usuário'
          and new.request_key like 'recurring-card-confirm:'||linked_occurrence_id::text||':%'
          and new.before_payload->>'recurring_occurrence_id'=linked_occurrence_id::text
          and new.after_payload->>'recurring_occurrence_id'=linked_occurrence_id::text
          and new.after_payload->>'economic_state'='realized'
          and coalesce(new.after_payload->>'invoice_id','')<>''
        ),false);

      if not dedicated_recurring_confirmation then
        raise exception 'materialized recurring occurrence requires the dedicated recurrence correction flow' using errcode='0A000';
      end if;
    end if;
  end if;

  if new.kind='refund' and exists(
    select 1 from public.member_settlement_events mse
    where mse.household_id=new.household_id
      and mse.source_transaction_id=new.source_transaction_id
      and mse.kind='responsibility_funding'
      and mse.state='realized'
  ) then
    raise exception 'refund with realized member settlement effects requires a dedicated settlement-reversal flow' using errcode='0A000';
  end if;

  return new;
end
$$;

revoke all on function public.guard_adjustment_event_dependencies() from public,anon,authenticated;

comment on function public.guard_adjustment_event_dependencies() is
  'Blocks generic mutation of materialized recurring facts while allowing only the exact direct-account or card confirmation audit event emitted by their dedicated recurring commands.';
