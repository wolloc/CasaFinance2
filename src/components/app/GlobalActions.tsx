import { ArrowLeftRight, Minus, Plus } from 'lucide-react';

const actionClass='pointer-events-auto flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-slate-700/80 bg-slate-900/94 px-3 text-[12px] font-bold shadow-xl shadow-black/45 ring-1 ring-white/5 backdrop-blur-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2';

export function GlobalActions({ onExpense, onIncome, onAdjustment }: {
  onExpense: () => void;
  onIncome: () => void;
  onAdjustment: () => void;
}) {
  return <div aria-label="Ações globais" className="pointer-events-none fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-2">
    <button type="button" aria-label="Nova despesa" onClick={onExpense} className={actionClass+' text-rose-200 focus-visible:ring-rose-400'}>
      <Minus className="h-4 w-4" />Despesa
    </button>
    <button type="button" aria-label="Nova entrada" onClick={onIncome} className={actionClass+' text-emerald-200 focus-visible:ring-emerald-400'}>
      <Plus className="h-4 w-4" />Entrada
    </button>
    <button type="button" aria-label="Novo acerto" onClick={onAdjustment} className={actionClass+' text-blue-200 focus-visible:ring-blue-400'}>
      <ArrowLeftRight className="h-4 w-4" />Acerto
    </button>
  </div>;
}
