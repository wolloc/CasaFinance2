import React from 'react';
import {
  Users,
  User,
  Tag,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Repeat,
  CreditCard,
  Building2,
  ArrowRightLeft,
  Banknote,
  UtensilsCrossed,
  Layers
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics.js';
import type { Category } from '../../types/index.js';

export interface SimplifiedFilterBarProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  selectedResponsible: 'all' | 'wallace' | 'guilherme';
  onResponsibleChange: (resp: 'all' | 'wallace' | 'guilherme') => void;
  selectedCategory: string;
  onCategoryChange: (catId: string) => void;
  categories?: Category[];
  selectedPaymentMethod?: string;
  onPaymentMethodChange?: (pmId: string) => void;
  isRecurringOnly?: boolean;
  onToggleRecurringOnly?: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  showCategoryFilter?: boolean;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

export const formatMonthDisplay = (monthStr: string): string => {
  if (!monthStr || !monthStr.includes('-')) return 'Mês Atual';
  const [yearStr, monthNumStr] = monthStr.split('-');
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(monthNumStr, 10) - 1;
  const monthName = MONTH_NAMES[monthIdx] || monthNumStr;
  return `${monthName} de ${year}`;
};

const GENERATED_MONTH_OPTIONS: Array<{ value: string; label: string }> = [];
[2025, 2026, 2027].forEach((yr) => {
  for (let m = 1; m <= 12; m++) {
    const val = `${yr}-${String(m).padStart(2, '0')}`;
    const name = MONTH_NAMES[m - 1];
    let extra = '';
    if (val === '2026-05') extra = ' • Atual';
    else if (val === '2026-04') extra = ' • Anterior';
    GENERATED_MONTH_OPTIONS.push({
      value: val,
      label: `${name} de ${yr}${extra}`
    });
  }
});

const PAYMENT_METHOD_OPTIONS = [
  { id: 'all', label: 'Todos', icon: Layers },
  { id: 'pm-credit', label: 'Cartão de Crédito', icon: CreditCard },
  { id: 'pm-debit', label: 'Débito', icon: Building2 },
  { id: 'pm-pix', label: 'PIX', icon: ArrowRightLeft },
  { id: 'pm-cash', label: 'Dinheiro', icon: Banknote },
  { id: 'pm-va', label: 'VA', icon: UtensilsCrossed }
];

export const SimplifiedFilterBar: React.FC<SimplifiedFilterBarProps> = ({
  selectedMonth,
  onMonthChange,
  selectedResponsible,
  onResponsibleChange,
  selectedCategory,
  onCategoryChange,
  categories = [],
  selectedPaymentMethod = 'all',
  onPaymentMethodChange,
  isRecurringOnly = false,
  onToggleRecurringOnly,
  onRefresh,
  isLoading = false,
  showCategoryFilter = true
}) => {
  // Navegação de mês anterior (<)
  const handlePrevMonth = () => {
    triggerHaptic('selection');
    const [yearStr, monthNumStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthNumStr, 10);
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    const newMonth = `${year}-${String(month).padStart(2, '0')}`;
    onMonthChange(newMonth);
  };

  // Navegação de próximo mês (>)
  const handleNextMonth = () => {
    triggerHaptic('selection');
    const [yearStr, monthNumStr] = selectedMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthNumStr, 10);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    const newMonth = `${year}-${String(month).padStart(2, '0')}`;
    onMonthChange(newMonth);
  };

  const handleCustomMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    triggerHaptic('selection');
    onMonthChange(e.target.value);
  };

  const handleResponsibleClick = (resp: 'all' | 'wallace' | 'guilherme') => {
    triggerHaptic('selection');
    onResponsibleChange(resp);
  };

  const handleCategorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    triggerHaptic('selection');
    onCategoryChange(e.target.value);
  };

  const activeCategoryObj = categories.find((c) => c.id === selectedCategory);

  const hasActiveFilters =
    selectedResponsible !== 'all' ||
    selectedCategory !== 'all' ||
    selectedPaymentMethod !== 'all' ||
    isRecurringOnly;

  return (
    <div
      id="simplified-filter-bar"
      className="bg-slate-900/95 backdrop-blur-md p-3 sm:p-4 rounded-3xl border border-slate-800 shadow-xl space-y-3"
    >
      {/* 1. CONTROLE DE NAVEGAÇÃO TEMPORAL: [<] [Nome do Mês Atual] [>] [v] */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 flex items-center justify-between p-1 bg-slate-950 rounded-2xl border border-slate-800/90 shadow-inner">
          {/* Botão < (Voltar um mês) */}
          <button
            type="button"
            id="btn-period-prev"
            onClick={handlePrevMonth}
            className="w-10 h-10 rounded-xl bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer min-h-touch active:scale-95 border border-slate-800"
            title="Mês anterior"
            aria-label="Voltar um mês"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Texto Central com Nome do Mês Atual Visível */}
          <div className="flex-1 text-center px-2 py-1 select-none">
            <span
              id="current-period-display-text"
              className="text-xs sm:text-sm font-black text-white tracking-wide block"
            >
              {formatMonthDisplay(selectedMonth)}
            </span>
            <span className="text-[10px] text-blue-400 font-bold block -mt-0.5">
              {selectedMonth === '2026-05' ? 'Competência Vigente' : 'Competência Selecionada'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Botão > (Avançar um mês) */}
            <button
              type="button"
              id="btn-period-next"
              onClick={handleNextMonth}
              className="w-10 h-10 rounded-xl bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer min-h-touch active:scale-95 border border-slate-800"
              title="Próximo mês"
              aria-label="Avançar um mês"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Botão/Dropdown com Ícone v para Seleção Direta de Mês/Ano */}
            <div className="relative">
              <button
                type="button"
                id="btn-period-dropdown-toggle"
                className="w-10 h-10 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center transition-all cursor-pointer min-h-touch"
                title="Selecionar Mês/Ano diretamente"
                aria-label="Selecionar Mês/Ano diretamente"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Native select invisível sobreposto para máxima agilidade e acessibilidade no mobile & desktop */}
              <select
                id="select-custom-month-year"
                value={selectedMonth}
                onChange={handleCustomMonthSelect}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                aria-label="Selecionar Mês e Ano"
              >
                {GENERATED_MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value} className="bg-slate-900 text-white py-1">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Botão de Atualizar Dados */}
        {onRefresh && (
          <button
            type="button"
            id="btn-refresh-filters"
            onClick={() => {
              triggerHaptic('impact-light');
              onRefresh();
            }}
            disabled={isLoading}
            className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center min-h-touch shrink-0 cursor-pointer"
            title="Atualizar Dados"
            aria-label="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* 2. FILTROS RÁPIDOS PRINCIPAIS: Responsável (Todos, Wallace, Guilherme) + Categoria + Contas Fixas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
        {/* Responsável: Todos, Wallace, Guilherme */}
        <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-2xl border border-slate-800/80 text-xs font-bold w-full sm:w-auto">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider pl-1.5 pr-0.5 hidden xs:inline">
            Resp:
          </span>

          <button
            type="button"
            id="btn-resp-all"
            onClick={() => handleResponsibleClick('all')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-touch cursor-pointer text-xs ${
              selectedResponsible === 'all'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-xs font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Todos</span>
          </button>

          <button
            type="button"
            id="btn-resp-wallace"
            onClick={() => handleResponsibleClick('wallace')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-touch cursor-pointer text-xs ${
              selectedResponsible === 'wallace'
                ? 'bg-emerald-600 text-white border border-emerald-500 shadow-xs font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Wallace</span>
          </button>

          <button
            type="button"
            id="btn-resp-guilherme"
            onClick={() => handleResponsibleClick('guilherme')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 min-h-touch cursor-pointer text-xs ${
              selectedResponsible === 'guilherme'
                ? 'bg-indigo-600 text-white border border-indigo-500 shadow-xs font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Guilherme</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Chip de Filtro Rápido para Contas Fixas */}
          {onToggleRecurringOnly && (
            <button
              type="button"
              id="btn-filter-recurring"
              onClick={() => {
                triggerHaptic('selection');
                onToggleRecurringOnly();
              }}
              className={`px-3 py-1.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-touch cursor-pointer shrink-0 ${
                isRecurringOnly
                  ? 'bg-purple-600 border-purple-500 text-white shadow-md'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-purple-300 hover:border-purple-500/40'
              }`}
              title="Filtrar apenas Contas Fixas Mensais"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Fixas</span>
            </button>
          )}

          {/* Filtro Rápido por Categoria */}
          {showCategoryFilter && (
            <div className="relative flex-1 sm:min-w-[170px] sm:max-w-[210px]">
              <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-slate-950/90 rounded-2xl border border-slate-800 text-xs min-h-touch text-slate-300">
                <div className="flex items-center gap-1.5 truncate">
                  <Tag className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate font-bold text-xs">
                    {activeCategoryObj ? activeCategoryObj.name : 'Todas Categorias'}
                  </span>
                </div>

                {selectedCategory !== 'all' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerHaptic('selection');
                      onCategoryChange('all');
                    }}
                    className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                    title="Limpar categoria"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0 pointer-events-none" />
                )}
              </div>

              {/* Native Select */}
              <select
                id="select-quick-category"
                value={selectedCategory}
                onChange={handleCategorySelect}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                aria-label="Filtrar por Categoria"
              >
                <option value="all" className="bg-slate-900 text-white">
                  Todas as Categorias
                </option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-slate-900 text-white">
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 3. FILTRO POR MEIO DE PAGAMENTO DIRETAMENTE NA BARRA (Cartão de Crédito, Débito, PIX, Dinheiro, VA) */}
      {onPaymentMethodChange && (
        <div className="pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 pr-1">
              Meio:
            </span>

            {PAYMENT_METHOD_OPTIONS.map((pm) => {
              const isSelected = selectedPaymentMethod === pm.id;
              const IconComp = pm.icon;

              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    onPaymentMethodChange(pm.id);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap min-h-touch cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-600 border-blue-500 text-white shadow-xs'
                      : 'bg-slate-950/70 border-slate-800/90 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <IconComp className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  <span>{pm.label}</span>
                </button>
              );
            })}

            {/* Botão para resetar filtros ativos */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  onResponsibleChange('all');
                  onCategoryChange('all');
                  onPaymentMethodChange('all');
                  if (onToggleRecurringOnly && isRecurringOnly) onToggleRecurringOnly();
                }}
                className="px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[11px] font-bold flex items-center gap-1 border border-slate-800 whitespace-nowrap min-h-touch cursor-pointer ml-auto"
                title="Limpar todos os filtros ativos"
              >
                <X className="w-3 h-3" />
                <span>Limpar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
