import type { ReactNode } from 'react';

export const financialUi = {
  surface: 'rounded-2xl border border-slate-800 bg-slate-900/45',
  surfaceMuted: 'rounded-xl border border-slate-800/70 bg-slate-950/35',
  surfaceInteractive: 'rounded-2xl border border-slate-800 bg-slate-900/35 transition-colors hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60',
  sectionGap: 'space-y-3',
};

export function FinancialSectionHeading({
  title,
  description,
  icon,
  eyebrow,
  id,
}:{title:string;description?:string;icon?:ReactNode;eyebrow?:string;id?:string}){
  return <div className="mb-3 min-w-0">
    {eyebrow&&<p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{eyebrow}</p>}
    <h2 id={id} className="mt-1 flex min-w-0 items-center gap-2 text-base font-extrabold leading-snug text-slate-100 sm:text-lg">{icon&&<span className="shrink-0">{icon}</span>}<span>{title}</span></h2>
    {description&&<p className="mt-1 text-sm leading-5 text-slate-400">{description}</p>}
  </div>;
}
