import { useEffect, useState } from 'react';
import { LoaderCircle, ShieldAlert } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { getFinancialDashboard } from '../../finance/financialDashboard.js';
import type { CoverageActionKind } from '../../finance/coverageActionIntent.js';

const money=(value:number|string|null|undefined)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value??0));
type Dashboard=Awaited<ReturnType<typeof getFinancialDashboard>>;

export function CoverageReviewScreen({suggestedAmount,onChoose}:{suggestedAmount:number;onChoose?:(kind:CoverageActionKind,amount:number)=>void}){
  const{household}=useSupabaseAuth();
  const[dashboard,setDashboard]=useState<Dashboard|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(false);
  useEffect(()=>{let cancelled=false;if(!supabase||!household){setLoading(false);return()=>{cancelled=true;};}setLoading(true);setError(false);getFinancialDashboard(supabase,household.id).then(data=>{if(!cancelled)setDashboard(data);}).catch(()=>{if(!cancelled)setError(true);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[household?.id]);
  if(loading)return <LoaderCircle className="mx-auto mt-16 h-7 w-7 animate-spin text-blue-400"/>;
  if(error||!dashboard)return <p role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">Não foi possível conferir novamente a projeção atual. Nenhuma ação foi registrada.</p>;
  const guidance=dashboard.guidance;const gap=Math.max(Number(guidance?.coverage_gap??0),0);const hasReserve=Number(guidance?.reserve_balance??0)+Number(guidance?.investment_balance??0)>0;
  return <div className="space-y-5"><header><p className="text-xs font-bold uppercase tracking-widest text-amber-400">Planejamento</p><h1 className="mt-1 text-2xl font-black">Como podemos cobrir o que está faltando?</h1><p className="mt-1 text-sm text-slate-400">O Casa conferiu os valores atuais antes de mostrar estas opções. Só abrir esta tela não transfere dinheiro, resgata investimento nem cria empréstimo.</p></header>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300"/><div><p className="text-xs text-slate-500">Quanto parecia faltar antes</p><strong>{money(suggestedAmount)}</strong><p className="mt-3 text-xs text-slate-500">Quanto falta agora, depois de conferir</p><strong className={gap>0?'text-rose-300':'text-emerald-300'}>{money(gap)}</strong></div></div></section>
    {gap<=0?<p className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-4 text-sm text-emerald-200">A situação mudou e agora não falta mais dinheiro nessa projeção. Nada foi movimentado.</p>:<section className="space-y-3"><div><h2 className="font-bold">Escolha apenas o que realmente pretende fazer</h2><p className="mt-1 text-xs text-slate-400">Cada botão só abre a próxima etapa. O dinheiro só será movimentado depois que você confirmar o que aconteceu de verdade.</p></div><button type="button" onClick={()=>onChoose?.('transfer',gap)} className="min-h-12 w-full rounded-xl border border-slate-700 px-4 text-left text-sm font-bold">Mover dinheiro de outra conta da Casa</button>{hasReserve&&<button type="button" onClick={()=>onChoose?.('reserve',gap)} className="min-h-12 w-full rounded-xl border border-slate-700 px-4 text-left text-sm font-bold">Usar dinheiro de uma reserva ou investimento</button>}<button type="button" onClick={()=>onChoose?.('loan',gap)} className="min-h-12 w-full rounded-xl border border-slate-700 px-4 text-left text-sm font-bold">Pegar dinheiro emprestado</button><p className="text-xs text-slate-500">O Casa nunca usa outra conta, reserva, investimento ou crédito automaticamente. Você escolhe e confirma cada movimento.</p></section>}
  </div>;
}
