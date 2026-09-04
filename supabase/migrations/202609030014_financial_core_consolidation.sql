-- Etapa 9: consolidacao do nucleo financeiro persistente.
-- Migrations 001-013 permanecem imutaveis.

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'accounts', 'cards', 'categories', 'transactions', 'transaction_payment_instruments', 'transaction_splits',
    'funding_events', 'transfers', 'card_invoices', 'card_invoice_payments',
    'recurring_rules', 'recurring_occurrences', 'installment_plans', 'installments',
    'loans', 'loan_installments', 'settlements', 'money_movements',
    'loan_contracts', 'loan_payment_schedule'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('DROP POLICY IF EXISTS member_delete ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS member_select ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS member_insert ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS member_update ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', table_name, table_name);
    IF table_name = 'transaction_payment_instruments' THEN
      EXECUTE 'DROP POLICY IF EXISTS transaction_instruments_select ON public.transaction_payment_instruments';
      EXECUTE 'DROP POLICY IF EXISTS transaction_instruments_insert ON public.transaction_payment_instruments';
      EXECUTE 'DROP POLICY IF EXISTS transaction_instruments_update ON public.transaction_payment_instruments';
      EXECUTE 'DROP POLICY IF EXISTS transaction_instruments_delete ON public.transaction_payment_instruments';
    END IF;
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (public.is_active_household_member(household_id))', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_active_household_member(household_id))', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (public.is_active_household_member(household_id)) WITH CHECK (public.is_active_household_member(household_id))', table_name, table_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_transaction_splits_household_transaction ON public.transaction_splits(household_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_instruments_household_transaction ON public.transaction_payment_instruments(household_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_invoices_card_competence ON public.card_invoices(card_id, competence_date);
CREATE INDEX IF NOT EXISTS idx_installments_plan_competence ON public.installments(installment_plan_id, competence_date);
CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_lookup ON public.recurring_occurrences(household_id, competence_date, status);

CREATE OR REPLACE FUNCTION public.validate_financial_core_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'transaction_splits' THEN
    IF NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = NEW.transaction_id AND t.household_id = NEW.household_id AND t.deleted_at IS NULL) THEN RAISE EXCEPTION 'split transaction must belong to the same household' USING ERRCODE = '23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.household_members m WHERE m.id = NEW.responsible_member_id AND m.household_id = NEW.household_id AND m.deactivated_at IS NULL) THEN RAISE EXCEPTION 'split member must belong to the same household' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'funding_events' THEN
    IF NOT EXISTS (SELECT 1 FROM public.household_members m WHERE m.id = NEW.funder_member_id AND m.household_id = NEW.household_id AND m.deactivated_at IS NULL) THEN RAISE EXCEPTION 'funder must belong to the same household' USING ERRCODE = '23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = NEW.source_account_id AND a.household_id = NEW.household_id AND a.deactivated_at IS NULL) THEN RAISE EXCEPTION 'funding account must belong to the same household' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'transfers' THEN
    IF NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = NEW.source_account_id AND a.household_id = NEW.household_id AND a.deactivated_at IS NULL) OR NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = NEW.destination_account_id AND a.household_id = NEW.household_id AND a.deactivated_at IS NULL) THEN RAISE EXCEPTION 'transfer accounts must belong to the same household' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'card_invoice_payments' THEN
    IF NOT EXISTS (SELECT 1 FROM public.card_invoices i WHERE i.id = NEW.invoice_id AND i.household_id = NEW.household_id) OR NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = NEW.source_account_id AND a.household_id = NEW.household_id AND a.deactivated_at IS NULL) THEN RAISE EXCEPTION 'invoice payment references must belong to the same household' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'installment_plans' THEN
    IF NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = NEW.purchase_transaction_id AND t.household_id = NEW.household_id AND t.type = 'expense') THEN RAISE EXCEPTION 'installment purchase must belong to the same household' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'installments' THEN
    IF NOT EXISTS (SELECT 1 FROM public.installment_plans p WHERE p.id = NEW.installment_plan_id AND p.household_id = NEW.household_id) THEN RAISE EXCEPTION 'installment plan must belong to the same household' USING ERRCODE = '23514'; END IF;
  ELSIF TG_TABLE_NAME = 'recurring_occurrences' THEN
    IF NOT EXISTS (SELECT 1 FROM public.recurring_rules r WHERE r.id = NEW.recurring_rule_id AND r.household_id = NEW.household_id) THEN RAISE EXCEPTION 'recurring rule must belong to the same household' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_financial_core_links() FROM public, anon, authenticated;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['transaction_splits','funding_events','transfers','card_invoice_payments','installment_plans','installments','recurring_rules','recurring_occurrences','loans','loan_installments','settlements','money_movements','loan_contracts','loan_payment_schedule'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS financial_core_links ON public.%I', table_name);
    EXECUTE format('CREATE TRIGGER financial_core_links BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.validate_financial_core_links()', table_name);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.create_expense_bundle(
  p_household_id uuid, p_description text, p_amount numeric, p_transaction_date date,
  p_category_id uuid, p_buyer_member_id uuid, p_instrument_kind public.payment_instrument_kind,
  p_account_id uuid DEFAULT NULL, p_card_id uuid DEFAULT NULL, p_notes text DEFAULT NULL,
  p_splits jsonb DEFAULT NULL, p_installment_count integer DEFAULT 1
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE creator public.household_members; transaction_id uuid; plan_id uuid; created_invoice_id uuid; split jsonb; split_total numeric; amount_total numeric; card_row public.cards;
BEGIN
  SELECT * INTO creator FROM public.household_members m WHERE m.profile_id = auth.uid() AND m.household_id = p_household_id AND m.deactivated_at IS NULL LIMIT 1;
  IF creator.id IS NULL THEN RAISE EXCEPTION 'authenticated active household membership required' USING ERRCODE = '42501'; END IF;
  IF p_buyer_member_id IS NULL OR p_instrument_kind IS NULL THEN RAISE EXCEPTION 'expense requires buyer and payment instrument' USING ERRCODE = '23514'; END IF;
  IF p_instrument_kind = 'account' AND (p_account_id IS NULL OR p_card_id IS NOT NULL) THEN RAISE EXCEPTION 'invalid account instrument' USING ERRCODE = '23514'; END IF;
  IF p_instrument_kind = 'card' AND (p_card_id IS NULL OR p_account_id IS NOT NULL) THEN RAISE EXCEPTION 'invalid card instrument' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.transactions (household_id, created_by_member_id, buyer_member_id, category_id, type, status, description, amount, transaction_date, competence_date, notes)
  VALUES (p_household_id, creator.id, p_buyer_member_id, p_category_id, 'expense', 'pending', p_description, p_amount, p_transaction_date, p_transaction_date, p_notes) RETURNING id INTO transaction_id;
  INSERT INTO public.transaction_payment_instruments (household_id, transaction_id, kind, account_id, card_id) VALUES (p_household_id, transaction_id, p_instrument_kind, p_account_id, p_card_id);
  IF p_instrument_kind = 'card' THEN
    SELECT * INTO card_row FROM public.cards c WHERE c.id = p_card_id AND c.household_id = p_household_id AND c.deactivated_at IS NULL;
    IF card_row.id IS NULL THEN RAISE EXCEPTION 'payment card must belong to the same household' USING ERRCODE = '23514'; END IF;
    INSERT INTO public.card_invoices (household_id, card_id, competence_date, closing_date, due_date, total_amount)
    VALUES (p_household_id, p_card_id, date_trunc('month', p_transaction_date + CASE WHEN extract(day FROM p_transaction_date) > card_row.closing_day THEN interval '1 month' ELSE interval '0 month' END)::date, p_transaction_date, p_transaction_date + (card_row.due_day - 1) * interval '1 day', p_amount)
    ON CONFLICT (card_id, competence_date) DO UPDATE SET total_amount = public.card_invoices.total_amount + EXCLUDED.total_amount, updated_at = now()
    RETURNING id INTO created_invoice_id;
    IF created_invoice_id IS NULL THEN SELECT i.id INTO created_invoice_id FROM public.card_invoices i WHERE i.card_id = p_card_id AND i.competence_date = date_trunc('month', p_transaction_date + CASE WHEN extract(day FROM p_transaction_date) > card_row.closing_day THEN interval '1 month' ELSE interval '0 month' END)::date; END IF;
    UPDATE public.transactions SET invoice_id = created_invoice_id WHERE id = transaction_id;
  END IF;
  IF p_splits IS NOT NULL THEN
    SELECT COALESCE(SUM((value->>'percentage')::numeric), 0), COALESCE(SUM((value->>'amount')::numeric), 0) INTO split_total, amount_total FROM jsonb_array_elements(p_splits);
    IF split_total <> 100 OR amount_total <> p_amount THEN RAISE EXCEPTION 'splits must equal expense total' USING ERRCODE = '23514'; END IF;
    FOR split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
      INSERT INTO public.transaction_splits (household_id, transaction_id, responsible_member_id, percentage, amount) VALUES (p_household_id, transaction_id, (split->>'member_id')::uuid, (split->>'percentage')::numeric, (split->>'amount')::numeric);
    END LOOP;
  END IF;
  IF p_installment_count > 1 THEN
    INSERT INTO public.installment_plans (household_id, purchase_transaction_id, installment_count, total_amount) VALUES (p_household_id, transaction_id, p_installment_count, p_amount) RETURNING id INTO plan_id;
    INSERT INTO public.installments (household_id, installment_plan_id, number, amount, competence_date, due_date)
    SELECT p_household_id, plan_id, n, (floor(p_amount * 100 / p_installment_count) + CASE WHEN n <= (p_amount * 100)::numeric % p_installment_count THEN 1 ELSE 0 END) / 100, (p_transaction_date + ((n - 1) || ' month')::interval)::date, (p_transaction_date + ((n - 1) || ' month')::interval)::date FROM generate_series(1, p_installment_count) n;
  END IF;
  RETURN transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_income_transaction(
  p_household_id uuid, p_description text, p_amount numeric, p_transaction_date date, p_category_id uuid, p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE creator public.household_members; transaction_id uuid;
BEGIN
  SELECT * INTO creator FROM public.household_members m WHERE m.profile_id = auth.uid() AND m.household_id = p_household_id AND m.deactivated_at IS NULL LIMIT 1;
  IF creator.id IS NULL THEN RAISE EXCEPTION 'authenticated active household membership required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.transactions (household_id, created_by_member_id, buyer_member_id, category_id, type, status, description, amount, transaction_date, competence_date, notes)
  VALUES (p_household_id, creator.id, NULL, p_category_id, 'income', 'pending', p_description, p_amount, p_transaction_date, p_transaction_date, p_notes) RETURNING id INTO transaction_id;
  RETURN transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_transfer(
  p_household_id uuid, p_source_account_id uuid, p_destination_account_id uuid, p_amount numeric, p_transaction_date date, p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE creator public.household_members; transaction_id uuid;
BEGIN
  SELECT * INTO creator FROM public.household_members m WHERE m.profile_id = auth.uid() AND m.household_id = p_household_id AND m.deactivated_at IS NULL LIMIT 1;
  IF creator.id IS NULL OR p_source_account_id = p_destination_account_id THEN RAISE EXCEPTION 'invalid transfer' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.transactions (household_id, created_by_member_id, type, status, description, amount, transaction_date, competence_date, notes)
  VALUES (p_household_id, creator.id, 'transfer', 'pending', 'Transferência entre contas', p_amount, p_transaction_date, p_transaction_date, p_notes) RETURNING id INTO transaction_id;
  INSERT INTO public.transfers (household_id, transaction_id, source_account_id, destination_account_id, settled_at) VALUES (p_household_id, transaction_id, p_source_account_id, p_destination_account_id, now());
  RETURN transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_expense_bundle(uuid,text,numeric,date,uuid,uuid,public.payment_instrument_kind,uuid,uuid,text,jsonb,integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_expense_bundle(uuid,text,numeric,date,uuid,uuid,public.payment_instrument_kind,uuid,uuid,text,jsonb,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.create_income_transaction(uuid,text,numeric,date,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_income_transaction(uuid,text,numeric,date,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_transfer(uuid,uuid,uuid,numeric,date,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_transfer(uuid,uuid,uuid,numeric,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pay_card_invoice(
  p_household_id uuid, p_invoice_id uuid, p_source_account_id uuid, p_funder_member_id uuid, p_amount numeric, p_paid_at timestamptz DEFAULT now()
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE creator public.household_members; invoice public.card_invoices; payment_transaction_id uuid;
BEGIN
  SELECT * INTO creator FROM public.household_members m WHERE m.profile_id = auth.uid() AND m.household_id = p_household_id AND m.deactivated_at IS NULL LIMIT 1;
  IF creator.id IS NULL THEN RAISE EXCEPTION 'authenticated active household membership required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO invoice FROM public.card_invoices i WHERE i.id = p_invoice_id AND i.household_id = p_household_id FOR UPDATE;
  IF invoice.id IS NULL OR p_amount <= 0 OR p_amount > invoice.total_amount - invoice.settled_amount THEN RAISE EXCEPTION 'invalid invoice payment' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.transactions (household_id, created_by_member_id, type, status, description, amount, transaction_date, competence_date, notes)
  VALUES (p_household_id, creator.id, 'invoice_payment', 'pending', 'Pagamento de fatura', p_amount, p_paid_at::date, p_paid_at::date, 'Liquidação de fatura; não cria nova despesa') RETURNING id INTO payment_transaction_id;
  INSERT INTO public.card_invoice_payments (household_id, invoice_id, payment_transaction_id, source_account_id, amount, paid_at) VALUES (p_household_id, p_invoice_id, payment_transaction_id, p_source_account_id, p_amount, p_paid_at);
  UPDATE public.card_invoices SET settled_amount = settled_amount + p_amount, status = CASE WHEN settled_amount + p_amount = total_amount THEN 'paid' ELSE 'open' END, settled_at = CASE WHEN settled_amount + p_amount = total_amount THEN p_paid_at ELSE NULL END, updated_at = now() WHERE id = p_invoice_id;
  INSERT INTO public.funding_events (household_id, financed_transaction_id, funding_transaction_id, funder_member_id, source_account_id, amount, funded_at)
  SELECT p_household_id, t.id, payment_transaction_id, p_funder_member_id, p_source_account_id, p_amount, p_paid_at FROM public.transactions t WHERE t.invoice_id = p_invoice_id LIMIT 1;
  RETURN payment_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_recurring_rule(
  p_household_id uuid, p_template_transaction_id uuid, p_frequency text, p_interval_count integer, p_start_date date, p_end_date date DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE creator public.household_members; rule_id uuid;
BEGIN
  SELECT * INTO creator FROM public.household_members m WHERE m.profile_id = auth.uid() AND m.household_id = p_household_id AND m.deactivated_at IS NULL LIMIT 1;
  IF creator.id IS NULL THEN RAISE EXCEPTION 'authenticated active household membership required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.recurring_rules (household_id, created_by_member_id, template_transaction_id, frequency, interval_count, start_date, end_date, next_occurrence_date)
  VALUES (p_household_id, creator.id, p_template_transaction_id, p_frequency, p_interval_count, p_start_date, p_end_date, p_start_date) RETURNING id INTO rule_id;
  RETURN rule_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_recurring_occurrence(
  p_household_id uuid, p_rule_id uuid, p_competence_date date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE creator public.household_members; rule public.recurring_rules; template public.transactions; occurrence_id uuid; generated_transaction_id uuid; instrument public.transaction_payment_instruments;
BEGIN
  SELECT * INTO creator FROM public.household_members m WHERE m.profile_id = auth.uid() AND m.household_id = p_household_id AND m.deactivated_at IS NULL LIMIT 1;
  IF creator.id IS NULL THEN RAISE EXCEPTION 'authenticated active household membership required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO rule FROM public.recurring_rules r WHERE r.id = p_rule_id AND r.household_id = p_household_id AND r.deactivated_at IS NULL FOR UPDATE;
  IF rule.id IS NULL THEN RAISE EXCEPTION 'recurring rule not found' USING ERRCODE = '42501'; END IF;
  SELECT * INTO template FROM public.transactions t WHERE t.id = rule.template_transaction_id AND t.household_id = p_household_id AND t.deleted_at IS NULL;
  IF template.id IS NULL THEN RAISE EXCEPTION 'recurring template not found' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.recurring_occurrences (household_id, recurring_rule_id, competence_date, due_date, status)
  VALUES (p_household_id, p_rule_id, p_competence_date, p_competence_date, 'planned')
  ON CONFLICT (recurring_rule_id, competence_date) DO UPDATE SET recurring_rule_id = EXCLUDED.recurring_rule_id
  RETURNING id INTO occurrence_id;
  IF (SELECT transaction_id FROM public.recurring_occurrences WHERE id = occurrence_id) IS NULL THEN
    INSERT INTO public.transactions (household_id, created_by_member_id, buyer_member_id, category_id, type, status, description, amount, transaction_date, competence_date, notes)
    VALUES (p_household_id, creator.id, template.buyer_member_id, template.category_id, template.type, 'planned', template.description, template.amount, p_competence_date, p_competence_date, template.notes)
    RETURNING id INTO generated_transaction_id;
    SELECT * INTO instrument FROM public.transaction_payment_instruments i WHERE i.transaction_id = template.id LIMIT 1;
    IF instrument.id IS NOT NULL THEN INSERT INTO public.transaction_payment_instruments (household_id, transaction_id, kind, account_id, card_id) VALUES (p_household_id, generated_transaction_id, instrument.kind, instrument.account_id, instrument.card_id); END IF;
    UPDATE public.recurring_occurrences SET transaction_id = generated_transaction_id WHERE id = occurrence_id;
  END IF;
  RETURN occurrence_id;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_card_invoice(uuid,uuid,uuid,uuid,numeric,timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pay_card_invoice(uuid,uuid,uuid,uuid,numeric,timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.create_recurring_rule(uuid,uuid,text,integer,date,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_recurring_rule(uuid,uuid,text,integer,date,date) TO authenticated;
REVOKE ALL ON FUNCTION public.generate_recurring_occurrence(uuid,uuid,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_recurring_occurrence(uuid,uuid,date) TO authenticated;
