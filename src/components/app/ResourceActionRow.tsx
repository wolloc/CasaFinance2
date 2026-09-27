import { ArrowLeftRight, Banknote, ChevronRight, Pencil, PiggyBank, Receipt } from 'lucide-react';

export type ResourceNavigationAction={kind:'expense'|'transfer'|'reserve'|'loan'|'settings';accountId:string};
export type ResourceActionTarget={
 accountId:string;
 name:string;
 type:string;
 resourceRestriction:string|null;
 isInvestment:boolean;
 amount:number;
 amountLabel:string;
};

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);

export function ResourceActionRow({resource,onAction}:{key?:string;resource:ResourceActionTarget;onAction?:(action:ResourceNavigationAction)=>void}){
 const patrimonial=resource.isInvestment||resource.resourceRestriction==='reserve';
 const benefit=resource.type==='meal_benefit';
 const transactional=['cash','checking','savings','digital_wallet'].includes(resource.type);
 const act=(kind:ResourceNavigationAction['kind'])=>onAction?.({kind,accountId:resource.accountId});
 return <details className="group/resource rounded-xl">
  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-800/55">
   <div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-300">{resource.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{resource.amountLabel}</p></div>
   <strong className="text-sm">{money(resource.amount)}</strong><ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-open/resource:rotate-90"/>
  </summary>
  <div className="grid gap-2 border-t border-slate-800/70 px-2 py-3 sm:grid-cols-2">
   {!patrimonial&&<button type="button" onClick={()=>act('expense')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-950/70 px-3 text-left text-xs font-bold text-rose-200"><Receipt className="h-4 w-4"/>{benefit?'Registrar gasto com benefício':'Registrar despesa'}</button>}
   {!patrimonial&&!benefit&&<button type="button" onClick={()=>act('transfer')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-950/70 px-3 text-left text-xs font-bold text-blue-200"><ArrowLeftRight className="h-4 w-4"/>Transferir deste recurso</button>}{transactional&&!benefit&&!patrimonial&&<button type="button" onClick={()=>act('loan')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-950/70 px-3 text-left text-xs font-bold text-cyan-200"><Banknote className="h-4 w-4"/>Pegar dinheiro emprestado</button>}
   {patrimonial&&<button type="button" onClick={()=>act('reserve')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-950/70 px-3 text-left text-xs font-bold text-amber-200"><PiggyBank className="h-4 w-4"/>Aportar ou resgatar</button>}
   <button type="button" onClick={()=>act('settings')} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-950/70 px-3 text-left text-xs font-bold text-slate-300"><Pencil className="h-4 w-4"/>Editar recurso</button>
  </div>
 </details>;
}
