import React from 'react';
import { motion } from 'motion/react';
import { Users, User, Calendar, RefreshCw } from 'lucide-react';
import type { DashboardPerspective, Category } from '../../types/index.js';
import { triggerHaptic } from '../../utils/haptics.js';

interface DashboardHeaderProps {
  perspective: DashboardPerspective;
  onPerspectiveChange: (perspective: DashboardPerspective) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  selectedCategory?: string;
  onCategoryChange?: (catId: string) => void;
  categories?: Category[];
}

const monthKey = (offset: number): string => {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const PREVIOUS_MONTH = monthKey(-1);
const CURRENT_MONTH = monthKey(0);
const NEXT_MONTH = monthKey(1);

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  perspective,
  onPerspectiveChange,
  selectedMonth,
  onMonthChange,
  onRefresh,
  isLoading
}) => {
  const isCurrentMonth = selectedMonth === CURRENT_MONTH;
  const isPreviousMonth = selectedMonth === PREVIOUS_MONTH;
  const isNextMonth = selectedMonth === NEXT_MONTH;
  const isCustomMonth = !isCurrentMonth && !isPreviousMonth && !isNextMonth;

  const handleToggle = (p: DashboardPerspective) => {
    triggerHaptic('selection');
    onPerspectiveChange(p);
  };

  const handlePeriodClick = (month: string) => {
    triggerHaptic('selection');
    onMonthChange(month);
  };

  const handleMonthSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    triggerHaptic('selection');
    onMonthChange(e.target.value);
  };

  return (
    <div
      id="dashboard-header-filters"
      className="bg-slate-900/95 backdrop-blur-md p-3.5 sm:p-4 rounded-3xl border border-slate-800 shadow-xl space-y-3"
    >
      {/* 1. SELETOR DE PERÍODO SIMPLIFICADO: Mês Atual | Mês Anterior | Seleção Mês/Ano */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 flex items-center p-1 bg-slate-950 rounded-2xl border border-slate-800/90 text-xs font-bold">
          {/* Mês Atual */}
          <button
            type="button"
            id="btn-period-current"
            onClick={() => handlePeriodClick(CURRENT_MONTH)}
            className={`flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 min-h-touch ${
              isCurrentMonth
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Mês Atual</span>
          </button>

          {/* Mês Anterior */}
          <button
            type="button"
            id="btn-period-previous"
            onClick={() => handlePeriodClick(PREVIOUS_MONTH)}
            className={`flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 min-h-touch ${
              isPreviousMonth
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Mês Anterior</span>
          </button>

          <button
            type="button"
            onClick={() => handlePeriodClick(NEXT_MONTH)}
            className={`flex-1 rounded-xl px-2 py-1.5 text-xs transition-all min-h-touch ${isNextMonth ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Seguinte
          </button>

          {/* Qualquer competência fora dos atalhos pode ser digitada no controle nativo. */}
          <div className={`relative flex-1 rounded-xl px-2 py-1.5 min-h-touch ${isCustomMonth ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>
            <span className="flex items-center justify-center gap-1 text-xs font-bold"><Calendar className="h-3 w-3" />{isCustomMonth ? selectedMonth : 'Outro'}</span>
            <input
              id="select-dashboard-custom-month"
              type="month"
              value={selectedMonth}
              onChange={handleMonthSelect}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Selecionar mês personalizado"
            />
          </div>
        </div>

        {/* Botão de Atualizar Instantâneo */}
        <button
          id="btn-refresh-dashboard"
          type="button"
          onClick={() => {
            triggerHaptic('impact-light');
            onRefresh();
          }}
          disabled={isLoading}
          className="p-2 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center min-h-touch min-w-[40px] shrink-0"
          title="Atualizar Dados"
          aria-label="Atualizar Dados do Dashboard"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 2. FILTRO RÁPIDO POR RESPONSÁVEL: Todos (Casal) | Pessoa A (Wallace) | Pessoa B (Guilherme) */}
      <div className="flex items-center justify-between gap-2">
        <div className="w-full">
          <div className="flex items-center p-1 bg-slate-950 rounded-2xl border border-slate-800/90 relative">
            {/* Todos / Casal */}
            <button
              id="btn-perspective-couple"
              type="button"
              onClick={() => handleToggle('couple')}
              className={`relative flex-1 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors z-10 min-h-touch ${
                perspective === 'couple' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {perspective === 'couple' && (
                <motion.div
                  layoutId="active-perspective-pill"
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="absolute inset-0 bg-blue-600 rounded-xl shadow-md shadow-blue-500/25 -z-10"
                />
              )}
              <Users className="w-3.5 h-3.5" />
              <span>Todos (Casal)</span>
            </button>

            {/* Pessoa A: Wallace */}
            <button
              id="btn-perspective-wallace"
              type="button"
              onClick={() => handleToggle('wallace')}
              className={`relative flex-1 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors z-10 min-h-touch ${
                perspective === 'wallace' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {perspective === 'wallace' && (
                <motion.div
                  layoutId="active-perspective-pill"
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="absolute inset-0 bg-emerald-600 rounded-xl shadow-md shadow-emerald-500/25 -z-10"
                />
              )}
              <User className="w-3.5 h-3.5" />
              <span>Wallace</span>
            </button>

            {/* Pessoa B: Guilherme */}
            <button
              id="btn-perspective-guilherme"
              type="button"
              onClick={() => handleToggle('guilherme')}
              className={`relative flex-1 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors z-10 min-h-touch ${
                perspective === 'guilherme' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {perspective === 'guilherme' && (
                <motion.div
                  layoutId="active-perspective-pill"
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="absolute inset-0 bg-indigo-600 rounded-xl shadow-md shadow-indigo-500/25 -z-10"
                />
              )}
              <User className="w-3.5 h-3.5" />
              <span>Guilherme</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
