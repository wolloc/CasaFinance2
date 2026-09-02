import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  Utensils,
  Home,
  Car,
  HeartPulse,
  Film,
  Sparkles,
  Tag,
  Zap,
  Filter,
  CheckCircle2
} from 'lucide-react';
import type { DashboardCategoryBreakdown } from '../../types/index.js';
import { triggerHaptic } from '../../utils/haptics.js';

interface CategoryBreakdownCardProps {
  categories: DashboardCategoryBreakdown[];
}

export const CategoryBreakdownCard: React.FC<CategoryBreakdownCardProps> = ({ categories = [] }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Calculate total spent
  const totalSpent = useMemo(() => {
    return categories.reduce((sum, c) => sum + c.total_spent, 0);
  }, [categories]);

  // Selected category info
  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categories.find((c) => c.category_id === selectedCategoryId) || null;
  }, [categories, selectedCategoryId]);

  // Filter or highlight categories
  const handleSelectCategory = (catId: string | null) => {
    triggerHaptic('selection');
    setSelectedCategoryId((prev) => (prev === catId ? null : catId));
  };

  // Helper icon renderer
  const renderCategoryIcon = (name: string, iconStr?: string) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('mercado') || lower.includes('supermercado')) {
      return <ShoppingBag className="w-4 h-4" />;
    }
    if (lower.includes('aliment') || lower.includes('restaurante') || lower.includes('comida') || lower.includes('jantar')) {
      return <Utensils className="w-4 h-4" />;
    }
    if (lower.includes('moradia') || lower.includes('casa') || lower.includes('aluguel') || lower.includes('condom')) {
      return <Home className="w-4 h-4" />;
    }
    if (lower.includes('transporte') || lower.includes('uber') || lower.includes('combust')) {
      return <Car className="w-4 h-4" />;
    }
    if (lower.includes('saúde') || lower.includes('saude') || lower.includes('farmacia') || lower.includes('medic')) {
      return <HeartPulse className="w-4 h-4" />;
    }
    if (lower.includes('lazer') || lower.includes('viagem') || lower.includes('entretenimento')) {
      return <Film className="w-4 h-4" />;
    }
    if (lower.includes('assinat') || lower.includes('luz') || lower.includes('energia') || lower.includes('internet')) {
      return <Zap className="w-4 h-4" />;
    }
    return <Tag className="w-4 h-4" />;
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-800 shadow-xl overflow-hidden p-5 sm:p-6 space-y-4">
      {/* Header & Total */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white">Comprometimento por Categoria</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Distribuição dos gastos do período ranqueados por valor
          </p>
        </div>

        <div className="text-right self-start sm:self-auto">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total em Categorias</span>
          <span className="text-sm font-black text-white">
            R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Interactive Category Filter Chips */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => handleSelectCategory(null)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1 min-h-touch ${
              selectedCategoryId === null
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            <Filter className="w-3 h-3" />
            <span>Todas ({categories.length})</span>
          </button>

          {categories.slice(0, 5).map((cat) => (
            <button
              key={cat.category_id}
              type="button"
              onClick={() => handleSelectCategory(cat.category_id)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 min-h-touch ${
                selectedCategoryId === cat.category_id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: cat.color || '#6366f1' }}
              />
              <span>{cat.category_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Selected Category Highlight Banner */}
      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: selectedCategory.color || '#6366f1' }}
              >
                {renderCategoryIcon(selectedCategory.category_name, selectedCategory.icon)}
              </div>
              <div>
                <span className="font-bold text-white block">{selectedCategory.category_name}</span>
                <span className="text-indigo-300 text-[11px]">
                  {selectedCategory.transaction_count} lançamento(s) registrados neste mês
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="font-black text-white block text-sm">
                R$ {selectedCategory.total_spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] font-bold text-indigo-300">
                {selectedCategory.percentage}% do orçamento
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ranked Category Progress Bars */}
      {categories.length === 0 ? (
        <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80">
          <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">Nenhum gasto categorizado no mês</p>
          <p className="text-xs text-slate-500 mt-1">Os gastos lançados aparecerão organizados aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat, index) => {
            const isSelected = selectedCategoryId === cat.category_id;
            const isMuted = selectedCategoryId !== null && !isSelected;

            return (
              <motion.div
                key={cat.category_id}
                onClick={() => handleSelectCategory(cat.category_id)}
                whileHover={{ scale: 1.01 }}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-950 border-indigo-500/60 shadow-lg shadow-indigo-950/40'
                    : isMuted
                    ? 'bg-slate-950/40 border-slate-800/50 opacity-40 hover:opacity-80'
                    : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: cat.color || '#6366f1' }}
                    >
                      {renderCategoryIcon(cat.category_name, cat.icon)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">{cat.category_name}</span>
                      <span className="text-[10px] text-slate-400">
                        {cat.transaction_count} {cat.transaction_count === 1 ? 'gasto' : 'gastos'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-white block">
                      R$ {cat.total_spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{cat.percentage}%</span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(3, cat.percentage))}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: index * 0.05 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: cat.color || '#6366f1' }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
