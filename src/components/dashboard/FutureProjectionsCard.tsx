import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarRange,
  TrendingUp,
  Receipt,
  CreditCard,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import type { MonthlyCommitmentProjection } from '../../types/index.js';
import { triggerHaptic } from '../../utils/haptics.js';

interface FutureProjectionsCardProps {
  projections: MonthlyCommitmentProjection[];
}

export const FutureProjectionsCard: React.FC<FutureProjectionsCardProps> = ({ projections = [] }) => {
  const [horizon, setHorizon] = useState<'1m' | '3m' | '6m'>('3m');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);

  const horizonCount = horizon === '1m' ? 2 : horizon === '3m' ? 4 : 7;
  const visibleProjections = projections.slice(0, Math.min(projections.length, horizonCount));

  const handleHorizonChange = (h: '1m' | '3m' | '6m') => {
    triggerHaptic('selection');
    setHorizon(h);
    setSelectedMonthIndex(0);
  };

  const handleSelectMonth = (idx: number) => {
    triggerHaptic('selection');
    setSelectedMonthIndex(idx);
  };

  const activeProj = visibleProjections[selectedMonthIndex] || visibleProjections[0];

  return (
    <div className="bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-800 shadow-xl overflow-hidden p-5 sm:p-6 space-y-4">
      {/* Header & Horizon Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center justify-center">
              <CalendarRange className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white">Projeção de Gastos Futuros</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Comprometimento previsto (Contas Fixas + Parcelas de Cartão)
          </p>
        </div>

        {/* Horizon Pills (+1m, +3m, +6m) */}
        <div className="flex items-center p-1 bg-slate-950 rounded-2xl border border-slate-800/90 relative self-start sm:self-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => handleHorizonChange('1m')}
            className={`relative px-3 py-1.5 rounded-xl transition-colors z-10 min-h-touch ${
              horizon === '1m' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {horizon === '1m' && (
              <motion.div
                layoutId="active-horizon-pill"
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="absolute inset-0 bg-purple-600 rounded-xl shadow-md shadow-purple-500/20 -z-10"
              />
            )}
            <span>+1 Mês</span>
          </button>

          <button
            type="button"
            onClick={() => handleHorizonChange('3m')}
            className={`relative px-3 py-1.5 rounded-xl transition-colors z-10 min-h-touch ${
              horizon === '3m' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {horizon === '3m' && (
              <motion.div
                layoutId="active-horizon-pill"
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="absolute inset-0 bg-purple-600 rounded-xl shadow-md shadow-purple-500/20 -z-10"
              />
            )}
            <span>+3 Meses</span>
          </button>

          <button
            type="button"
            onClick={() => handleHorizonChange('6m')}
            className={`relative px-3 py-1.5 rounded-xl transition-colors z-10 min-h-touch ${
              horizon === '6m' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {horizon === '6m' && (
              <motion.div
                layoutId="active-horizon-pill"
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="absolute inset-0 bg-purple-600 rounded-xl shadow-md shadow-purple-500/20 -z-10"
              />
            )}
            <span>+6 Meses</span>
          </button>
        </div>
      </div>

      {/* Monthly Timeline Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {visibleProjections.map((p, idx) => {
          const isSelected = selectedMonthIndex === idx;
          return (
            <button
              key={p.month_year}
              type="button"
              onClick={() => handleSelectMonth(idx)}
              className={`p-3 rounded-2xl border text-left transition-all relative ${
                isSelected
                  ? 'bg-slate-950 border-purple-500/70 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500/50'
                  : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-300 block truncate">
                  {p.label.replace(' (+0m)', '')}
                </span>
                {idx === 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Mês Atual
                  </span>
                )}
              </div>

              <span className="text-sm font-black text-white block">
                R$ {p.total_committed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>

              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                <span>{p.fixed_bills_count} fixas</span>
                <span>•</span>
                <span>{p.installments_count} parc.</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail Breakdown for Selected Projection Month */}
      {activeProj && (
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              Composição de <strong>{activeProj.label}</strong>
            </span>
            <span className="text-xs font-black text-purple-300">
              Total: R$ {activeProj.total_committed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Contas Fixas Recorrentes */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/25 shrink-0">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Contas Fixas</span>
                  <span className="text-[10px] text-slate-400">{activeProj.fixed_bills_count} contas recorrentes</span>
                </div>
              </div>
              <span className="text-xs font-black text-amber-400">
                R$ {activeProj.fixed_bills_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Parcelas de Cartão Ativas */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center border border-sky-500/25 shrink-0">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Parcelas de Cartão</span>
                  <span className="text-[10px] text-slate-400">{activeProj.installments_count} parcelas ativas</span>
                </div>
              </div>
              <span className="text-xs font-black text-sky-400">
                R$ {activeProj.credit_installments_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
