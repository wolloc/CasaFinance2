import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function FinancialActionDialogHeader({
  tone,
  eyebrow,
  title,
  icon,
  onClose,
  closeLabel,
}:{tone:'income'|'expense';eyebrow:string;title:string;icon:ReactNode;onClose:()=>void;closeLabel:string}){
  const toneClass=tone==='income'?'bg-emerald-500/15 text-emerald-300':'bg-rose-500/15 text-rose-300';
  const eyebrowClass=tone==='income'?'text-emerald-300':'text-rose-300';
  return <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
    <div className="flex min-w-0 items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>{icon}</span>
      <div className="min-w-0">
        <p className={`text-xs font-bold uppercase tracking-wider ${eyebrowClass}`}>{eyebrow}</p>
        <h2 className="truncate text-lg font-black text-slate-100">{title}</h2>
      </div>
    </div>
    <button type="button" aria-label={closeLabel} onClick={onClose} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"><X className="h-5 w-5"/></button>
  </header>;
}
