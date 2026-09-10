-- Corrige o cálculo de datas de fatura sem reescrever migrations históricas.
-- `interval '1 month-1 day'` não é aceito pelo PostgreSQL do ambiente e
-- impedia a criação de compras no cartão antes de qualquer regra de limite.

create or replace function public.invoice_dates(p_card public.cards,p_purchase_date date)
returns table(competence date,closing_date date,due_date date)
language plpgsql
immutable
set search_path=public,pg_temp
as $$
declare
  base_month date:=date_trunc('month',p_purchase_date)::date;
  close_day int;
  due_month date;
begin
  close_day:=least(
    p_card.closing_day,
    extract(day from (base_month + interval '1 month' - interval '1 day'))::int
  );
  if p_purchase_date>make_date(extract(year from base_month)::int,extract(month from base_month)::int,close_day) then
    base_month:=(base_month+interval '1 month')::date;
  end if;
  competence:=base_month;
  closing_date:=make_date(
    extract(year from base_month)::int,
    extract(month from base_month)::int,
    least(p_card.closing_day,extract(day from (base_month + interval '1 month' - interval '1 day'))::int)
  );
  due_month:=case when p_card.due_day>p_card.closing_day then base_month else (base_month+interval '1 month')::date end;
  due_date:=make_date(
    extract(year from due_month)::int,
    extract(month from due_month)::int,
    least(p_card.due_day,extract(day from (due_month + interval '1 month' - interval '1 day'))::int)
  );
  return next;
end $$;

revoke all on function public.invoice_dates(public.cards,date) from public,anon,authenticated;
