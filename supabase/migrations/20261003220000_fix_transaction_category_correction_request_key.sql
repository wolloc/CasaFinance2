-- Harden category-only transaction correction with the mandatory audit request key.
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
  v_request_key text;
begin
  actor:=public.require_active_member(p_household_id);
  if length(trim(coalesce(p_request_key,'')))=0 then
    raise exception 'invalid transaction category correction command' using errcode='22023';
  end if;
  v_request_key:=trim(p_request_key);

  perform pg_advisory_xact_lock(
    hashtextextended(p_household_id::text||':transaction-category-correction:'||v_request_key,0)
  );
  if exists(
    select 1 from public.transaction_adjustment_events e
    where e.household_id=p_household_id and e.request_key=v_request_key
  ) then
    return p_transaction_id;
  end if;

  select * into tx from public.transactions
  where id=p_transaction_id and household_id=p_household_id and deleted_at is null
  for update;
  if tx.id is null then raise exception 'transaction not found' using errcode='P0002'; end if;
  if tx.economic_state in ('cancelled','reversed') or tx.status in ('cancelled','refunded') then
    raise exception 'cancelled or reversed transaction cannot receive a category' using errcode='0A000';
  end if;
  if p_category_id is not null and not exists(
    select 1 from public.categories c
    where c.id=p_category_id and c.household_id=p_household_id and c.deactivated_at is null
      and c.type::text=tx.type::text
  ) then
    raise exception 'category does not belong to transaction type' using errcode='23514';
  end if;
  old_category:=tx.category_id;
  if old_category is not distinct from p_category_id then return tx.id; end if;

  update public.transactions
  set category_id=p_category_id, updated_at=now()
  where id=tx.id;

  insert into public.transaction_adjustment_events(
    household_id,source_transaction_id,kind,created_by_member_id,reason,before_payload,after_payload,amount,request_key
  )
  values(
    p_household_id,tx.id,'correction',actor.id,
    coalesce(nullif(trim(p_reason),''),'Categoria ajustada pelo usuário'),
    jsonb_build_object('category_id',old_category),
    jsonb_build_object('category_id',p_category_id),
    null,v_request_key
  )
  returning id into result_id;

  return tx.id;
end $$;

revoke all on function public.correct_transaction_category(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.correct_transaction_category(uuid,uuid,uuid,text,text) to authenticated;
