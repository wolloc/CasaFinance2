import type { ReactNode } from 'react';

export function FinancialListSummaryCard({
  tone,
  label='Total da visão',
  total,
  meta,
  children,
}:{tone:'income'|'expense';label?:string;total:string;meta?:ReactNode;children?:ReactNode}){
  const toneClass=tone==='income'
    ?'border-emerald-900/40 bg-emerald-950/15 text-emerald-200'
    :'border-rose-900/40 bg-rose-950/15 text-rose-200';
  const labelClass=tone==='income'?'text-emerald-300/80':'text-rose-300/80';
  return <div className={`rounded-2xl border p-4 ${toneClass}`}>
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className={`text-xs font-bold uppercase tracking-wide ${labelClass}`}>{label}</p>
        <strong className="mt-1 block text-2xl">{total}</strong>
      </div>
      {meta&&<div className="shrink-0 text-right text-xs text-slate-400">{meta}</div>}
    </div>
    {children}
  </div>;
}
