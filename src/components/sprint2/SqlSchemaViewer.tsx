import React, { useState } from 'react';
import { Copy, Check, Code, ShieldCheck, Database } from 'lucide-react';

export const SqlSchemaViewer: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const sqlCode = `-- TABELA: ACCOUNTS
CREATE TABLE public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    account_type account_type_enum NOT NULL DEFAULT 'checking',
    institution VARCHAR(100),
    initial_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABELA: CARDS
CREATE TABLE public.cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    institution VARCHAR(100) NOT NULL,
    card_type card_type_enum NOT NULL DEFAULT 'credit',
    credit_limit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    closing_day SMALLINT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
    due_day SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    color VARCHAR(20) NOT NULL DEFAULT '#2563eb',
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- TABELA: CATEGORIES
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name VARCHAR(80) NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'tag',
    color VARCHAR(20) NOT NULL DEFAULT '#64748b',
    type category_type_enum NOT NULL DEFAULT 'expense'
);

-- POLÍTICAS RLS ATIVAS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_accounts_isolation ON public.accounts
    FOR ALL USING (public.is_household_member(household_id));
CREATE POLICY rls_cards_isolation ON public.cards
    FOR ALL USING (public.is_household_member(household_id));
CREATE POLICY rls_categories_isolation ON public.categories
    FOR ALL USING (public.is_household_member(household_id));`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 text-white space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold text-slate-200">Definição DDL SQL & Políticas RLS</h3>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copiado!' : 'Copiar DDL'}</span>
        </button>
      </div>

      <pre className="p-3 bg-slate-950 rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-56 border border-slate-800/80 leading-relaxed">
        {sqlCode}
      </pre>

      <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-850 p-2.5 rounded-xl border border-slate-800">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Garantia de que consultas `SELECT`, `INSERT`, `UPDATE` e `DELETE` sejam filtradas exclusivamente pelos membros com vínculo ativo no `household_members`.</span>
      </div>
    </div>
  );
};
