-- Category-only corrections are classification changes, not new financial facts.
create or replace function public.correct_transaction_category(
  p_household_id uuid,
  p_transaction_id uuid,
  p_category_id uuid,
  p_reason text default 'Categoria ajustada pelo usuário',
  p_request_key text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  tx public.transactions;
  actor public.household_members;
  old_category uuid;
  result_id uuid;
begin
  actor:=public.require_active_member(p_household_id);
  select * into tx from public.transactions
  where id=p_transaction_id and household_id=p_household_id and deleted_at is null
  for update;
  if tx.id is null then raise exception 'transaction not found' using errcode='P0002'; end if;
  if tx.economic_state in ('cancelled','reversed') or tx.status in ('cancelled','refunded') then
    raise exception 'cancelled or reversed transaction cannot receive a category' using errcode='0A000';
  end if;
  if p_category_id is not null and not exists(
    select 1 from public.categories c
    where c.id=p_category_id and c.household_id=p_household_id and c.archived_at is null
      and c.type=tx.type
  ) then
    raise exception 'category does not belong to transaction type' using errcode='23514';
  end if;
  old_category:=tx.category_id;
  if old_category is not distinct from p_category_id then return tx.id; end if;

  update public.transactions
  set category_id=p_category_id, updated_at=now()
  where id=tx.id;

  insert into public.transaction_adjustment_events(
    household_id,source_transaction_id,kind,created_by_member_id,reason,before_payload,after_payload,amount
  )
  values(
    p_household_id,tx.id,'correction',actor.id,
    coalesce(nullif(trim(p_reason),''),'Categoria ajustada pelo usuário'),
    jsonb_build_object('category_id',old_category),
    jsonb_build_object('category_id',p_category_id),
    null
  )
  returning id into result_id;

  return tx.id;
end $$;

revoke all on function public.correct_transaction_category(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.correct_transaction_category(uuid,uuid,uuid,text,text) to authenticated;
comment on function public.correct_transaction_category(uuid,uuid,uuid,text,text) is
  'Changes only the classification category of an existing non-cancelled transaction. It does not alter amount, date, funding, invoice, responsibility or cash.';
