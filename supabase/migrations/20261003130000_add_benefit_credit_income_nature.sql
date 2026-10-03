-- Benefit credits are shown in Entradas but remain excluded from true-income/cash projections.
-- They use the existing income/receipt movement pipeline only to land in a restricted benefit resource.
alter type public.income_nature add value if not exists 'benefit_credit';