-- Categoria de renda é opcional por regra de produto.
-- O movimento continua exigindo beneficiário e destino transacional.

alter table public.money_movements
  drop constraint if exists money_movements_check3;

alter table public.money_movements
  drop constraint if exists money_movements_income_shape_check;

alter table public.money_movements
  add constraint money_movements_income_shape_check
  check (
    kind <> 'income'
    or (
      beneficiary_member_id is not null
      and destination_account_id is not null
    )
  );
