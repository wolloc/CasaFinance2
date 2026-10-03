-- Release 1: posição inicial de cartão em lote, com categoria e responsabilidade econômica por lançamento.
-- O lote é uma única operação financeira: se qualquer lançamento falhar, nenhum lançamento do lote é persistido.

create or replace function public.record_opening_card_purchases_batch_idempotent(
  p_household_id uuid,
  p_card_id uuid,
  p_purchases jsonb,
  p_request_key text
) returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  existing uuid;
  result uuid;
  tx_id uuid;
  item jsonb;
  item_count integer;
  tracking_start date;
  category_id uuid;
  buyer_id uuid;
  description text;
  purchase_date date;
  amount numeric;
  splits jsonb;
  installment_count integer;
  paid_installment_count integer;
  op constant text:='record_opening_card_purchases_batch';
begin
  perform public.require_active_member(p_household_id);
  existing:=public.financial_command_existing_or_lock(p_household_id,op,trim(p_request_key));
  if existing is not null then return existing; end if;

  if jsonb_typeof(p_purchases) <> 'array' then
    raise exception 'opening card purchases must be a JSON array' using errcode='22023';
  end if;
  item_count:=jsonb_array_length(p_purchases);
  if item_count<1 or item_count>50 then
    raise exception 'opening card purchase batch must contain between 1 and 50 items' using errcode='22023';
  end if;

  select h.financial_tracking_started_on into tracking_start
    from public.households h
   where h.id=p_household_id and h.deleted_at is null
   for update;
  if tracking_start is null then
    raise exception 'financial tracking start must be configured before opening card positions' using errcode='23514';
  end if;
  if not exists(
    select 1 from public.cards c
     where c.id=p_card_id and c.household_id=p_household_id and c.deactivated_at is null
  ) then
    raise exception 'active household card required' using errcode='23514';
  end if;

  for item in select value from jsonb_array_elements(p_purchases)
  loop
    description:=nullif(trim(item->>'description'),'');
    purchase_date:=nullif(item->>'originalPurchaseDate','')::date;
    amount:=nullif(item->>'amount','')::numeric;
    category_id:=nullif(item->>'categoryId','')::uuid;
    buyer_id:=nullif(item->>'buyerMemberId','')::uuid;
    splits:=coalesce(item->'splits','[]'::jsonb);
    installment_count:=nullif(item->>'installmentCount','')::integer;
    paid_installment_count:=nullif(item->>'paidInstallmentCount','')::integer;

    if description is null or purchase_date is null or purchase_date>=tracking_start or amount is null or amount<=0 then
      raise exception 'each opening card purchase needs description, historical date and positive amount' using errcode='22023';
    end if;
    if category_id is null or not exists(
      select 1 from public.categories c
       where c.id=category_id and c.household_id=p_household_id and c.type='expense' and c.deactivated_at is null
    ) then
      raise exception 'each opening card purchase needs an active expense category from the same household' using errcode='23514';
    end if;
    if buyer_id is null or not exists(
      select 1 from public.household_members m
       where m.id=buyer_id and m.household_id=p_household_id and m.deactivated_at is null
    ) then
      raise exception 'each opening card purchase needs an active buyer from the household' using errcode='23514';
    end if;
    if jsonb_typeof(splits)<>'array' or jsonb_array_length(splits)<1 then
      raise exception 'each opening card purchase needs at least one economic responsibility' using errcode='23514';
    end if;
    if installment_count is null or installment_count<1 or paid_installment_count is null or paid_installment_count<0 or paid_installment_count>installment_count then
      raise exception 'each opening card purchase has an invalid installment count' using errcode='22023';
    end if;
    if installment_count=1 and paid_installment_count<>0 then
      raise exception 'a one-time opening card purchase cannot already have a paid installment' using errcode='22023';
    end if;

    tx_id:=public.record_opening_card_purchase(
      p_household_id,
      p_card_id,
      description,
      purchase_date,
      amount,
      category_id,
      buyer_id,
      splits,
      installment_count,
      paid_installment_count,
      'Compra anterior ao início do controle'
    );
    if result is null then result:=tx_id; end if;
  end loop;

  perform public.financial_command_store(p_household_id,op,trim(p_request_key),result);
  return result;
end
$$;

revoke all on function public.record_opening_card_purchases_batch_idempotent(uuid,uuid,jsonb,text) from public,anon;
grant execute on function public.record_opening_card_purchases_batch_idempotent(uuid,uuid,jsonb,text) to authenticated;

comment on function public.record_opening_card_purchases_batch_idempotent(uuid,uuid,jsonb,text) is
  'Registra várias compras históricas de um cartão em uma única operação atômica, preservando categoria, comprador, responsabilidade econômica e parcelas abertas. Nenhuma compra é criada se qualquer item do lote falhar.';
