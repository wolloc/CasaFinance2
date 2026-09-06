import { ChevronRight, RefreshCw } from 'lucide-react';
import type { ProjectionConfidence, ProjectionReviewItem } from '../../finance/financialDashboard.js';
import type { AttentionNavigationAction } from './FinancialPriorityCenter.js';

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value??0));

export function ProjectionReviewCenter({confidence,items,onNavigate}:{confidence:ProjectionConfidence|null;items:ProjectionReviewItem[];onNavigate?:(action:AttentionNavigationAction)=>void}){
  if(!confidence||confidence.confidence_state==='well_updated') return null;
  const visible=items.slice(0,5);
  return <section className="mt-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-4" aria-labelledby="projection-review-title">
    <div className="flex items-start gap-3"><RefreshCw className="mt-0.5 h-5 w-5 text-cyan-300"/><div><h3 id="projection-review-title" className="font-bold">Revisar projeção</h3><p className="mt-1 text-sm text-slate-300">{confidence.confidence_label}. Estes itens continuam aqui até o fato financeiro ser realmente confirmado, corrigido, recebido, pago ou cancelado.</p></div></div>
    {visible.length===0?<p className="mt-3 text-xs text-slate-400">A confiança indica revisão necessária, mas não há um item com rota segura para mostrar agora.</p>:<div className="mt-3 space-y-2">{visible.map((item,index)=><article key={item.review_key} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide text-cyan-300">Revisão {index+1}</p><h4 className="mt-1 font-semibold">{item.title}</h4><p className="mt-1 text-xs text-slate-400">{item.review_reason}</p>{item.reference_date&&<p className="mt-1 text-xs text-slate-500">Referência: {item.reference_date}</p>}</div><strong className="text-sm">{money(item.amount)}</strong></div><button type="button" onClick={()=>onNavigate?.(item.recommended_action)} className="mt-3 flex min-h-10 w-full items-center justify-between rounded-lg border border-slate-700 px-3 text-left text-xs font-bold text-cyan-200">{item.action_label}<ChevronRight className="h-4 w-4"/></button></article>)}</div>}
    {items.length>visible.length&&<p className="mt-3 text-xs text-slate-500">+ {items.length-visible.length} item(ns) aguardando revisão. O Casa prioriza os mais urgentes primeiro.</p>}
    <p className="mt-3 text-xs text-slate-500">Abrir ou visualizar uma revisão não altera a projeção. Ela só melhora quando o acontecimento subjacente é atualizado no fluxo financeiro correto.</p>
  </section>;
}
