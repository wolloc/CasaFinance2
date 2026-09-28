import type { ReactNode } from 'react';

export function FinancialDetailActionGroup({
 primary,secondary,title='Ações deste lançamento',secondaryLabel='Outras opções'
}:{primary?:ReactNode;secondary?:ReactNode;title?:string;secondaryLabel?:string}){
 return <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/35 p-3">
  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
  {primary&&<div className="mt-3 flex flex-wrap gap-2">{primary}</div>}
  {secondary&&<details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60">
   <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 text-sm font-semibold text-slate-300">{secondaryLabel}</summary>
   <div className="border-t border-slate-800 p-3">{secondary}</div>
  </details>}
 </section>;
}
