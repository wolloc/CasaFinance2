import type { ReactNode } from 'react';

export function FinancialResourceChoice({
 active,onClick,icon,institution,name,ownerLabel,tone='blue'
}:{
 key?:string;
 active:boolean;
 onClick:()=>void;
 icon:ReactNode;
 institution?:string|null;
 name:string;
 ownerLabel?:string|null;
 tone?:'blue'|'emerald';
}){
 const activeClass=tone==='emerald'
  ?'border-emerald-500 bg-emerald-950/35'
  :'border-blue-500 bg-blue-950/40';
 const iconActive=tone==='emerald'
  ?'bg-emerald-500/15 text-emerald-200'
  :'bg-blue-500/15 text-blue-200';
 return <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-[58px] min-w-0 flex-col items-start gap-1.5 rounded-xl border px-2 py-2 text-left ${active?activeClass:'border-slate-700 bg-slate-950'}`}>
  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md [&>svg]:h-4 [&>svg]:w-4 ${active?iconActive:'bg-slate-900 text-slate-400'}`}>{icon}</span>
  <span className="min-w-0 w-full">
   {institution&&<span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{institution}</span>}
   <strong className="block truncate text-xs font-semibold text-slate-100">{name}</strong>
   {ownerLabel&&<span className="block truncate text-[10px] leading-3.5 text-slate-400">{ownerLabel}</span>}
  </span>
 </button>;
}
