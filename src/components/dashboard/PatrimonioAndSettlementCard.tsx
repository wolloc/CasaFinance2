import React from 'react';
import {
  Wallet,
  ArrowRightLeft,
  Building2,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import type { DashboardSettlementData, DashboardPatrimonio } from '../../types/index.js';
import { triggerHaptic } from '../../utils/haptics.js';

interface PatrimonioAndSettlementCardProps {
  patrimonio: DashboardPatrimonio;
  settlement: DashboardSettlementData;
  onNavigateToSettlement?: () => void;
}

export const PatrimonioAndSettlementCard: React.FC<PatrimonioAndSettlementCardProps> = ({
  patrimonio,
  settlement,
  onNavigateToSettlement
}) => {
  const netPatrimonio = patrimonio.saldo_liquido_patrimonio ?? (patrimonio.saldo_contas - patrimonio.total_faturas_abertas);
  const isPatrimonioPositive = netPatrimonio >= 0;

  const isSettled = settlement.status === 'settled' || settlement.amount <= 0.01;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Visão de Saldo Acumulado & Patrimônio */}
      <div className="bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-800 shadow-xl overflow-hidden p-5 sm:p-6 space-y-4 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white">Patrimônio Acumulado</h3>
          </div>

          <span
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
              isPatrimonioPositive
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}
          >
            {isPatrimonioPositive ? (
              <>
                <ShieldCheck className="w-3 h-3" />
                <span>Valores Investidos / Saldo em Conta</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3" />
                <span>Valores em Dívidas / Faturas Futuras</span>
              </>
            )}
          </span>
        </div>

        {/* Saldo Líquido Consolidado */}
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
            Saldo Líquido Consolidado
          </span>
          <h2
            className={`text-2xl sm:text-3xl font-black tracking-tight ${
              isPatrimonioPositive ? 'text-white' : 'text-rose-300'
            }`}
          >
            R$ {netPatrimonio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
        </div>

        {/* Breakdown: Saldo em Contas vs Faturas Abertas */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-0.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <Building2 className="w-3 h-3 text-emerald-400" />
              Saldo em Contas
            </span>
            <span className="text-xs sm:text-sm font-black text-emerald-400 block">
              R$ {patrimonio.saldo_contas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-0.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-rose-400" />
              Faturas em Aberto
            </span>
            <span className="text-xs sm:text-sm font-black text-rose-400 block">
              - R$ {patrimonio.total_faturas_abertas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Impacto do Acerto do Casal (Linguagem Natural & Compensação 50/50) */}
      <div className="bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-800 shadow-xl overflow-hidden p-5 sm:p-6 space-y-4 relative flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 flex items-center justify-center">
                <ArrowRightLeft className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-white">Balanço do Casal</h3>
            </div>

            <span
              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                isSettled
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
              }`}
            >
              {isSettled ? 'Contas Equilibradas' : 'Acerto Pendente'}
            </span>
          </div>

          {/* Resumo Direto em Linguagem Natural */}
          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Status da Compensação Financeira
            </span>
            <p className="text-sm font-black text-white leading-snug">
              {settlement.summary_text || (isSettled ? 'Tudo certo! As despesas conjuntas estão 100% equilibradas.' : `Compensação de R$ ${settlement.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} pendente.`)}
            </p>
            <p className="text-[11px] text-slate-400">
              {isSettled
                ? 'Nenhuma transferência necessária entre Wallace e Guilherme no momento.'
                : 'Valores pagos com saldo individual compõem o saldo do acerto 50/50.'}
            </p>
          </div>
        </div>

        {onNavigateToSettlement && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onNavigateToSettlement();
            }}
            className="w-full mt-2 py-2.5 px-3 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/40 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-between transition-all"
          >
            <span>Ver Detalhes do Acerto 50/50</span>
            <ChevronRight className="w-4 h-4 text-blue-400" />
          </button>
        )}
      </div>
    </div>
  );
};
