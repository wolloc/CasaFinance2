import { useEffect, useState } from 'react';
import { CircleGauge, CreditCard, Landmark, LoaderCircle, TrendingUp, WalletCards } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { getFinancialDashboard, getMemberFinancialPerspective, type MemberMonthlyProjection } from '../../finance/financialDashboard.js';
import { ensureRecurringExpenseHorizon, recurringExpenseRollingHorizonDate } from '../../finance/recurringExpenses.js';
import type { CoverageActionKind } from '../../finance/coverageActionIntent.js';
import type { SettlementActionIntent } from '../../finance/settlementActionIntent.js';
import { CardFinancialJourney } from './CardFinancialJourney.js';
import { FinancialPriorityCenter, type AttentionNavigationAction } from './FinancialPriorityCenter.js';
import { SettlementHub } from './SettlementHub.js';

const money=(value:number|string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value));
const monthLabel=(value:string)=>new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`));
const todayInFinanceTimeZone=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const year=parts.find(part=>part.type==='year')?.value??'';const month=parts.find(part=>part.type==='month')?.value??'';const day=parts.find(part=>part.type==='day')?.value??'';return `${year}-${month}-${day}`;};
const healthText={green:'Saudável',yellow:'Atenção',red:'Crítico'}as const;
const healthClass={green:'text-emerald-300',yellow:'text-amber-300',red:'text-rose-300'}as const;
const unavailable=(message:string)=><p role="status" className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-4 text-sm text-amber-100">{message}</p>;
type Dashboard=Awaited<ReturnType<typeof getFinancialDashboard>>;
type Perspective='household'|string;

export function CasaHomeScreen({onCoverageAction,onAttentionAction,onSettlementAction}:{onCoverageAction?:(kind:CoverageActionKind,suggestedAmount:number)=>void;onAttentionAction?:(action:AttentionNavigationAction)=>void;onSettlementAction?:(intent:SettlementActionIntent)=>void}){
 const{household,householdMembers}=useSupabaseAuth();
 const[dashboard,setDashboard]=useState<Dashboard|null>(null);
 const[perspective,setPerspective]=useState<Perspective>('household');
 const[memberProjection,setMemberProjection]=useState<MemberMonthlyProjection[]>([]);
 const[memberLoading,setMemberLoading]=useState(false);
 const[memberError,setMemberError]=useState(false);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState(false);

 useEffect(()=>{let cancelled=false;if(!supabase||!household)return()=>{cancelled=true;};setLoading(true);setError(false);setDashboard(null);const load=async()=>{try{try{await ensureRecurringExpenseHorizon(supabase,household.id,recurringExpenseRollingHorizonDate(todayInFinanceTimeZone()));}catch(error){console.warn('Casa Finance: não foi possível atualizar o horizonte de despesas recorrentes antes da Home.',error);}const nextDashboard=await getFinancialDashboard(supabase,household.id);if(!cancelled)setDashboard(nextDashboard);}catch{if(!cancelled)setError(true);}finally{if(!cancelled)setLoading(false);}};void load();return()=>{cancelled=true;};},[household?.id]);
 useEffect(()=>{let cancelled=false;if(!supabase||!household||perspective==='household'){setMemberProjection([]);setMemberError(false);return()=>{cancelled=true;};}setMemberLoading(true);setMemberError(false);setMemberProjection([]);getMemberFinancialPerspective(supabase,household.id,perspective).then(rows=>{if(!cancelled)setMemberProjection(rows);}).catch(()=>{if(!cancelled)setMemberError(true);}).finally(()=>{if(!cancelled)setMemberLoading(false);});return()=>{cancelled=true;};},[household?.id,perspective]);

 if(loading)return <LoaderCircle className="mx-auto mt-16 h-7 w-7 animate-spin text-blue-400"/>;
 if(error||!dashboard)return <p role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">Não foi possível carregar nenhuma fonte da posição financeira. Nenhum valor foi substituído por zero.</p>;

 const selectedMember=householdMembers.find(m=>m.id===perspective)??null;
 const{household:position,health,confidence,attention,projection,cards,resources,guidance,availability}=dashboard;
 const currentMonth=availability.projection?projection[0]:undefined;
 const currentCash=health?.current_cash!=null?Number(health.current_cash):resources?resources.availableCash:null;
 const projectedEndingCash=health?.projected_ending_cash!=null?Number(health.projected_ending_cash):position?Number(position.projected_balance):null;
 const gap=guidance?Number(guidance.coverage_gap):null;
 const hasPartialFailure=Object.values(availability).some(value=>!value);
 const selector=<div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-800 bg-slate-900 p-1"><button onClick={()=>setPerspective('household')} className={`rounded-xl px-3 py-2 text-sm font-semibold ${perspective==='household'?'bg-blue-600':'text-slate-400'}`}>Nossa Casa</button>{householdMembers.slice(0,2).map(m=><button key={m.id} onClick={()=>setPerspective(m.id)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${perspective===m.id?'bg-blue-600':'text-slate-400'}`}>{m.display_name}</button>)}</div>;

 if(perspective!=='household'){
  const current=memberProjection[0];
  return <div className="space-y-7"><header><p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Perspectiva financeira</p><h1 className="mt-1 text-2xl font-black">{selectedMember?.display_name??'Membro'}</h1></header>{selector}{memberLoading?<LoaderCircle className="mx-auto h-7 w-7 animate-spin"/>:memberError||!current?<p role="alert">Não foi possível carregar esta perspectiva financeira. Nenhum valor foi substituído por zero.</p>:<><section className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5"><p>Posso movimentar hoje</p><strong className="text-3xl">{money(current.opening_liquidity)}</strong><p className="mt-4">Deve sobrar comigo (projeção)</p><strong className="text-2xl">{money(current.projected_ending_liquidity)}</strong></section><section><h2 className="font-bold">Minha posição</h2><div className="grid grid-cols-2 gap-3">{[['Minha responsabilidade',current.economic_responsibility_remaining],['Pode sair dos meus recursos',current.projected_funding_remaining],['A receber do outro membro',current.settlement_receivable_position],['A pagar ao outro membro',current.settlement_payable_position]].map(([l,v])=><article key={String(l)} className="rounded-2xl border border-slate-800 p-4"><p className="text-xs text-slate-400">{l}</p><strong>{money(v as number)}</strong></article>)}</div><p className="mt-2 text-xs text-slate-500">Responsabilidade econômica não é alterada por conta, cartão, comprador ou por quem efetivamente pagou.</p></section><section><h2 className="font-bold">Olhando pra frente</h2>{memberProjection.map(m=><article key={m.financial_month} className="mt-3 rounded-2xl border border-slate-800 p-4"><b>{monthLabel(m.financial_month)}</b><strong className="float-right">{money(m.projected_ending_liquidity)}</strong></article>)}</section></>}</div>;
 }

 return <div className="space-y-7">
  <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Nossa Casa</p><h1 className="text-2xl font-black">{household?.name}</h1></header>
  {selector}
  {hasPartialFailure&&<p role="status" className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-4 text-sm text-amber-100">Algumas análises não puderam ser confirmadas agora. O Casa mantém visíveis apenas os dados que conseguiu ler e não substitui informações ausentes por R$ 0,00.</p>}

  <section>
   <h2 className="mb-3 flex items-center gap-2 font-bold"><CircleGauge className="h-5 w-5 text-blue-400"/>Como estamos?</h2>
   <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5">
    <div className="flex justify-between"><div><p>Saldo atual</p>{currentCash===null?<strong className="text-xl">Não confirmado</strong>:<strong className="text-3xl">{money(currentCash)}</strong>}<p className="text-xs">O que existe nas contas e dinheiro físico agora.</p></div>{health&&<span className={healthClass[health.health]}>{healthText[health.health]}</span>}</div>
    {guidance&&<div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-4"><div><p className="text-xs">Já comprometido</p><strong>{money(guidance.committed_before_new_income)}</strong></div><div><p className="text-xs">Livre após compromissos</p><strong>{money(guidance.free_cash_after_commitments)}</strong></div></div>}
    <div className="mt-4 border-t border-white/20 pt-4"><p>Deve sobrar <span className="text-xs">(inclui entradas confiáveis esperadas)</span></p>{projectedEndingCash===null?<strong className="text-lg">Não confirmado</strong>:<strong className="text-2xl">{money(projectedEndingCash)}</strong>}{confidence&&<p className="text-xs">{confidence.confidence_label}</p>}</div>
   </div>
   {!availability.guidance&&unavailable('A orientação de cobertura está indisponível agora. O Casa não vai presumir quanto está livre ou faltando.')}
   {guidance&&guidance.guidance_state!=='covered'&&<article className="mt-3 rounded-2xl border border-rose-900/70 bg-rose-950/20 p-4"><h3 className="font-bold">{guidance.guidance_title}</h3>{guidance.guidance_state==='covered_by_expected_income'?<p className="mt-1 text-sm">O caixa atual sozinho não cobre tudo, mas as entradas confiáveis previstas fecham o mês. O Casa continuará acompanhando se elas realmente entrarem.</p>:<><p className="mt-1 text-sm">Faltam <strong>{money(gap??0)}</strong> na projeção para cobrir os compromissos conhecidos.</p><p className="mt-2 text-xs text-slate-400">Escolha uma opção somente se ela realmente acontecer. Abrir uma opção abaixo não movimenta dinheiro nem muda a projeção.</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><button onClick={()=>onCoverageAction?.('transfer',gap??0)} className="min-h-11 rounded-xl border border-slate-700 px-3 text-sm font-bold">Mover dinheiro de outra conta da Casa</button>{Number(guidance.reserve_balance)+Number(guidance.investment_balance)>0&&<button onClick={()=>onCoverageAction?.('reserve',gap??0)} className="min-h-11 rounded-xl border border-slate-700 px-3 text-sm font-bold">Usar dinheiro de uma reserva ou investimento</button>}<button onClick={()=>onCoverageAction?.('loan',gap??0)} className="min-h-11 rounded-xl border border-slate-700 px-3 text-sm font-bold">Pegar dinheiro emprestado</button></div><p className="mt-2 text-xs text-slate-500">O Casa nunca usa outra conta, reserva, investimento ou crédito automaticamente. Você escolhe e confirma cada movimento.</p></>}</article>}
  </section>

  {availability.attention?<FinancialPriorityCenter items={attention} onNavigate={onAttentionAction}/>:unavailable('Não foi possível conferir o centro de atenção. Nenhuma pendência foi presumida como resolvida.')}

  <section>
   <h2 className="mb-3 flex items-center gap-2 font-bold"><TrendingUp className="h-5 w-5 text-emerald-400"/>Este mês</h2>
   {!availability.projection?unavailable('Não foi possível confirmar a projeção deste mês.'):!currentMonth?<p className="text-sm text-slate-400">Ainda não há projeção financeira para este mês.</p>:<div className="grid grid-cols-2 gap-3">{[['Entrou',currentMonth.realized_true_income_in_month],['Ainda entra',currentMonth.expected_reliable_income_remaining],['Já comprometido/pago',currentMonth.realized_commitments_in_month],['Ainda compromete',Number(currentMonth.remaining_commitments_in_month)+Number(currentMonth.projected_recurring_commitments)+Number(currentMonth.prior_pending_outflow)]].map(([l,v])=><article key={String(l)} className="rounded-2xl border border-slate-800 p-4"><p>{l}</p><strong>{money(v as number)}</strong></article>)}</div>}
  </section>

  <section>
   <h2 className="mb-3 flex items-center gap-2 font-bold"><WalletCards className="h-5 w-5 text-blue-400"/>Nosso dinheiro</h2>
   {!availability.resources||!resources?unavailable('Não foi possível confirmar os saldos dos recursos da Casa.'):<><div className="grid grid-cols-2 gap-3">{[['Contas + dinheiro físico',resources.availableCash],['Benefícios',resources.benefits],['Reservas',resources.reserves],['Investimentos',resources.investments]].map(([l,v])=><article key={String(l)} className="rounded-2xl border border-slate-800 p-4"><p>{l}</p><strong>{money(v as number)}</strong></article>)}</div><p className="text-xs">Reserva, investimento e crédito continuam separados.</p></>}
  </section>

  <section>
   <h2 className="mb-3 flex items-center gap-2 font-bold"><CreditCard className="h-5 w-5 text-violet-400"/>Cartões</h2>
   {!availability.cards?unavailable('Não foi possível confirmar faturas e exposição dos cartões agora.'):cards.length===0?<p className="text-sm text-slate-400">Nenhum cartão acompanhado pela Casa.</p>:cards.map(c=><article key={c.card_id} className="mb-3 rounded-2xl border border-slate-800 p-4"><b>{c.card_name}</b><p>Fatura atual restante {money(c.current_invoice_remaining)}</p><CardFinancialJourney cardId={c.card_id}/></article>)}
  </section>

  <SettlementHub onResolve={onSettlementAction}/>

  <section>
   <h2 className="mb-3 flex items-center gap-2 font-bold"><Landmark className="h-5 w-5 text-emerald-400"/>Olhando pra frente</h2>
   {!availability.projection?unavailable('Não foi possível confirmar a projeção dos próximos meses.'):projection.length===0?<p className="text-sm text-slate-400">Ainda não há projeções futuras.</p>:projection.map(m=><article key={m.financial_month} className="mb-3 rounded-2xl border border-slate-800 p-4"><b>{monthLabel(m.financial_month)}</b><strong className="float-right">{money(m.projected_ending_cash)}</strong></article>)}
  </section>
 </div>;
}
