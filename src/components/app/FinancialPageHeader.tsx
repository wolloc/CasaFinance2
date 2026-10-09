import type { ReactNode } from 'react';

export function FinancialPageHeader({title,action}:{title:string;action?:ReactNode}){
  return <header className="flex min-w-0 items-center justify-between gap-3">
    <h1 className="min-w-0 text-xl font-extrabold leading-tight tracking-tight text-slate-100 sm:text-2xl">{title}</h1>
    {action&&<div className="shrink-0">{action}</div>}
  </header>;
}
