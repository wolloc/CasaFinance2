import { ArrowLeftRight, Minus, Plus } from 'lucide-react';

export function GlobalActions({ onExpense, onIncome, onAdjustment }: {
  onExpense: () => void;
  onIncome: () => void;
  onAdjustment: () => void;
}) {
  return <div aria-label="Ações globais" className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-30 w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2">
    <div className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/90 p-1 shadow-2xl shadow-black/40 ring-1 ring-white/5 backdrop-blur-xl">
      <button type="button" aria-label="Nova despesa" onClick={onExpense} className="flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[11px] font-bold text-rose-200 transition-colors hover:bg-rose-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
        <Minus className="h-3.5 w-3.5" />Despesa
      </button>
      <span aria-hidden="true" className="h-5 w-px bg-slate-700/80" />
      <button type="button" aria-label="Nova entrada" onClick={onIncome} className="flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[11px] font-bold text-emerald-200 transition-colors hover:bg-emerald-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
        <Plus className="h-3.5 w-3.5" />Entrada
      </button>
      <span aria-hidden="true" className="h-5 w-px bg-slate-700/80" />
      <button type="button" aria-label="Novo acerto" onClick={onAdjustment} className="flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[11px] font-bold text-blue-200 transition-colors hover:bg-blue-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
        <ArrowLeftRight className="h-3.5 w-3.5" />Acerto
      </button>
    </div>
  </div>;
}
