import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Banknote, ChevronRight, HandCoins, Landmark, Pencil, PiggyBank, TrendingDown, TrendingUp, Utensils, Wallet } from 'lucide-react';

export type ResourceNavigationAction={kind:'transfer'|'deposit'|'withdraw'|'invest'|'redeem'|'loan-granted'|'loan-taken'|'settings';accountId:string};
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
 const cashLike=resource.type==='cash'||resource.type==='digital_wallet';
 const bankLike=resource.type==='checking'||resource.type==='savings';
 const act=(kind:ResourceNavigationAction['kind'])=>{setOpen(false);onAction?.({kind,accountId:resource.accountId});};
 return <div ref={rootRef} className="relative rounded-2xl border border-slate-800 bg-white/[0.035]">
  <button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="flex min-h-[92px] w-full flex-col items-start gap-2 rounded-2xl p-3 text-left hover:bg-white/[0.025]">
   <div className="flex w-full items-start justify-between gap-2"><ResourceIcon resource={resource}/><ChevronRight className={`h-4 w-4 shrink-0 text-slate-600 transition-transform ${open?'rotate-90':''}`}/></div>
   <div className="min-w-0 w-full"><p className="truncate text-xs font-semibold text-slate-200">{resource.name}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{[resource.institution,resource.ownerLabel].filter(Boolean).join(' · ')||resource.amountLabel}</p>{resource.detailLabel&&<p className="truncate text-[10px] text-slate-400">{resource.detailLabel}</p>}<strong className="mt-2 block text-sm">{money(resource.amount)}</strong></div>
  </button>
  {open&&<div className="absolute left-1/2 top-[calc(100%-6px)] z-40 grid w-[min(280px,88vw)] -translate-x-1/2 gap-2 rounded-2xl border border-slate-700 bg-slate-950 p-2 shadow-2xl shadow-black/45">
   {cashLike&&!benefit&&!patrimonial&&<button type="button" onClick={()=>act('deposit')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-blue-200"><ArrowDownToLine className="h-4 w-4"/>Depositar em conta</button>}
   {bankLike&&!benefit&&!patrimonial&&<><button type="button" onClick={()=>act('transfer')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-blue-200"><ArrowLeftRight className="h-4 w-4"/>Transferir</button><button type="button" onClick={()=>act('withdraw')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-cyan-200"><ArrowUpFromLine className="h-4 w-4"/>Sacar</button><button type="button" onClick={()=>act('invest')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-amber-200"><TrendingUp className="h-4 w-4"/>Aportar em investimento</button></>}
   {patrimonial&&<><button type="button" onClick={()=>act('invest')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-emerald-200"><TrendingUp className="h-4 w-4"/>Aportar</button><button type="button" onClick={()=>act('redeem')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-amber-200"><TrendingDown className="h-4 w-4"/>Resgatar</button></>}
   {!benefit&&!patrimonial&&<><button type="button" onClick={()=>act('loan-granted')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-cyan-200"><HandCoins className="h-4 w-4"/>Emprestar dinheiro</button><button type="button" onClick={()=>act('loan-taken')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-cyan-200"><Banknote className="h-4 w-4"/>Pegar emprestado</button></>}
   <button type="button" onClick={()=>act('settings')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-3 text-left text-xs font-bold text-slate-300"><Pencil className="h-4 w-4"/>Editar recurso</button>
  </div>}
 </div>;
}
