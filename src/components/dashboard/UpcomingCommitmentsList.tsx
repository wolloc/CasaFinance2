import React from 'react';
import { CalendarClock, AlertCircle, CheckCircle, Tag, ArrowUpRight } from 'lucide-react';
import type { DashboardUpcomingCommitmentItem } from '../../types';

interface UpcomingCommitmentsListProps {
  commitments: DashboardUpcomingCommitmentItem[];
  onViewAll?: () => void;
}

export const UpcomingCommitmentsList: React.FC<UpcomingCommitmentsListProps> = ({
  commitments,
  onViewAll
}) => {
  const getDaysDiff = (dateStr: string) => {
    const today = new Date('2026-05-15'); // Current system reference
    const due = new Date(dateStr);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Próximos Vencimentos & Compromissos
            </h3>
          </div>

          {onViewAll && (
            <button
              onClick={onViewAll}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <span>Ver todos</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {commitments.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
            Nenhuma conta ou parcela pendente para os próximos dias.
          </div>
        ) : (
          <div className="space-y-2.5">
            {commitments.slice(0, 5).map((item) => {
              const daysDiff = getDaysDiff(item.due_date);
              let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
              let badgeText = `Em ${daysDiff} dias`;

              if (daysDiff < 0) {
                badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
                badgeText = 'Vencido';
              } else if (daysDiff === 0) {
                badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                badgeText = 'Vence Hoje';
              } else if (daysDiff === 1) {
                badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                badgeText = 'Amanhã';
              }

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                      <Tag className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">
                          {item.description}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {item.category_name}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Pagador: {item.payer_name} • Vencimento: {item.due_date.split('-').reverse().join('/')}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <span className="font-extrabold text-sm text-white">
                      R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                      {badgeText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>Total de {commitments.length} compromissos cadastrados</span>
        <span className="font-semibold text-slate-300">
          Total: R$ {commitments.reduce((sum, c) => sum + c.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
};
