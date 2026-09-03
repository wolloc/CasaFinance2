import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Scale,
  TrendingUp,
  Wallet
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardAccountingSnapshot } from '../../domain/dashboard.js';
import type { DashboardPerspective } from '../../types/index.js';
import { AccountingTooltip } from './AccountingTooltip.js';

interface MainMetricsCardProps {
  accounting: DashboardAccountingSnapshot;
  perspective: DashboardPerspective;
}

interface Metric {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  tooltip?: 'Saldo real' | 'Projetado';
}

const currency = (value: number): string => value.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

export const MainMetricsCard: React.FC<MainMetricsCardProps> = ({ accounting, perspective }) => {
  const perspectiveLabel = perspective === 'couple' ? 'Casa / casal' : perspective === 'wallace' ? 'Wallace' : 'Guilherme';
  const metrics: Metric[] = [
    { label: 'Receitas realizadas', value: accounting.realizedIncome, icon: ArrowUpRight, tone: 'text-emerald-400' },
    { label: 'Receitas previstas', value: accounting.projectedIncome, icon: CalendarClock, tone: 'text-emerald-300', tooltip: 'Projetado' },
    { label: 'Despesas realizadas', value: accounting.realizedExpenses, icon: ArrowDownRight, tone: 'text-rose-400' },
    { label: 'Despesas previstas', value: accounting.projectedExpenses, icon: CalendarClock, tone: 'text-amber-300', tooltip: 'Projetado' },
    { label: 'Fatura / cartões', value: accounting.cardInvoices, icon: CreditCard, tone: 'text-violet-300' },
    { label: 'Saldo real consolidado', value: accounting.realCashBalance, icon: Wallet, tone: accounting.realCashBalance >= 0 ? 'text-white' : 'text-rose-400', tooltip: 'Saldo real' },
    { label: 'Resultado realizado', value: accounting.realizedMonthlyResult, icon: Scale, tone: accounting.realizedMonthlyResult >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Comprometimento projetado', value: accounting.projectedCommitments, icon: CircleDollarSign, tone: 'text-amber-300', tooltip: 'Projetado' },
    { label: 'Saldo projetado', value: accounting.projectedEndBalance, icon: TrendingUp, tone: accounting.projectedEndBalance >= 0 ? 'text-sky-300' : 'text-rose-400', tooltip: 'Projetado' },
    { label: 'Contas e investimentos', value: accounting.accountAndInvestmentAssets, icon: Building2, tone: 'text-blue-300' },
    { label: 'Obrigações de empréstimos', value: accounting.loanObligations, icon: Landmark, tone: 'text-orange-300' }
  ];

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/95 p-4 shadow-xl sm:p-6" aria-labelledby="accounting-summary-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Fonte única: ledger</p>
          <h2 id="accounting-summary-title" className="text-base font-black text-white">Resumo contábil · {perspectiveLabel}</h2>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[10px] font-bold text-slate-300">Sem transferências duplicadas</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone, tooltip }) => (
          <article key={label} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/80 p-3.5">
            <div className="mb-2 flex items-start justify-between gap-2 text-slate-400">
              <span className="text-[10px] font-bold uppercase leading-tight tracking-wide">{label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {tooltip && <AccountingTooltip term={tooltip} />}
                <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
              </span>
            </div>
            <strong className={`block truncate text-sm font-black sm:text-lg ${tone}`} title={currency(value)}>{currency(value)}</strong>
          </article>
        ))}
      </div>
    </section>
  );
};
