import { useEffect, useState } from 'react';
import { ChevronRight, LoaderCircle, RefreshCw } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import type { AttentionNavigationAction } from './FinancialPriorityCenter.js';

type ProjectionReviewItem={review_key:string;review_type:string;amount:number;reference_date:string|null;entity_type:string;entity_id:string;title:string;review_reason:string;recommended_action:AttentionNavigationAction;action_label:string;urgency_score:number;};
const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value??0));

export function ProjectionReviewCenter({onNavigate}:{onNavigate?:(action:AttentionNavigationAction)=>void}){
  const{household}=useSupabaseAuth();const[items,setItems]=useState<ProjectionReviewItem[]>([]);const[loading,setLoading]=useState(true);const[failed,setFailed]=useState(false);
  useEffect(()=>{let cancelled=false;if(!supabase||!household){setLoading(false);return()=>{cancelled=true;};}const load=async()=>{setLoading(true);setFailed(false);try{const{data,error}=await supabase.rpc('financial_projection_review_items',{p_household_id:household.id});if(cancelled)return;if(error){setFailed(true);return;}setItems((data??[])as ProjectionReviewItem[]);}catch{if(!cancelled)setFailed(true);}finally{if(!cancelled)setLoading(false);}};void load();return()=>{cancelled=true;};},[household?.id]);
  if(loading)return <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin"/>Conferindo previsões que ainda precisam de confirmação…</div>;
  if(failed||items.length===0)return null;
  const visible=items.slice(0,5);
  return <section className="mt-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-4" aria-labelledby="projection-review-title">
    <div className="flex items-start gap-3"><RefreshCw className="mt-0.5 h-5 w-5 text-cyan-300"/><div><h3 id="projection-review-title" className="font-bold">Revisar projeção</h3><p className="mt-1 text-sm text-slate-300">O Casa encontrou previsões ainda abertas. Elas continuam aqui até o acontecimento ser realmente confirmado, corrigido, recebido, pago ou cancelado.</p></div></div>
    <div className="mt-3 space-y-2">{visible.map((item,index)=><article key={item.review_key} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide text-cyan-300">Revisão {index+1}</p><h4 className="mt-1 font-semibold">{item.title}</h4><p className="mt-1 text-xs text-slate-400">{item.review_reason}</p>{item.reference_date&&<p className="mt-1 text-xs text-slate-500">Referência: {item.reference_date}</p>}</div><strong className="text-sm">{money(item.amount)}</strong></div><button type="button" onClick={()=>onNavigate?.(item.recommended_action)} className="mt-3 flex min-h-10 w-full items-center justify-between rounded-lg border border-slate-700 px-3 text-left text-xs font-bold text-cyan-200">{item.action_label}<ChevronRight className="h-4 w-4"/></button></article>)}</div>
    {items.length>visible.length&&<p className="mt-3 text-xs text-slate-500">+ {items.length-visible.length} item(ns) aguardando revisão. O Casa mostra os mais urgentes primeiro.</p>}
    <p className="mt-3 text-xs text-slate-500">Abrir ou visualizar uma revisão não dá baixa em nada. O item desaparece somente quando o fato financeiro subjacente é resolvido no fluxo correto.</p>
  </section>;
}
