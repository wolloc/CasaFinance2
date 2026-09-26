import type { ReactNode } from 'react';

export function FinancialSectionHeading({
  title,
  description,
  icon,
  eyebrow,
  id,
}:{title:string;description?:string;icon?:ReactNode;eyebrow?:string;id?:string}){
  return <div className="mb-3">
    {eyebrow&&<p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>}
    <h2 id={id} className="mt-1 flex items-center gap-2 text-lg font-black leading-tight text-slate-100">{icon}{title}</h2>
    {description&&<p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>}
  </div>;
}
