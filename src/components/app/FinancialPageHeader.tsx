import type { ReactNode } from 'react';

export function FinancialPageHeader({title,action}:{title:string;action?:ReactNode}){
  return <header className="flex items-center justify-between gap-3"><h1 className="text-2xl font-black leading-tight tracking-tight text-slate-100">{title}</h1>{action}</header>;
}
