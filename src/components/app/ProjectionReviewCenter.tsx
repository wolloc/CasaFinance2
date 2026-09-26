import { useEffect, useState } from 'react';
import { ChevronRight, LoaderCircle, RefreshCw } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import type { AttentionNavigationAction } from './FinancialPriorityCenter.js';

type ProjectionReviewItem={review_key:string;review_type:string;amount:number;reference_date:string|null;entity_type:string;entity_id:string;title:string;review_reason:string;recommended_action:'expenses'|'invoices'|'income';action_label:string;urgency_score:number;};
const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value??0));
const actionFor=(item:ProjectionReviewItem):AttentionNavigationAction=>{if(item.entity_type==='invoice')return {kind:'projection-invoice-review',invoiceId:item.entity_id};if(item.entity_type==='recurring_occurrence')return {kind:'projection-recurring-review',occurrenceId:item.entity_id};if(item.entity_type==='money_movement')return item.review_type==='delayed_expected_income'?{kind:'income-receipt',moneyMovementId:item.entity_id}:{kind:'projection-income-review',moneyMovementId:item.entity_id};if(item.entity_type==='commitment'&&item.review_key.startsWith('commitment-review:'))return {kind:'projection-expense-review',commitmentKey:item.review_key.slice('commitment-review:'.length)};return {kind:'navigate',destination:item.recommended_action};};

export function ProjectionReviewCenter({onNavigate}:{onNavigate?:(action:AttentionNavigationAction)=>void}){
  const{household}=useSupabaseAuth();const[items,setItems]=useState<ProjectionReviewItem[]>([]);const[loading,setLoading]=useState(true);const[failed,setFailed]=useState(false);const[refreshKey,setRefreshKey]=useState(0);
  useEffect(()=>{let cancelled=false;if(!supabase||!household){setLoading(false);return()=>{cancelled=true;};}const load=async()=>{setLoading(true);setFailed(false);try{const{data,error}=await supabase.rpc('financial_projection_review_items',{p_household_id:household.id});if(cancelled)return;if(error){setFailed(true);return;}setItems((data??[])as ProjectionReviewItem[]);}catch{if(!cancelled)setFailed(true);}finally{if(!cancelled)setLoading(false);}};void load();return()=>{cancelled=true;};},[household?.id,refreshKey]);
  if(loading)return <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin"/>Conferindo previsões…</div>;
  if(failed)return <div role="alert" className="mt-3 rounded-xl border border-amber-900/70 bg-amber-950/20 p-3 text-sm text-amber-200"><div className="flex items-center justify-between gap-3"><span>Não foi possível conferir as previsões. Nada foi considerado resolvido.</span><button type="button" onClick={()=>setRefreshKey(value=>value+1)} className="flex min-h-9 items-center gap-1 text-xs font-bold text-amber-100"><RefreshCw className="h-4 w-4"/>Tentar novamente</button></div></div>;
  if(items.length===0)return null;
  const actionableItems=items.filter(item=>item.urgency_score>=55);
  if(actionableItems.length===0)return null;
  const visible=actionableItems.slice(0,5);
  return <section className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/55 p-3" aria-labelledby="projection-review-title">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-cyan-300"/><h3 id="projection-review-title" className="text-sm font-bold">Conferir próximos valores</h3></div><span className="text-[10px] font-semibold text-slate-500">{actionableItems.length} {actionableItems.length===1?'item':'itens'}</span></div>
    <div className="mt-2 space-y-1">{visible.map((item)=><article key={item.review_key} className="rounded-xl bg-slate-950/60 px-3 py-2"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="truncate text-xs font-semibold text-slate-200">{item.title}</h4><p className="mt-0.5 text-[10px] text-slate-500">{item.reference_date?item.reference_date+' · ':''}{item.review_reason}</p></div><strong className="whitespace-nowrap text-xs">{money(item.amount)}</strong></div><button type="button" onClick={()=>onNavigate?.(actionFor(item))} className="mt-1 flex min-h-8 w-full items-center justify-between text-left text-[11px] font-bold text-cyan-300">{item.action_label}<ChevronRight className="h-3.5 w-3.5"/></button></article>)}</div>
    {actionableItems.length>visible.length&&<p className="mt-2 text-[10px] text-slate-500">+ {actionableItems.length-visible.length} próximos valores pedem conferência.</p>}
    <p className="mt-2 text-[10px] text-slate-600">Só aparecem aqui previsões próximas ou atrasadas. Planejamentos futuros normais continuam na projeção sem virar alerta.</p>
  </section>;
}
