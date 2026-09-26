import { X } from 'lucide-react';

export function FinancialDetailDialogHeader({
  tone,
  eyebrow,
  title,
  subtitle,
  onClose,
  closeLabel,
}:{tone:'income'|'expense';eyebrow:string;title:string;subtitle?:string;onClose:()=>void;closeLabel:string}){
  const eyebrowClass=tone==='income'?'text-emerald-300':'text-rose-300';
  return <div className="mb-4 flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className={`text-xs font-bold uppercase tracking-wider ${eyebrowClass}`}>{eyebrow}</p>
      <h2 className="mt-1 truncate text-lg font-black text-slate-100">{title}</h2>
      {subtitle&&<p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
    </div>
    <button type="button" aria-label={closeLabel} onClick={onClose} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700"><X className="h-5 w-5"/></button>
  </div>;
}
