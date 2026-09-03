import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { DashboardHeader } from './DashboardHeader.js';
import { MainMetricsCard } from './MainMetricsCard.js';
import { ProtectedFundsCard } from './ProtectedFundsCard.js';
import { CoupleSettlementCard } from './CoupleSettlementCard.js';
import { CategoryBreakdownCard } from './CategoryBreakdownCard.js';
import { PaymentCommitmentCard } from './PaymentCommitmentCard.js';
import { FutureProjectionsCard } from './FutureProjectionsCard.js';
import { ApiService } from '../../services/api.js';
import type { DashboardPerspective, DashboardFullResponse, Category } from '../../types/index.js';

interface HomeDashboardProps {
  householdId: string;
  userId: string;
  onNavigateTab?: (tab: string) => void;
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
  selectedResponsible?: 'all' | 'wallace' | 'guilherme';
  onResponsibleChange?: (resp: 'all' | 'wallace' | 'guilherme') => void;
  selectedCategory?: string;
  onCategoryChange?: (catId: string) => void;
  categories?: Category[];
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  householdId,
  userId,
  selectedMonth: propMonth,
  onMonthChange: propOnMonthChange,
  selectedResponsible: propResponsible,
  onResponsibleChange: propOnResponsibleChange,
  selectedCategory,
  onCategoryChange,
  categories = []
}) => {
  // Local fallbacks if not controlled by parent
  const [localPerspective, setLocalPerspective] = useState<DashboardPerspective>('couple');
  const [localMonth, setLocalMonth] = useState<string>('2026-05');

  const activeMonth = propMonth || localMonth;
  const handleMonthChange = (newMonth: string) => {
    if (propOnMonthChange) {
      propOnMonthChange(newMonth);
    } else {
      setLocalMonth(newMonth);
    }
  };

  const activePerspective: DashboardPerspective =
    propResponsible === 'wallace'
      ? 'wallace'
      : propResponsible === 'guilherme'
      ? 'guilherme'
      : propResponsible === 'all'
      ? 'couple'
      : localPerspective;

  const handlePerspectiveChange = (newP: DashboardPerspective) => {
    if (propOnResponsibleChange) {
      propOnResponsibleChange(newP === 'couple' ? 'all' : newP);
    } else {
      setLocalPerspective(newP);
    }
  };

  const [data, setData] = useState<DashboardFullResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await ApiService.getDashboardData(
        householdId,
        userId,
        activePerspective,
        activeMonth
      );
      setData(result);
    } catch (err: unknown) {
      console.error('Erro no Dashboard View:', err);
      setError(err instanceof Error ? err.message : 'Erro inesperado ao consultar os dados do dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [householdId, userId, activePerspective, activeMonth]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div id="dashboard-container" className="space-y-4 sm:space-y-5 pb-6">
      {/* 1. SELETOR DE PERÍODO SIMPLIFICADO & RESPONSÁVEL (GLOBAL NO TOPO) */}
      <DashboardHeader
        perspective={activePerspective}
        onPerspectiveChange={handlePerspectiveChange}
        selectedMonth={activeMonth}
        onMonthChange={handleMonthChange}
        onRefresh={fetchDashboardData}
        isLoading={isLoading}
        selectedCategory={selectedCategory}
        onCategoryChange={onCategoryChange}
        categories={categories}
      />

      {/* 2. Feedback de Erro com Ação de Retry */}
      {error && (
        <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-3 text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-bold block">Falha de Conexão com os Dados:</span>
              <span>{error}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors min-h-touch"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      )}

      {/* 3. Skeleton Loading State */}
      {isLoading && !data && (
        <div className="space-y-4 animate-pulse">
          <div className="h-40 bg-slate-900/80 rounded-3xl border border-slate-800" />
          <div className="h-44 bg-slate-900/80 rounded-3xl border border-slate-800" />
          <div className="h-44 bg-slate-900/80 rounded-3xl border border-slate-800" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-56 bg-slate-900/80 rounded-3xl border border-slate-800" />
            <div className="h-56 bg-slate-900/80 rounded-3xl border border-slate-800" />
          </div>
        </div>
      )}

      {/* 4. Estrutura do Novo Dashboard Refatorado e Despoluído */}
      {data && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activePerspective}-${activeMonth}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="space-y-4 sm:space-y-5"
          >
            {/* 1. CARDS DE RESUMO FINANCEIRO CONSOLIDADO (TOPO) */}
            <MainMetricsCard accounting={data.accounting} perspective={activePerspective} />

            {/* 2. HISTÓRICO DE PROTEÇÃO DE CAPITAL E DRENAGENS */}
            <ProtectedFundsCard
              funds={data.protected_funds || []}
              drainages={data.reserve_drainages || []}
              selectedMonth={activeMonth}
            />

            {/* 3. BALANÇO DO CASAL (INTEGRADO) */}
            <CoupleSettlementCard
              settlement={data.settlement}
            />

            {/* 4. CATEGORIAS E MEIOS DE PAGAMENTO (RANKING VISUAL LIMPO) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CategoryBreakdownCard
                categories={data.gastosPorCategoria || data.category_breakdown || []}
              />

              <PaymentCommitmentCard
                cards={data.cards || []}
                accounts={data.accounts || []}
                commitmentItems={data.comprometimentoMeiosPagamento || []}
              />
            </div>

            {/* 5. PROJEÇÃO DE COMPROMISSOS FUTUROS (+1m, +3m, +6m) */}
            <FutureProjectionsCard
              projections={data.projecoes || data.future_projections || []}
            />
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};
