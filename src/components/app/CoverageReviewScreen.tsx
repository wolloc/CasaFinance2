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
  if(error||!dashboard)return <p role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">Não foi possível reler a projeção atual. Nenhuma ação foi registrada.</p>;
  const guidance=dashboard.guidance;const gap=Math.max(Number(guidance?.coverage_gap??0),0);const hasReserve=Number(guidance?.reserve_balance??0)+Number(guidance?.investment_balance??0)>0;
  return <div className="space-y-5"><header><p className="text-xs font-bold uppercase tracking-widest text-amber-400">Revisão de cobertura</p><h1 className="mt-1 text-2xl font-black">Como cobrir a projeção?</h1><p className="mt-1 text-sm text-slate-400">O Casa releu a posição atual antes de mostrar opções. Abrir esta tela não movimenta dinheiro, reserva, investimento ou crédito.</p></header>
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300"/><div><p className="text-xs text-slate-500">Gap sinalizado pela Home</p><strong>{money(suggestedAmount)}</strong><p className="mt-3 text-xs text-slate-500">Gap após releitura</p><strong className={gap>0?'text-rose-300':'text-emerald-300'}>{money(gap)}</strong></div></div></section>
    {gap<=0?<p className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-4 text-sm text-emerald-200">A projeção mudou e o gap não existe mais. Nada foi movimentado.</p>:<section className="space-y-3"><div><h2 className="font-bold">Escolha somente o que realmente vai acontecer</h2><p className="mt-1 text-xs text-slate-400">A escolha abaixo apenas abre o fluxo correspondente. A movimentação só ocorre depois das confirmações do fluxo financeiro correto.</p></div><button type="button" onClick={()=>onChoose?.('transfer',gap)} className="min-h-12 w-full rounded-xl border border-slate-700 px-4 text-left text-sm font-bold">Transferir recurso entre contas</button>{hasReserve&&<button type="button" onClick={()=>onChoose?.('reserve',gap)} className="min-h-12 w-full rounded-xl border border-slate-700 px-4 text-left text-sm font-bold">Resgatar reserva ou investimento</button>}<button type="button" onClick={()=>onChoose?.('loan',gap)} className="min-h-12 w-full rounded-xl border border-slate-700 px-4 text-left text-sm font-bold">Registrar empréstimo</button><p className="text-xs text-slate-500">Reserva, investimento e crédito permanecem recursos separados. O Casa não usa nenhum deles automaticamente.</p></section>}
  </div>;
}
