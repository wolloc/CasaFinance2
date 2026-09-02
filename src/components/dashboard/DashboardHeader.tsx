import React from 'react';
import { motion } from 'motion/react';
import { Users, User, Calendar, RefreshCw, ChevronDown } from 'lucide-react';
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

const CURRENT_MONTH = '2026-05';
const PREVIOUS_MONTH = '2026-04';

const MONTH_OPTIONS = [
  { value: '2026-01', label: 'Jan / 2026' },
  { value: '2026-02', label: 'Fev / 2026' },
  { value: '2026-03', label: 'Mar / 2026' },
  { value: '2026-04', label: 'Abr / 2026 (Mês Anterior)' },
  { value: '2026-05', label: 'Mai / 2026 (Mês Atual)' },
  { value: '2026-06', label: 'Jun / 2026' },
  { value: '2026-07', label: 'Jul / 2026' },
  { value: '2026-08', label: 'Ago / 2026' },
  { value: '2026-09', label: 'Set / 2026' },
  { value: '2026-10', label: 'Out / 2026' },
  { value: '2026-11', label: 'Nov / 2026' },
  { value: '2026-12', label: 'Dez / 2026' }
];

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
  const isCustomMonth = !isCurrentMonth && !isPreviousMonth;

  const handleToggle = (p: DashboardPerspective) => {
    triggerHaptic('selection');
    onPerspectiveChange(p);
  };

  const handlePeriodClick = (month: string) => {
    triggerHaptic('selection');
    onMonthChange(month);
  };

  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
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

          {/* Seleção de Mês/Ano */}
          <div
            className={`relative flex-1 py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 min-h-touch ${
              isCustomMonth
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3 h-3 shrink-0" />
            <span className="truncate text-xs font-bold">
              {isCustomMonth
                ? MONTH_OPTIONS.find((m) => m.value === selectedMonth)?.label.split(' ')[0] || 'Mês/Ano'
                : 'Mês/Ano'}
            </span>
            <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />

            <select
              id="select-dashboard-custom-month"
              value={selectedMonth}
              onChange={handleMonthSelect}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
              aria-label="Selecionar Mês de Competência"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value} className="bg-slate-900 text-white">
                  {m.label}
                </option>
              ))}
            </select>
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
