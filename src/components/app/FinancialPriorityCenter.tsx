import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { AttentionItem } from '../../finance/financialDashboard.js';
import { ProjectionReviewCenter } from './ProjectionReviewCenter.js';

const money=(value:number|string|null|undefined)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value??0));

export type AttentionNavigationAction='expenses'|'invoices'|'income';

export function FinancialPriorityCenter({items,onNavigate}:{items:AttentionItem[];onNavigate?:(action:AttentionNavigationAction)=>void}){
  return <section aria-labelledby="atencao"><h2 id="atencao" className="mb-3 flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5 text-amber-400"/>Precisa de atenção</h2>
    {items.length===0?<p className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-4 text-sm text-emerald-200">Nenhuma situação acionável agora.</p>:<div className="space-y-3">{items.map((item,index)=><article key={item.attention_key} className={`rounded-2xl border p-4 ${item.severity==='red'?'border-rose-900/70 bg-rose-950/20':'border-amber-900/60 bg-amber-950/10'}`}>
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-bold text-slate-400">Prioridade {index+1}</span><h3 className={item.severity==='red'?'font-bold text-rose-200':'font-bold text-amber-200'}>{item.title}</h3></div><p className="mt-2 text-sm text-slate-300">{item.priority_reason}</p>{item.due_date&&<p className="mt-1 text-xs text-slate-500">Data: {item.due_date}</p>}</div>{Number(item.amount)>0&&<strong className="whitespace-nowrap text-sm">{money(item.amount)}</strong>}</div>
      {item.recommended_action&&item.action_label&&<button type="button" onClick={()=>onNavigate?.(item.recommended_action as AttentionNavigationAction)} className="mt-3 flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-xs font-bold text-blue-200">{item.action_label}<ArrowRight className="h-4 w-4"/></button>}
    </article>)}</div>}
    {items.length>1&&<p className="mt-2 text-xs text-slate-500">O Casa ordena primeiro o que combina maior gravidade, vencimento e impacto financeiro. A ordem não paga, transfere nem corrige nada sozinha.</p>}
    <ProjectionReviewCenter onNavigate={onNavigate}/>
  </section>;
}
