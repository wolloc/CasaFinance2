import React from 'react';
import { Scale, CheckCircle2, Info, ArrowRight, User } from 'lucide-react';
import type { DashboardSettlementData } from '../../types/index.js';
import { AccountingTooltip } from './AccountingTooltip.js';

interface CoupleSettlementCardProps {
  settlement: DashboardSettlementData;
}

export const CoupleSettlementCard: React.FC<CoupleSettlementCardProps> = ({
  settlement
}) => {
  const isSettled = settlement.status === 'settled' || (settlement.amount ?? 0) <= 0.01;
  const isGuilhermeOwes = settlement.status === 'guilherme_owes_wallace';

  const debtorName = isGuilhermeOwes ? 'Guilherme' : 'Wallace';
  const creditorName = isGuilhermeOwes ? 'Wallace' : 'Guilherme';

  const wallacePaid = settlement.wallace_paid || 0;
  const wallaceResp = settlement.wallace_responsibility || 0;
  const guilhermePaid = settlement.guilherme_paid || 0;
  const guilhermeResp = settlement.guilherme_responsibility || 0;
  const totalSharedExpenses = wallacePaid + guilhermePaid;

  const wallacePaidPercent = totalSharedExpenses > 0 ? Math.round((wallacePaid / totalSharedExpenses) * 100) : 50;
  const guilhermePaidPercent = totalSharedExpenses > 0 ? 100 - wallacePaidPercent : 50;

  // Frase explicativa em linguagem natural
  const getNaturalLanguageExplanation = () => {
    if (isSettled) {
      return 'Gastos compartilhados perfeitamente divididos entre Wallace e Guilherme. Nenhuma compensação financeira necessária para este período.';
    }

    const diff = Math.abs(settlement.amount);
    const diffFormatted = `R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    if (isGuilhermeOwes) {
      return `Wallace assumiu R$ ${wallacePaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em desembolsos reais neste mês enquanto sua responsabilidade calculada era de R$ ${wallaceResp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Portanto, Guilherme deve compensar ${diffFormatted} para restabelecer a divisão igualitária.`;
    }

    return `Guilherme assumiu R$ ${guilhermePaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em desembolsos reais neste mês enquanto sua responsabilidade calculada era de R$ ${guilhermeResp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Portanto, Wallace deve compensar ${diffFormatted} para restabelecer a divisão igualitária.`;
  };

  return (
    <div id="card-couple-settlement" className="w-full bg-slate-900/95 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden space-y-5">
      {/* 1. Header do Balanço Analítico */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              isSettled
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
            }`}
          >
            {isSettled ? <CheckCircle2 className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Bússola Analítica de Divisão
              </span>
            </div>
            <h3 className="text-sm font-black text-white">
              Balanço do Casal • Gastos Reais vs. Responsabilidade
            </h3>
          </div>
        </div>

        <span
          className={`text-[10px] font-bold px-3 py-1 rounded-full border self-start sm:self-auto ${
            isSettled
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          }`}
        >
          {isSettled ? 'Contas Equilibradas' : 'Desequilíbrio Temporário'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Glossário do acerto">
        {(['Origem do pagamento', 'Financiado por', 'Responsabilidade econômica'] as const).map((term) => (
          <span key={term} className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-slate-400">
            {term}<AccountingTooltip term={term} />
          </span>
        ))}
      </div>

      {/* 2. Resumo da Posição de Compensação */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-3">
        {isSettled ? (
          <div className="text-center py-2 space-y-1">
            <h4 className="text-base font-black text-white">
              Gastos do mês perfeitamente equilibrados 🎉
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {getNaturalLanguageExplanation()}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Ajuste de Equilíbrio
                </span>
                <h4 className="text-base sm:text-lg font-black text-white tracking-tight flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-amber-400 font-extrabold">{debtorName}</span>
                  <span className="text-slate-400 font-medium text-sm">compensa</span>
                  <span className="text-2xl sm:text-3xl text-emerald-400 font-black">
                    R$ {settlement.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-slate-400 font-medium text-sm">a</span>
                  <span className="text-sky-400 font-extrabold">{creditorName}</span>
                </h4>
              </div>
            </div>

            {/* Frase Explicativa em Linguagem Natural */}
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300 leading-relaxed">
                {getNaturalLanguageExplanation()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Comparação Visual de Gastos Reais vs. Responsabilidades */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Card Wallace */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                W
              </div>
              <span className="text-xs font-bold text-white">Wallace</span>
            </div>
            <span className="text-[11px] font-bold text-blue-400">
              {wallacePaidPercent}% do total pago
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Pago Real:</span>
              <span className="font-bold text-white">
                R$ {wallacePaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Responsabilidade:</span>
              <span className="font-bold text-slate-300">
                R$ {wallaceResp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Balanço Líquido:</span>
              <span className={`font-black ${wallacePaid >= wallaceResp ? 'text-emerald-400' : 'text-amber-400'}`}>
                {wallacePaid >= wallaceResp ? '+' : ''}
                R$ {(wallacePaid - wallaceResp).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Card Guilherme */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">
                G
              </div>
              <span className="text-xs font-bold text-white">Guilherme</span>
            </div>
            <span className="text-[11px] font-bold text-purple-400">
              {guilhermePaidPercent}% do total pago
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Pago Real:</span>
              <span className="font-bold text-white">
                R$ {guilhermePaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Responsabilidade:</span>
              <span className="font-bold text-slate-300">
                R$ {guilhermeResp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Balanço Líquido:</span>
              <span className={`font-black ${guilhermePaid >= guilhermeResp ? 'text-emerald-400' : 'text-amber-400'}`}>
                {guilhermePaid >= guilhermeResp ? '+' : ''}
                R$ {(guilhermePaid - guilhermeResp).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
