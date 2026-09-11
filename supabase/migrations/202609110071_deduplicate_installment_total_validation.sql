-- Evita repetir a mesma validação diferida de total de parcelas várias vezes
-- para o mesmo plano dentro da mesma transação.
--
-- O trigger installments_exact_total é FOR EACH ROW e DEFERRABLE. Em uma compra
-- parcelada, cada parcela agenda a mesma validação para o final da transação.
-- A regra financeira é preservada: cada plano continua sendo validado contra
-- quantidade e total exatos antes do commit, mas apenas uma vez por plano.

create or replace function public.assert_installment_total()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  plan_id uuid := coalesce(new.installment_plan_id,old.installment_plan_id);
  expected numeric;
  actual numeric;
  expected_count integer;
  actual_count integer;
  already_validated text := coalesce(current_setting('casa.validated_installment_plans',true),'');
begin
  if position(plan_id::text in already_validated)>0 then
    return null;
  end if;

  perform set_config(
    'casa.validated_installment_plans',
    case when already_validated='' then plan_id::text else already_validated||','||plan_id::text end,
    true
  );

  select total_amount,installment_count
    into expected,expected_count
    from public.installment_plans
   where id=plan_id;

  select coalesce(sum(amount),0),count(*)
    into actual,actual_count
    from public.installments
   where installment_plan_id=plan_id;

  if expected is not null and (actual<>expected or actual_count<>expected_count) then
    raise exception 'installments must exactly match plan total and count' using errcode='23514';
  end if;

  return null;
end
$$;

comment on function public.assert_installment_total() is
  'Deferred installment invariant. Validates each installment plan only once per transaction while preserving exact total and count.';
