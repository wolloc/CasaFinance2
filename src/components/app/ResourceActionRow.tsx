import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Banknote, ChevronRight, Landmark, Pencil, PiggyBank, Receipt, TrendingUp, Utensils, Wallet } from 'lucide-react';

export type ResourceNavigationAction={kind:'expense'|'transfer'|'reserve'|'loan'|'settings';accountId:string};
export type ResourceActionTarget={
 accountId:string;
 name:string;
 type:string;
 resourceRestriction:string|null;
 isInvestment:boolean;
 amount:number;
 amountLabel:string;
 institution?:string|null;
 ownerLabel?:string|null;
 detailLabel?:string|null;
};

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
function resourceVisual(resource:ResourceActionTarget){
 if(resource.isInvestment)return{Icon:TrendingUp,tone:'bg-emerald-500/10 text-emerald-300'};
 if(resource.resourceRestriction==='reserve'||resource.type==='savings')return{Icon:PiggyBank,tone:'bg-amber-500/10 text-amber-300'};
 if(resource.type==='meal_benefit')return{Icon:Utensils,tone:'bg-orange-500/10 text-orange-300'};
 if(resource.type==='cash'||resource.type==='digital_wallet')return{Icon:Wallet,tone:'bg-cyan-500/10 text-cyan-300'};
 return{Icon:Landmark,tone:'bg-blue-500/10 text-blue-300'};
}
function ResourceIcon({resource}:{resource:ResourceActionTarget}){const{Icon,tone}=resourceVisual(resource);return <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4"/></span>;}

export function ResourceActionRow({resource,onAction}:{key?:string;resource:ResourceActionTarget;onAction?:(action:ResourceNavigationAction)=>void}){
 const[open,setOpen]=useState(false);const rootRef=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(rootRef.current&&!rootRef.current.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 const patrimonial=resource.isInvestment||resource.resourceRestriction==='reserve';
 const benefit=resource.type==='meal_benefit';
 const transactional=['cash','checking','savings','digital_wallet'].includes(resource.type);
 const act=(kind:ResourceNavigationAction['kind'])=>{setOpen(false);onAction?.({kind,accountId:resource.accountId});};
 return <div ref={rootRef} className="relative rounded-2xl border border-slate-800 bg-white/[0.035]">
  <button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="flex min-h-[92px] w-full flex-col items-start gap-2 rounded-2xl p-3 text-left hover:bg-white/[0.025]">
   <div className="flex w-full items-start justify-between gap-2"><ResourceIcon resource={resource}/><ChevronRight className={`h-4 w-4 shrink-0 text-slate-600 transition-transform ${open?'rotate-90':''}`}/></div>
   <div className="min-w-0 w-full"><p className="truncate text-xs font-semibold text-slate-200">{resource.name}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{[resource.institution,resource.ownerLabel].filter(Boolean).join(' · ')||resource.amountLabel}</p>{resource.detailLabel&&<p className="truncate text-[10px] text-slate-400">{resource.detailLabel}</p>}<strong className="mt-2 block text-sm">{money(resource.amount)}</strong></div>
  </button>
  {open&&<div className="absolute left-1/2 top-[calc(100%-6px)] z-40 grid w-[min(280px,88vw)] -translate-x-1/2 gap-2 rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-2xl shadow-black/45">
   {!patrimonial&&<button type="button" onClick={()=>act('expense')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-rose-200"><Receipt className="h-4 w-4"/>{benefit?'Registrar gasto com benefício':'Registrar despesa'}</button>}
   {!patrimonial&&!benefit&&<button type="button" onClick={()=>act('transfer')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-blue-200"><ArrowLeftRight className="h-4 w-4"/>Transferir deste recurso</button>}{transactional&&!benefit&&!patrimonial&&<button type="button" onClick={()=>act('loan')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-cyan-200"><Banknote className="h-4 w-4"/>Pegar dinheiro emprestado</button>}
   {patrimonial&&<button type="button" onClick={()=>act('reserve')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-amber-200"><PiggyBank className="h-4 w-4"/>Aportar ou resgatar</button>}
   <button type="button" onClick={()=>act('settings')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-slate-300"><Pencil className="h-4 w-4"/>Editar recurso</button>
  </div>}
 </div>;
}
