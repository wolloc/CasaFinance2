import { ArrowLeftRight, Minus, Plus } from 'lucide-react';

export function GlobalActions({ onExpense, onIncome, onAdjustment }: {
  onExpense: () => void;
  onIncome: () => void;
  onAdjustment: () => void;
}) {
  return <div aria-label="Ações globais" className="fixed inset-x-0 bottom-[5.25rem] z-20 mx-auto max-w-2xl px-3">
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur">
      <button type="button" onClick={onExpense} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-950/60 px-2 text-xs font-bold text-rose-200">
        <Minus className="h-4 w-4" />Nova despesa
      </button>
      <button type="button" onClick={onIncome} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-950/60 px-2 text-xs font-bold text-emerald-200">
        <Plus className="h-4 w-4" />Nova entrada
      </button>
      <button type="button" onClick={onAdjustment} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-950/60 px-2 text-xs font-bold text-blue-200">
        <ArrowLeftRight className="h-4 w-4" />Novo acerto
      </button>
    </div>
  </div>;
}
