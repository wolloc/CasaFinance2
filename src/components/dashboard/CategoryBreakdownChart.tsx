import React from 'react';
import { PieChart, Tag, ArrowRight } from 'lucide-react';
import type { DashboardCategoryBreakdown } from '../../types';

interface CategoryBreakdownChartProps {
  categories: DashboardCategoryBreakdown[];
  monthLabel: string;
}

export const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = ({
  categories,
  monthLabel
}) => {
  const totalSpent = categories.reduce((sum, c) => sum + c.total_spent, 0);

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Gastos por Categoria ({monthLabel})
            </h3>
          </div>

          <span className="text-xs text-slate-400 font-medium">
            Total: R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {categories.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            Nenhum lançamento registrado neste mês.
          </div>
        ) : (
          <div className="space-y-3.5">
            {categories.slice(0, 6).map((cat) => (
              <div key={cat.category_id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: cat.color || '#3b82f6' }}
                    />
                    <span className="font-semibold text-white">
                      {cat.category_name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ({cat.transaction_count} lançamentos)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">
                      R$ {cat.total_spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-slate-400 font-medium text-[11px] w-12 text-right">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(2, cat.percentage))}%`,
                      backgroundColor: cat.color || '#3b82f6'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span>Distribuição percentual consolidada</span>
        <span className="text-slate-300 font-semibold">{categories.length} categorias ativas</span>
      </div>
    </div>
  );
};
