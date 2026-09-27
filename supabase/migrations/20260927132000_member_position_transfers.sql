-- Continuous member position through real transfers between individually-owned resources.
-- Forward-only. Existing transfer and legacy settlement commands remain unchanged.

create or replace view public.financial_member_net_positions with (security_invoker=true) as
with event_pairs as (
  select
    e.household_id,
    case when e.debtor_member_id::text<e.creditor_member_id::text then e.debtor_member_id else e.creditor_member_id end member_a,
    case when e.debtor_member_id::text<e.creditor_member_id::text then e.creditor_member_id else e.debtor_member_id end member_b,
    sum(
      case when e.state='realized' then
        e.amount
        * case when e.debtor_member_id::text<e.creditor_member_id::text then 1 else -1 end
        * case when e.kind in ('responsibility_funding','adjustment') then 1 else -1 end
      else 0 end
    )::numeric(19,2) realized_net,
    sum(
      case when e.state='projected' and e.kind in ('responsibility_funding','adjustment') then
        e.amount * case when e.debtor_member_id::text<e.creditor_member_id::text then 1 else -1 end
      else 0 end
    )::numeric(19,2) projected_net
  from public.member_settlement_events e
  where e.state in ('projected','realized')
  group by e.household_id,
    case when e.debtor_member_id::text<e.creditor_member_id::text then e.debtor_member_id else e.creditor_member_id end,
    case when e.debtor_member_id::text<e.creditor_member_id::text then e.creditor_member_id else e.debtor_member_id end
), schedule_pairs as (
  select
    s.household_id,
    case when s.payer_member_id::text<s.receiver_member_id::text then s.payer_member_id else s.receiver_member_id end member_a,
    case when s.payer_member_id::text<s.receiver_member_id::text then s.receiver_member_id else s.payer_member_id end member_b
  from public.member_settlement_schedules s
  where s.state='scheduled'
  group by s.household_id,
    case when s.payer_member_id::text<s.receiver_member_id::text then s.payer_member_id else s.receiver_member_id end,
    case when s.payer_member_id::text<s.receiver_member_id::text then s.receiver_member_id else s.payer_member_id end
), pair_keys as (
  select household_id,member_a,member_b from event_pairs
  union
  select household_id,member_a,member_b from schedule_pairs
), pair_values as (
  select k.household_id,k.member_a,k.member_b,
         coalesce(e.realized_net,0)::numeric(19,2) realized_net,
         coalesce(e.projected_net,0)::numeric(19,2) projected_net
  from pair_keys k
  left join event_pairs e using(household_id,member_a,member_b)
), directions as (
  select household_id,member_a debtor_member_id,member_b creditor_member_id,
         greatest(realized_net,0)::numeric(19,2) realized_outstanding,
         greatest(projected_net,0)::numeric(19,2) projected_outstanding
  from pair_values
  union all
  select household_id,member_b debtor_member_id,member_a creditor_member_id,
         greatest(-realized_net,0)::numeric(19,2) realized_outstanding,
         greatest(-projected_net,0)::numeric(19,2) projected_outstanding
  from pair_values
), scheduled as (
  select household_id,payer_member_id debtor_member_id,receiver_member_id creditor_member_id,
         sum(amount)::numeric(19,2) scheduled_settlement_amount
  from public.member_settlement_schedules
  where state='scheduled'
  group by household_id,payer_member_id,receiver_member_id
)
select d.household_id,d.debtor_member_id,d.creditor_member_id,
       d.realized_outstanding,d.projected_outstanding,
       coalesce(s.scheduled_settlement_amount,0)::numeric(19,2) scheduled_settlement_amount,
       d.realized_outstanding::numeric(19,2) net_position
from directions d
left join scheduled s
  on s.household_id=d.household_id
 and s.debtor_member_id=d.debtor_member_id
 and s.creditor_member_id=d.creditor_member_id
where d.realized_outstanding>0
   or d.projected_outstanding>0
   or coalesce(s.scheduled_settlement_amount,0)>0;

revoke all on public.financial_member_net_positions from public,anon;
grant select on public.financial_member_net_positions to authenticated;

comment on view public.financial_member_net_positions is
'Normalized continuous bilateral member position. A transfer may cross zero and reverse direction; rows always expose a positive amount on the resulting debtor-to-creditor direction.';

create or replace function public.create_member_position_transfer_idempotent(
  p_household_id uuid,
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_amount numeric,
  p_date date,
  p_description text,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller public.household_members;
  existing uuid;
  tx uuid;
  movement uuid;
  source_owners uuid[];
  destination_owners uuid[];
  source_owner uuid;
  destination_owner uuid;
  op constant text:='create_member_position_transfer';
begin
  caller:=public.require_active_member(p_household_id);
  existing:=public.financial_command_existing_or_lock(p_household_id,op,p_request_key);
  if existing is not null then return existing; end if;

  if p_amount<=0
     or p_source_account_id=p_destination_account_id
     or p_date is null
     or p_date>current_date
     or nullif(trim(p_description),'') is null
  then
    raise exception 'valid realized transfer data required' using errcode='22023';
  end if;

  if not exists(
    select 1 from public.accounts
    where id=p_source_account_id and household_id=p_household_id and deactivated_at is null
  ) or not exists(
    select 1 from public.accounts
    where id=p_destination_account_id and household_id=p_household_id and deactivated_at is null
  ) then
    raise exception 'transfer accounts must belong to household' using errcode='23514';
  end if;

  select array_agg(ao.member_id order by ao.member_id::text)
    into source_owners
  from public.account_ownerships ao
  join public.household_members hm on hm.id=ao.member_id
   and hm.household_id=p_household_id
   and hm.deactivated_at is null
  where ao.household_id=p_household_id and ao.account_id=p_source_account_id;

  select array_agg(ao.member_id order by ao.member_id::text)
    into destination_owners
  from public.account_ownerships ao
  join public.household_members hm on hm.id=ao.member_id
   and hm.household_id=p_household_id
   and hm.deactivated_at is null
  where ao.household_id=p_household_id and ao.account_id=p_destination_account_id;

  if coalesce(cardinality(source_owners),0)<>1
     or coalesce(cardinality(destination_owners),0)<>1
  then
    raise exception 'member position transfer requires one active owner per account' using errcode='23514';
  end if;

  source_owner:=source_owners[1];
  destination_owner:=destination_owners[1];

  if source_owner=destination_owner then
    raise exception 'member position transfer requires distinct account owners' using errcode='23514';
  end if;

  insert into public.transactions(
    household_id,created_by_member_id,type,status,description,amount,
    transaction_date,competence_date,settled_at
  ) values(
    p_household_id,caller.id,'transfer','paid',trim(p_description),p_amount,
    p_date,date_trunc('month',p_date)::date,p_date::timestamptz
  ) returning id into tx;

  insert into public.transfers(
    household_id,transaction_id,source_account_id,destination_account_id,settled_at
  ) values(
    p_household_id,tx,p_source_account_id,p_destination_account_id,p_date::timestamptz
  );

  insert into public.money_movements(
    household_id,created_by_member_id,kind,state,amount,description,
    source_account_id,destination_account_id,movement_date,competence_date,realized_at
  ) values(
    p_household_id,caller.id,'member_settlement','realized',p_amount,trim(p_description),
    p_source_account_id,p_destination_account_id,p_date,date_trunc('month',p_date)::date,p_date::timestamptz
  ) returning id into movement;

  insert into public.member_settlement_events(
    household_id,created_by_member_id,debtor_member_id,creditor_member_id,
    amount,state,kind,financial_date,occurred_at,
    source_transaction_id,source_money_movement_id,notes
  ) values(
    p_household_id,caller.id,source_owner,destination_owner,
    p_amount,'realized','explicit_settlement',p_date,p_date::timestamptz,
    tx,movement,'Transferência considerada na posição entre membros'
  );

  perform public.financial_command_store(p_household_id,op,p_request_key,tx);
  return tx;
end;
$$;

revoke all on function public.create_member_position_transfer_idempotent(uuid,uuid,uuid,numeric,date,text,text) from public,anon;
grant execute on function public.create_member_position_transfer_idempotent(uuid,uuid,uuid,numeric,date,text,text) to authenticated;

comment on function public.create_member_position_transfer_idempotent(uuid,uuid,uuid,numeric,date,text,text) is
'Creates one realized internal cash movement between two individually-owned member resources and applies that same movement to the continuous member position. Never creates income or expense.';
