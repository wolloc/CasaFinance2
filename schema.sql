-- ==============================================================================
-- CASA FINANCE - SPRINT 2: ESQUEMA DDL RELACIONAL COM RLS (POSTGRESQL / LEDGER)
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. DOMÍNIOS E TIPOS ENUMERADOS
DO $$ BEGIN
    CREATE TYPE account_type_enum AS ENUM ('checking', 'savings', 'cash', 'meal_benefit', 'digital_wallet', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE card_type_enum AS ENUM ('credit', 'debit', 'multiple');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE category_type_enum AS ENUM ('expense', 'income');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABELA: ACCOUNTS (Contas Bancárias, Carteiras Físicas e Vale-Alimentação)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL,
    owner_user_id UUID, -- NULL representa Conta Conjunta do Casal
    name VARCHAR(100) NOT NULL,
    account_type account_type_enum NOT NULL DEFAULT 'checking',
    institution VARCHAR(100),
    identification VARCHAR(120),
    initial_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints Relacionais
    CONSTRAINT fk_accounts_household FOREIGN KEY (household_id) 
        REFERENCES public.households(id) ON DELETE CASCADE,
    CONSTRAINT fk_accounts_owner FOREIGN KEY (owner_user_id) 
        REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT chk_accounts_balance_finite CHECK (current_balance IS NOT NULL)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_accounts_household_id ON public.accounts(household_id);
CREATE INDEX IF NOT EXISTS idx_accounts_owner_user_id ON public.accounts(owner_user_id);

-- 4. TABELA: CARDS (Cartões de Crédito e Múltiplos)
CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL,
    owner_user_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    institution VARCHAR(100) NOT NULL,
    card_type card_type_enum NOT NULL DEFAULT 'credit',
    credit_limit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    closing_day SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
    due_day SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    default_payment_account_id UUID,
    color VARCHAR(20) NOT NULL DEFAULT '#2563eb',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints Relacionais
    CONSTRAINT fk_cards_household FOREIGN KEY (household_id) 
        REFERENCES public.households(id) ON DELETE CASCADE,
    CONSTRAINT fk_cards_owner FOREIGN KEY (owner_user_id) 
        REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cards_default_account FOREIGN KEY (default_payment_account_id) 
        REFERENCES public.accounts(id) ON DELETE SET NULL,
    CONSTRAINT chk_cards_credit_limit_non_negative CHECK (credit_limit >= 0.00)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_cards_household_id ON public.cards(household_id);
CREATE INDEX IF NOT EXISTS idx_cards_owner_user_id ON public.cards(owner_user_id);

-- 5. TABELA: CATEGORIES (Categorias de Despesas e Receitas do Casal)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL,
    parent_id UUID,
    name VARCHAR(80) NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'tag',
    color VARCHAR(20) NOT NULL DEFAULT '#64748b',
    type category_type_enum NOT NULL DEFAULT 'expense',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints Relacionais
    CONSTRAINT fk_categories_household FOREIGN KEY (household_id) 
        REFERENCES public.households(id) ON DELETE CASCADE,
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) 
        REFERENCES public.categories(id) ON DELETE SET NULL
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_categories_household_id ON public.categories(household_id);

-- ==============================================================================
-- 6. POLÍTICAS DE SEGURANÇA ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Habilita RLS nas tabelas
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Helper: Função que checa se o usuário atual autenticado é membro ativo do Household
CREATE OR REPLACE FUNCTION public.is_household_member(check_household_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.household_members hm
        WHERE hm.household_id = check_household_id
          AND hm.user_id = NULLIF(current_setting('app.current_user_id', true), '')::UUID
          AND hm.is_active = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLÍTICAS RLS: ACCOUNTS
DROP POLICY IF EXISTS rls_accounts_isolation ON public.accounts;
CREATE POLICY rls_accounts_isolation ON public.accounts
    FOR ALL
    USING (public.is_household_member(household_id))
    WITH CHECK (public.is_household_member(household_id));

-- POLÍTICAS RLS: CARDS
DROP POLICY IF EXISTS rls_cards_isolation ON public.cards;
CREATE POLICY rls_cards_isolation ON public.cards
    FOR ALL
    USING (public.is_household_member(household_id))
    WITH CHECK (public.is_household_member(household_id));

-- POLÍTICAS RLS: CATEGORIES
DROP POLICY IF EXISTS rls_categories_isolation ON public.categories;
CREATE POLICY rls_categories_isolation ON public.categories
    FOR ALL
    USING (public.is_household_member(household_id))
    WITH CHECK (public.is_household_member(household_id));

-- ============================================================================
-- SPRINT 6: CONTAS RECORRENTES, OCORRÊNCIAS & PROJEÇÃO DE COMPROMETIMENTO
-- ============================================================================

-- 1. Tabela de Contas Recorrentes (Despesas Fixas)
CREATE TABLE IF NOT EXISTS public.recurring_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    buyer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    payer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    merchant VARCHAR(150),
    expected_amount NUMERIC(12, 2) NOT NULL CHECK (expected_amount > 0),
    due_day SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    frequency VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly', 'weekly'
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    payment_method_id VARCHAR(50) NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    card_id UUID REFERENCES public.cards(id) ON DELETE SET NULL,
    beneficiary_type VARCHAR(20) NOT NULL DEFAULT 'both',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    auto_generate BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Ocorrências Mensais das Contas Fixas
CREATE TABLE IF NOT EXISTS public.bill_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recurring_bill_id UUID NOT NULL REFERENCES public.recurring_bills(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    competence_month VARCHAR(7) NOT NULL, -- 'YYYY-MM'
    due_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'skipped'
    paid_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(recurring_bill_id, competence_month)
);

-- Habilitar RLS
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_occurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_recurring_bills_isolation ON public.recurring_bills;
CREATE POLICY rls_recurring_bills_isolation ON public.recurring_bills
    FOR ALL
    USING (public.is_household_member(household_id))
    WITH CHECK (public.is_household_member(household_id));

DROP POLICY IF EXISTS rls_bill_occurrences_isolation ON public.bill_occurrences;
CREATE POLICY rls_bill_occurrences_isolation ON public.bill_occurrences
    FOR ALL
    USING (public.is_household_member(household_id))
    WITH CHECK (public.is_household_member(household_id));

-- 3. Procedure / RPC: Gerar Ocorrências Automáticas para um Mês Específico
CREATE OR REPLACE FUNCTION generate_monthly_bill_occurrences(
    p_household_id UUID,
    p_month_year VARCHAR(7) -- Formato 'YYYY-MM'
)
RETURNS INT AS $$
DECLARE
    v_bill RECORD;
    v_year INT;
    v_month INT;
    v_due_date DATE;
    v_count INT := 0;
BEGIN
    v_year := SPLIT_PART(p_month_year, '-', 1)::INT;
    v_month := SPLIT_PART(p_month_year, '-', 2)::INT;

    FOR v_bill IN 
        SELECT * FROM public.recurring_bills 
        WHERE household_id = p_household_id AND is_active = TRUE AND auto_generate = TRUE
    LOOP
        -- Protege contra dias inexistentes (ex: 31 de fev)
        v_due_date := make_date(
            v_year, 
            v_month, 
            LEAST(v_bill.due_day, EXTRACT(DAY FROM (date_trunc('month', make_date(v_year, v_month, 1)) + interval '1 month - 1 day'))::INT)
        );

        INSERT INTO public.bill_occurrences (
            recurring_bill_id,
            household_id,
            competence_month,
            due_date,
            amount,
            status
        )
        VALUES (
            v_bill.id,
            p_household_id,
            p_month_year,
            v_due_date,
            v_bill.expected_amount,
            'pending'
        )
        ON CONFLICT (recurring_bill_id, competence_month) DO NOTHING;

        IF FOUND THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função / RPC: Obter Projeção de Comprometimento Futuro (+1m, +3m, +6m, +12m)
CREATE OR REPLACE FUNCTION get_future_commitments_projection(
    p_household_id UUID,
    p_months_ahead INT DEFAULT 12
)
RETURNS TABLE (
    month_year VARCHAR(7),
    fixed_bills_total NUMERIC(12, 2),
    credit_installments_total NUMERIC(12, 2),
    total_committed NUMERIC(12, 2)
) AS $$
BEGIN
    RETURN QUERY
    WITH future_months AS (
        SELECT to_char(date_trunc('month', CURRENT_DATE) + (i || ' month')::interval, 'YYYY-MM')::VARCHAR(7) AS m_year
        FROM generate_series(0, p_months_ahead) AS i
    ),
    fixed_sums AS (
        SELECT 
            fm.m_year,
            COALESCE(SUM(rb.expected_amount), 0) AS total_fixed
        FROM future_months fm
        CROSS JOIN public.recurring_bills rb
        WHERE rb.household_id = p_household_id AND rb.is_active = TRUE
        GROUP BY fm.m_year
    ),
    installment_sums AS (
        SELECT 
            to_char(inst.competence_date, 'YYYY-MM')::VARCHAR(7) AS m_year,
            COALESCE(SUM(inst.amount), 0) AS total_inst
        FROM public.installments inst
        JOIN public.installment_plans ip ON inst.installment_plan_id = ip.id
        JOIN public.transactions t ON ip.transaction_id = t.id
        WHERE t.household_id = p_household_id AND inst.status != 'paid'
        GROUP BY to_char(inst.competence_date, 'YYYY-MM')
    )
    SELECT 
        fm.m_year AS month_year,
        COALESCE(fs.total_fixed, 0)::NUMERIC(12, 2) AS fixed_bills_total,
        COALESCE(ins.total_inst, 0)::NUMERIC(12, 2) AS credit_installments_total,
        (COALESCE(fs.total_fixed, 0) + COALESCE(ins.total_inst, 0))::NUMERIC(12, 2) AS total_committed
    FROM future_months fm
    LEFT JOIN fixed_sums fs ON fm.m_year = fs.m_year
    LEFT JOIN installment_sums ins ON fm.m_year = ins.m_year
    ORDER BY fm.m_year ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SPRINT 7: MÓDULO DE ACERTO DO CASAL (COMPENSAÇÃO WALLACE & GUILHERME)
-- ============================================================================

-- 1. Tabela de Acertos / Liquidações (Settlements)
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    settled_amount NUMERIC(12, 2) NOT NULL CHECK (settled_amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'completed', -- 'completed', 'cancelled'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_settlements_isolation ON public.settlements;
CREATE POLICY rls_settlements_isolation ON public.settlements
    FOR ALL
    USING (public.is_household_member(household_id))
    WITH CHECK (public.is_household_member(household_id));

-- 2. View Contábil: Saldo $Pagos - Devidos$ por Usuário (Excluindo Transferências e Pagamentos de Fatura)
CREATE OR REPLACE VIEW public.vw_couple_settlement_balance AS
WITH valid_expenses AS (
    -- IMPORTANTE: Exclui 'transfer' e 'invoice_payment' para evitar dupla contagem contábil
    SELECT 
        t.id,
        t.household_id,
        t.payer_user_id,
        t.total_amount,
        t.transaction_date,
        to_char(t.transaction_date, 'YYYY-MM') AS competence_month
    FROM public.transactions t
    WHERE t.status = 'completed'
      AND t.transaction_type = 'expense'
),
paid_by_user AS (
    SELECT 
        ve.household_id,
        ve.payer_user_id AS user_id,
        COALESCE(SUM(ve.total_amount), 0) AS total_paid
    FROM valid_expenses ve
    GROUP BY ve.household_id, ve.payer_user_id
),
responsible_by_user AS (
    SELECT 
        t.household_id,
        ts.responsible_user_id AS user_id,
        COALESCE(SUM(ts.amount), 0) AS total_responsibility
    FROM public.transaction_splits ts
    JOIN public.transactions t ON ts.transaction_id = t.id
    WHERE t.status = 'completed'
      AND t.transaction_type = 'expense'
    GROUP BY t.household_id, ts.responsible_user_id
),
settlements_paid AS (
    SELECT 
        s.household_id,
        s.payer_user_id AS user_id,
        COALESCE(SUM(s.settled_amount), 0) AS settlement_paid
    FROM public.settlements s
    WHERE s.status = 'completed'
    GROUP BY s.household_id, s.payer_user_id
),
settlements_received AS (
    SELECT 
        s.household_id,
        s.receiver_user_id AS user_id,
        COALESCE(SUM(s.settled_amount), 0) AS settlement_received
    FROM public.settlements s
    WHERE s.status = 'completed'
    GROUP BY s.household_id, s.receiver_user_id
)
SELECT 
    hm.household_id,
    u.id AS user_id,
    u.name AS user_name,
    u.pix_key,
    COALESCE(pu.total_paid, 0) + COALESCE(sp.settlement_paid, 0) AS total_paid,
    COALESCE(ru.total_responsibility, 0) + COALESCE(sr.settlement_received, 0) AS total_responsibility,
    (COALESCE(pu.total_paid, 0) + COALESCE(sp.settlement_paid, 0)) - 
    (COALESCE(ru.total_responsibility, 0) + COALESCE(sr.settlement_received, 0)) AS net_balance
FROM public.household_members hm
JOIN public.users u ON hm.user_id = u.id
LEFT JOIN paid_by_user pu ON hm.household_id = pu.household_id AND hm.user_id = pu.user_id
LEFT JOIN responsible_by_user ru ON hm.household_id = ru.household_id AND hm.user_id = ru.user_id
LEFT JOIN settlements_paid sp ON hm.household_id = sp.household_id AND hm.user_id = sp.user_id
LEFT JOIN settlements_received sr ON hm.household_id = sr.household_id AND hm.user_id = sr.user_id
WHERE hm.is_active = TRUE;

-- 3. Procedure / RPC: Registrar Acerto / Compensação Financeira
CREATE OR REPLACE FUNCTION record_couple_settlement(
    p_household_id UUID,
    p_payer_user_id UUID,
    p_receiver_user_id UUID,
    p_settled_amount NUMERIC(12, 2),
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_settlement_id UUID;
BEGIN
    IF p_settled_amount <= 0 THEN
        RAISE EXCEPTION 'O valor do acerto deve ser positivo.';
    END IF;

    INSERT INTO public.settlements (
        household_id,
        payer_user_id,
        receiver_user_id,
        settled_amount,
        status,
        notes
    )
    VALUES (
        p_household_id,
        p_payer_user_id,
        p_receiver_user_id,
        p_settled_amount,
        'completed',
        p_notes
    )
    RETURNING id INTO v_settlement_id;

    RETURN v_settlement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SPRINT 8: REFINAMENTO, TESTES DE BORDA & SEGURANÇA (PROMPT 5)
-- ============================================================================

-- 1. Índices de Alta Performance & Otimização de Consultas
CREATE INDEX IF NOT EXISTS idx_transactions_household_date ON public.transactions(household_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_card_id ON public.transactions(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transaction_splits_tx_user ON public.transaction_splits(transaction_id, responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_household_created ON public.audit_logs(household_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bill_occurrences_competence ON public.bill_occurrences(household_id, competence_month);
CREATE INDEX IF NOT EXISTS idx_settlements_household_date ON public.settlements(household_id, settlement_date DESC);

-- 2. Trigger de Auditoria Contábil Automática em Mutations
CREATE OR REPLACE FUNCTION process_audit_logging()
RETURNS TRIGGER AS $$
DECLARE
    v_household_id UUID;
    v_user_id UUID;
    v_user_name TEXT;
BEGIN
    v_user_id := auth.uid();
    
    IF TG_OP = 'DELETE' THEN
        v_household_id := OLD.household_id;
        INSERT INTO public.audit_logs (
            household_id,
            user_id,
            action,
            entity_name,
            entity_id,
            old_values,
            new_values
        ) VALUES (
            v_household_id,
            v_user_id,
            'DELETE',
            TG_TABLE_NAME,
            OLD.id::text,
            to_jsonb(OLD),
            NULL
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        v_household_id := NEW.household_id;
        INSERT INTO public.audit_logs (
            household_id,
            user_id,
            action,
            entity_name,
            entity_id,
            old_values,
            new_values
        ) VALUES (
            v_household_id,
            v_user_id,
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id::text,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        v_household_id := NEW.household_id;
        INSERT INTO public.audit_logs (
            household_id,
            user_id,
            action,
            entity_name,
            entity_id,
            old_values,
            new_values
        ) VALUES (
            v_household_id,
            v_user_id,
            'INSERT',
            TG_TABLE_NAME,
            NEW.id::text,
            NULL,
            to_jsonb(NEW)
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar triggers de auditoria nas tabelas financeiras essenciais
DROP TRIGGER IF EXISTS trg_audit_transactions ON public.transactions;
CREATE TRIGGER trg_audit_transactions
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION process_audit_logging();

DROP TRIGGER IF EXISTS trg_audit_settlements ON public.settlements;
CREATE TRIGGER trg_audit_settlements
AFTER INSERT OR UPDATE OR DELETE ON public.settlements
FOR EACH ROW EXECUTE FUNCTION process_audit_logging();

-- ============================================================================
-- SPRINT 5 (REPROCESSAMENTO): VIEWS & RPCS DO DASHBOARD SUPABASE (PROMPT 3 & 4)
-- ============================================================================

-- 1. VIEW: view_dashboard_summary (Total gasto, receitas, saldo por competência)
CREATE OR REPLACE VIEW public.view_dashboard_summary AS
WITH monthly_expenses AS (
    SELECT 
        t.household_id,
        to_char(t.transaction_date, 'YYYY-MM') AS competence_month,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'expense' THEN t.total_amount ELSE 0 END), 0) AS total_expenses,
        COALESCE(SUM(CASE WHEN t.transaction_type = 'income' THEN t.total_amount ELSE 0 END), 0) AS total_incomes
    FROM public.transactions t
    WHERE t.status = 'completed'
      AND t.transaction_type IN ('expense', 'income')
    GROUP BY t.household_id, to_char(t.transaction_date, 'YYYY-MM')
),
accounts_balance AS (
    SELECT 
        a.household_id,
        COALESCE(SUM(a.current_balance), 0) AS household_total_balance
    FROM public.accounts a
    WHERE a.is_active = TRUE
    GROUP BY a.household_id
)
SELECT 
    me.household_id,
    me.competence_month,
    me.total_expenses,
    me.total_incomes,
    (me.total_incomes - me.total_expenses) AS monthly_net_result,
    COALESCE(ab.household_total_balance, 0) AS current_liquid_balance
FROM monthly_expenses me
LEFT JOIN accounts_balance ab ON me.household_id = ab.household_id;

-- 2. VIEW: view_cards_overview (Cartões Porto, Infinity, Múltiplo, ITI com fatura aberta)
CREATE OR REPLACE VIEW public.view_cards_overview AS
SELECT 
    c.id AS card_id,
    c.household_id,
    c.owner_user_id,
    u.name AS owner_name,
    c.name AS card_name,
    c.institution,
    c.color,
    c.credit_limit,
    c.closing_day,
    c.due_day,
    to_char(CURRENT_DATE + INTERVAL '1 month', 'YYYY-MM') AS current_invoice_month,
    COALESCE((
        SELECT SUM(t.total_amount)
        FROM public.transactions t
        WHERE t.card_id = c.id
          AND t.status = 'completed'
          AND t.transaction_type = 'expense'
          AND t.transaction_date >= (CURRENT_DATE - INTERVAL '30 days')
    ), 0.00) AS current_invoice_amount,
    (c.credit_limit - COALESCE((
        SELECT SUM(t.total_amount)
        FROM public.transactions t
        WHERE t.card_id = c.id
          AND t.status = 'completed'
          AND t.transaction_type = 'expense'
          AND t.transaction_date >= (CURRENT_DATE - INTERVAL '30 days')
    ), 0.00)) AS available_limit
FROM public.cards c
JOIN public.users u ON c.owner_user_id = u.id
WHERE c.is_active = TRUE;

-- 3. VIEW: view_accounts_overview (Saldos de Pix/Débito, Carteira e Vale-Alimentação)
CREATE OR REPLACE VIEW public.view_accounts_overview AS
SELECT 
    a.id AS account_id,
    a.household_id,
    a.owner_user_id,
    COALESCE(u.name, 'Conta Conjunta') AS owner_name,
    a.name AS account_name,
    a.account_type,
    a.institution,
    a.current_balance,
    a.is_active
FROM public.accounts a
LEFT JOIN public.users u ON a.owner_user_id = u.id
WHERE a.is_active = TRUE;

-- 4. VIEW: view_upcoming_commitments (Contas fixas e parcelas futuras ordenadas)
CREATE OR REPLACE VIEW public.view_upcoming_commitments AS
SELECT 
    bo.id AS commitment_id,
    bo.household_id,
    'recurring_bill' AS commitment_type,
    rb.description,
    bo.due_date,
    bo.amount,
    rb.beneficiary_type,
    u.name AS payer_name,
    c.name AS category_name,
    bo.status
FROM public.bill_occurrences bo
JOIN public.recurring_bills rb ON bo.recurring_bill_id = rb.id
JOIN public.users u ON rb.payer_user_id = u.id
LEFT JOIN public.categories c ON rb.category_id = c.id
WHERE bo.status = 'pending'
ORDER BY bo.due_date ASC;

-- 5. VIEW: view_settlement_summary (Resumo executivo do balanço do casal)
CREATE OR REPLACE VIEW public.view_settlement_summary AS
SELECT 
    b.household_id,
    MAX(CASE WHEN b.user_name LIKE 'Wallace%' THEN b.total_paid ELSE 0 END) AS wallace_paid,
    MAX(CASE WHEN b.user_name LIKE 'Wallace%' THEN b.total_responsibility ELSE 0 END) AS wallace_responsibility,
    MAX(CASE WHEN b.user_name LIKE 'Wallace%' THEN b.net_balance ELSE 0 END) AS wallace_net_balance,
    MAX(CASE WHEN b.user_name LIKE 'Guilherme%' THEN b.total_paid ELSE 0 END) AS guilherme_paid,
    MAX(CASE WHEN b.user_name LIKE 'Guilherme%' THEN b.total_responsibility ELSE 0 END) AS guilherme_responsibility,
    MAX(CASE WHEN b.user_name LIKE 'Guilherme%' THEN b.net_balance ELSE 0 END) AS guilherme_net_balance
FROM public.vw_couple_settlement_balance b
GROUP BY b.household_id;

-- ============================================================================
-- SPRINT 6 (PROMPT 6): IA, OCR & IMPORTAÇÃO DE FATURAS E COMPROVANTES
-- ============================================================================

-- 1. Tabela de Histórico de Uploads e OCR
CREATE TABLE IF NOT EXISTS public.document_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    file_url TEXT,
    document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('RECEIPT', 'INVOICE')),
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING' CHECK (status IN ('PROCESSING', 'AWAITING_REVIEW', 'CONFIRMED', 'FAILED')),
    document_fingerprint VARCHAR(64) NOT NULL,
    raw_ocr_response JSONB,
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES public.users(id),
    created_transaction_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migração idempotente para instalações anteriores ao fluxo de revisão.
ALTER TABLE public.document_imports ADD COLUMN IF NOT EXISTS document_fingerprint VARCHAR(64);
ALTER TABLE public.document_imports ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.document_imports ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.users(id);
ALTER TABLE public.document_imports ADD COLUMN IF NOT EXISTS created_transaction_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.document_imports DROP CONSTRAINT IF EXISTS document_imports_status_check;
ALTER TABLE public.document_imports ADD CONSTRAINT document_imports_status_check CHECK (status IN ('PROCESSING', 'AWAITING_REVIEW', 'CONFIRMED', 'FAILED'));

-- 2. Tabela de Regras de Categorias Aprendidas por Estabelecimento
CREATE TABLE IF NOT EXISTS public.merchant_category_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    merchant_pattern VARCHAR(100) NOT NULL,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(household_id, merchant_pattern)
);

-- Habilitar RLS
ALTER TABLE public.document_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_category_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_document_imports_isolation ON public.document_imports;
CREATE POLICY rls_document_imports_isolation ON public.document_imports
    FOR ALL
    USING (public.is_household_member(household_id))
    WITH CHECK (public.is_household_member(household_id));

DROP POLICY IF EXISTS rls_merchant_category_rules_isolation ON public.merchant_category_rules;
CREATE POLICY rls_merchant_category_rules_isolation ON public.merchant_category_rules
    FOR ALL
    USING (public.is_household_member(household_id))
    WITH CHECK (public.is_household_member(household_id));

CREATE INDEX IF NOT EXISTS idx_document_imports_household ON public.document_imports(household_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_document_import_fingerprint ON public.document_imports(household_id, document_fingerprint) WHERE status <> 'FAILED';
CREATE INDEX IF NOT EXISTS idx_merchant_rules_pattern ON public.merchant_category_rules(household_id, merchant_pattern);
