import { useEffect, useState } from 'react';
import { ChevronRight, CircleGauge, CreditCard, Landmark, LoaderCircle, WalletCards } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { getFinancialDashboard, getMemberFinancialPerspective, type MemberMonthlyProjection } from '../../finance/financialDashboard.js';
import { ensureRecurringExpenseHorizon, recurringExpenseRollingHorizonDate } from '../../finance/recurringExpenses.js';
import type { CoverageActionKind } from '../../finance/coverageActionIntent.js';
import type { SettlementActionIntent } from '../../finance/settlementActionIntent.js';
import { FinancialPriorityCenter, type AttentionNavigationAction } from './FinancialPriorityCenter.js';
import { SettlementHub } from './SettlementHub.js';
import { dateInTimeZone } from '../../finance/householdClock.js';
import { FinancialPerspectiveSelector, type FinancialPerspective } from './FinancialPerspectiveSelector.js';
import { FinancialPeriodNavigator } from './FinancialPeriodNavigator.js';
import { listCardOverviews, type CardOverview } from '../../finance/cardOverview.js';
import { listHouseholdResourcePositions, listMemberResourcePositions, type HouseholdResourcePosition, type MemberResourcePosition } from '../../finance/memberResources.js';
import { UpcomingFinancialEvents } from './UpcomingFinancialEvents.js';
import { ResourceActionRow, type ResourceNavigationAction } from './ResourceActionRow.js';
import { getHouseholdReferenceProjection, getMemberReferenceProjection, getReferenceMonthContext, normalizeReferenceMonth, shiftReferenceMonth, type ReferenceMonthContext } from '../../finance/referenceMonthDashboard.js';
import { FinancialPageHeader } from './FinancialPageHeader.js';
import { FinancialSectionHeading } from './FinancialSectionHeading.js';

const money=(value:number|string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value));
const monthLabel=(value:string)=>new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`));
const shortDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const healthText={green:'Saudável',yellow:'Atenção',red:'Crítico'}as const;
const healthClass={green:'text-emerald-300',yellow:'text-amber-300',red:'text-rose-300'}as const;
const unavailable=(message:string)=><p role="status" className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-4 text-sm text-amber-100">{message}</p>;
type Dashboard=Awaited<ReturnType<typeof getFinancialDashboard>>;

export function CasaHomeScreen({perspective,onPerspectiveChange,onCoverageAction,onAttentionAction,onSettlementAction,onOpenCard,onResourceAction}:{perspective:FinancialPerspective;onPerspectiveChange:(value:FinancialPerspective)=>void;onCoverageAction?:(kind:CoverageActionKind,suggestedAmount:number)=>void;onAttentionAction?:(action:AttentionNavigationAction)=>void;onSettlementAction?:(intent:SettlementActionIntent)=>void;onOpenCard?:(cardId:string)=>void;onResourceAction?:(action:ResourceNavigationAction)=>void}){
 const{household,householdMembers}=useSupabaseAuth();
 const[dashboard,setDashboard]=useState<Dashboard|null>(null);
 const[memberProjection,setMemberProjection]=useState<MemberMonthlyProjection[]>([]);
 const[memberCards,setMemberCards]=useState<CardOverview[]>([]);
 const[memberResources,setMemberResources]=useState<MemberResourcePosition[]>([]);
 const[householdResourceRows,setHouseholdResourceRows]=useState<HouseholdResourcePosition[]>([]);
 const[memberLoading,setMemberLoading]=useState(false);
 const[memberError,setMemberError]=useState(false);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState(false);
 const[referenceMonth,setReferenceMonth]=useState('');
 const[periodPickerOpen,setPeriodPickerOpen]=useState(false);
 const[referenceContext,setReferenceContext]=useState<ReferenceMonthContext|null>(null);
 const[referenceProjection,setReferenceProjection]=useState<Dashboard['projection']>([]);
 const[referenceMemberProjection,setReferenceMemberProjection]=useState<MemberMonthlyProjection[]>([]);
 const[referenceLoading,setReferenceLoading]=useState(false);
 const[referenceError,setReferenceError]=useState(false);
 const currentReferenceMonth=household?normalizeReferenceMonth(dateInTimeZone(household.timezone)):'';

 useEffect(()=>{if(!household)return;setReferenceMonth(normalizeReferenceMonth(dateInTimeZone(household.timezone)));setPeriodPickerOpen(false);},[household?.id,household?.timezone]);
 useEffect(()=>{let cancelled=false;if(!supabase||!household||!referenceMonth){setReferenceContext(null);setReferenceProjection([]);setReferenceMemberProjection([]);return()=>{cancelled=true;};}setReferenceLoading(true);setReferenceError(false);setReferenceProjection([]);setReferenceMemberProjection([]);const load=async()=>{try{const context=await getReferenceMonthContext(supabase,household.id,referenceMonth);if(cancelled)return;setReferenceContext(context);if(context.period_kind==='future'){const [householdRows,memberRows]=await Promise.all([getHouseholdReferenceProjection(supabase,household.id,referenceMonth),perspective==='household'?Promise.resolve([]):getMemberReferenceProjection(supabase,household.id,perspective,referenceMonth)]);if(cancelled)return;setReferenceProjection(householdRows);setReferenceMemberProjection(memberRows);}}catch{if(!cancelled){setReferenceContext(null);setReferenceError(true);}}finally{if(!cancelled)setReferenceLoading(false);}};void load();return()=>{cancelled=true;};},[household?.id,referenceMonth,perspective]);
 useEffect(()=>{let cancelled=false;if(!supabase||!household)return()=>{cancelled=true;};setLoading(true);setError(false);setDashboard(null);const load=async()=>{try{try{await ensureRecurringExpenseHorizon(supabase,household.id,recurringExpenseRollingHorizonDate(dateInTimeZone(household.timezone)));}catch(error){console.warn('Casa Finance: não foi possível atualizar o horizonte de despesas recorrentes antes da Home.',error);}const nextDashboard=await getFinancialDashboard(supabase,household.id,household.timezone);if(!cancelled)setDashboard(nextDashboard);}catch{if(!cancelled)setError(true);}finally{if(!cancelled)setLoading(false);}};void load();return()=>{cancelled=true;};},[household?.id,household?.timezone]);
 useEffect(()=>{let cancelled=false;if(!supabase||!household){setHouseholdResourceRows([]);return()=>{cancelled=true;};}listHouseholdResourcePositions(supabase,household.id).then(rows=>{if(!cancelled)setHouseholdResourceRows(rows);}).catch(()=>{if(!cancelled)setHouseholdResourceRows([]);});return()=>{cancelled=true;};},[household?.id]);
 useEffect(()=>{let cancelled=false;if(!supabase||!household||perspective==='household'||!referenceMonth||referenceMonth!==currentReferenceMonth){setMemberProjection([]);setMemberCards([]);setMemberResources([]);setMemberError(false);return()=>{cancelled=true;};}setMemberLoading(true);setMemberError(false);setMemberProjection([]);setMemberCards([]);setMemberResources([]);Promise.all([getMemberFinancialPerspective(supabase,household.id,perspective,household.timezone),listCardOverviews(supabase,household.id),listMemberResourcePositions(supabase,household.id,perspective)]).then(([rows,cardRows,resourceRows])=>{if(cancelled)return;setMemberProjection(rows);setMemberCards(cardRows);setMemberResources(resourceRows);}).catch(()=>{if(!cancelled)setMemberError(true);}).finally(()=>{if(!cancelled)setMemberLoading(false);});return()=>{cancelled=true;};},[household?.id,household?.timezone,perspective,referenceMonth,currentReferenceMonth]);


 if(loading)return <LoaderCircle className="mx-auto mt-16 h-7 w-7 animate-spin text-blue-400"/>;
 if(error||!dashboard)return <p role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">Não foi possível carregar nenhuma fonte da posição financeira. Nenhum valor foi substituído por zero.</p>;

 const selectedMember=householdMembers.find(m=>m.id===perspective)??null;
 const{household:position,health,confidence,attention,projection,cards,resources,guidance,availability}=dashboard;
 const currentMonth=availability.projection?projection[0]:undefined;
 const currentCash=health?.current_cash!=null?Number(health.current_cash):resources?resources.availableCash:null;
 const projectedEndingCash=health?.projected_ending_cash!=null?Number(health.projected_ending_cash):position?Number(position.projected_balance):null;
 const gap=guidance?Number(guidance.coverage_gap):null;
 const hasPartialFailure=Object.values(availability).some(value=>!value);
 const selector=<FinancialPerspectiveSelector value={perspective} onChange={onPerspectiveChange}/>;
 const resourceOwnerLabel=(ids:string[])=>{const names=ids.map(id=>householdMembers.find(member=>member.id===id)?.display_name).filter((name):name is string=>Boolean(name));return names.length>1?names.join(' + '):names[0]??null;};
 const trackingMonth=referenceContext?.tracking_started_on?normalizeReferenceMonth(referenceContext.tracking_started_on):null;
 const previousMonth=referenceMonth?shiftReferenceMonth(referenceMonth,-1):'';
 const previousDisabled=!referenceMonth||referenceLoading||Boolean(trackingMonth&&previousMonth<trackingMonth);
 const monthNavigator=referenceMonth?<FinancialPeriodNavigator
  label={monthLabel(referenceMonth)}
  open={periodPickerOpen}
  onToggle={()=>setPeriodPickerOpen(value=>!value)}
  onClose={()=>setPeriodPickerOpen(false)}
  onPrevious={()=>{setPeriodPickerOpen(false);setReferenceMonth(previousMonth);}}
  onNext={()=>{setPeriodPickerOpen(false);setReferenceMonth(shiftReferenceMonth(referenceMonth,1));}}
  previousDisabled={previousDisabled}
  nextDisabled={referenceLoading}
  monthValue={referenceMonth.slice(0,7)}
  monthAriaLabel="Escolher mês da Casa"
  monthMin={trackingMonth?.slice(0,7)}
  onMonthChange={value=>setReferenceMonth(normalizeReferenceMonth(value))}
  onUseCurrentMonth={()=>setReferenceMonth(currentReferenceMonth)}
  pickerTitle="Escolher mês da Casa"
  pickerDescription="A Home usa mês financeiro canônico; os valores abaixo são relidos para o período escolhido."
 />:null;

 if(referenceMonth&&currentReferenceMonth&&referenceMonth!==currentReferenceMonth){
  const selectedMember=householdMembers.find(m=>m.id===perspective)??null;
  const isPast=referenceContext?.period_kind==='past';
  const futureRows=perspective==='household'?referenceProjection:referenceMemberProjection;
  const futureCurrent=futureRows[0];
  const futureIncome=futureCurrent?Number(futureCurrent.realized_true_income_in_month)+Number(futureCurrent.expected_reliable_income_remaining)+(perspective==='household'?0:Number((futureCurrent as MemberMonthlyProjection).scheduled_settlement_inflow)):0;
  const futureOutflow=futureCurrent?(perspective==='household'
    ?Number((futureCurrent as Dashboard['projection'][number]).realized_commitments_in_month)+Number((futureCurrent as Dashboard['projection'][number]).remaining_commitments_in_month)+Number((futureCurrent as Dashboard['projection'][number]).projected_recurring_commitments)+Number((futureCurrent as Dashboard['projection'][number]).prior_pending_outflow)
    :Number((futureCurrent as MemberMonthlyProjection).realized_funding_in_month)+Number((futureCurrent as MemberMonthlyProjection).projected_funding_remaining)+Number((futureCurrent as MemberMonthlyProjection).scheduled_settlement_outflow)):0;
  const futureEnding=futureCurrent?(perspective==='household'?Number((futureCurrent as Dashboard['projection'][number]).projected_ending_cash):Number((futureCurrent as MemberMonthlyProjection).projected_ending_liquidity)):null;
  const openingCash=referenceContext?.historical_opening_cash==null?null:Number(referenceContext.historical_opening_cash);
  const closingCash=referenceContext?.historical_closing_cash==null?null:Number(referenceContext.historical_closing_cash);
  return <div className="space-y-7">
   <FinancialPageHeader title="Casa"/>
   {monthNavigator}
   {selector}
   {referenceLoading?<LoaderCircle className="mx-auto mt-12 h-7 w-7 animate-spin text-blue-400"/>:referenceError||!referenceContext?<p role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">Não foi possível confirmar este período. O Casa não reutilizou dados do mês atual.</p>:!referenceContext.can_navigate?<p role="status" className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-4 text-sm text-amber-100">Este mês é anterior ao início do acompanhamento financeiro da Casa.</p>:isPast?<>
    <section className="rounded-[2rem] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 p-5">
     <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">Fotografia histórica</p>
     <h2 className="mt-1 text-xl font-black capitalize">{monthLabel(referenceMonth)}</h2>
     {referenceContext.coverage_state==='partial'&&<p className="mt-3 rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-100">A Casa começou a ser acompanhada em {shortDate(referenceContext.tracking_started_on!)}. O período anterior a essa data não é inventado.</p>}
     {perspective==='household'?<div className="mt-5 grid grid-cols-2 gap-3"><article className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-slate-400">Abertura conhecida</p><strong className="mt-1 block text-xl">{openingCash===null?'Não disponível':money(openingCash)}</strong></article><article className="rounded-2xl bg-white/5 p-3"><p className="text-xs text-slate-400">Fechamento</p><strong className="mt-1 block text-xl">{closingCash===null?'Não disponível':money(closingCash)}</strong></article></div>:<p className="mt-4 text-sm text-slate-300">O Casa mostra abaixo apenas fatos econômicos atribuídos a você neste mês. Não retrocede o saldo atual nem a titularidade atual para fabricar uma liquidez individual histórica.</p>}
     {perspective==='household'&&openingCash!==null&&closingCash!==null&&<p className="mt-4 text-sm text-slate-300">O caixa acompanhado variou <strong className={closingCash-openingCash<0?'text-rose-300':'text-emerald-300'}>{closingCash-openingCash>=0?'+ ':''}{money(closingCash-openingCash)}</strong> dentro da cobertura canônica do período.</p>}
    </section>
   </>:<>
    <section className="rounded-[2rem] border border-violet-900/60 bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-900 p-5">
     <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">Planejamento</p><h2 className="mt-1 text-xl font-black capitalize">{monthLabel(referenceMonth)}</h2><p className="mt-2 text-xs text-white/65">Projeção baseada no que já é conhecido hoje. Não é saldo realizado nem fato futuro garantido.</p>
     {!futureCurrent?<p className="mt-5 text-sm text-slate-300">Ainda não há projeção canônica para este período.</p>:<><div className="mt-5 grid grid-cols-2 gap-3"><article className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-white/70">Entradas consideradas</p><strong className="mt-1 block text-xl text-emerald-200">{money(futureIncome)}</strong></article><article className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-white/70">{perspective==='household'?'Compromissos considerados':'Pode sair dos meus recursos'}</p><strong className="mt-1 block text-xl text-rose-200">{money(futureOutflow)}</strong></article></div><div className="mt-5 border-t border-slate-800 pt-4"><p className="text-xs text-white/70">{perspective==='household'?'Pode terminar com':'Pode terminar comigo'}</p><strong className={'mt-1 block text-3xl '+((futureEnding??0)<0?'text-rose-300':'text-white')}>{futureEnding===null?'Não confirmado':money(futureEnding)}</strong></div></>}
    </section>
    {futureRows.length>1&&<section><FinancialSectionHeading title="Meses seguintes"/><div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">{futureRows.slice(1).map(row=>{const ending=perspective==='household'?Number((row as Dashboard['projection'][number]).projected_ending_cash):Number((row as MemberMonthlyProjection).projected_ending_liquidity);return <article key={row.financial_month} className="min-w-[68%] snap-start rounded-2xl bg-slate-900/60 p-4"><b className="capitalize">{monthLabel(row.financial_month)}</b><p className="mt-3 text-xs text-slate-500">Pode terminar com</p><strong className={ending<0?'text-rose-300':'text-slate-100'}>{money(ending)}</strong></article>})}</div></section>}
   </>}
  </div>;
 }

 if(perspective!=='household'){
  const current=memberProjection[0];
  const cardRows=memberCards.map(card=>({card,responsibility:card.member_responsibilities.find(item=>item.member_id===perspective)})).filter(item=>Number(item.responsibility?.member_responsibility_exposure??0)>0);
  const attributedResourceTotal=memberResources.reduce((sum,item)=>sum+Number(item.attributed_amount),0);
  return <div className="space-y-7"><FinancialPageHeader title="Casa"/>{monthNavigator}{selector}{memberLoading?<LoaderCircle className="mx-auto h-7 w-7 animate-spin"/>:memberError||!current?<p role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">Não foi possível carregar esta perspectiva financeira. Nenhum valor foi substituído por zero.</p>:<>
   <section><FinancialSectionHeading title="Como estamos?" icon={<CircleGauge className="h-5 w-5 text-blue-400"/>}/><div className="rounded-[2rem] border border-slate-800 bg-slate-900/65 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Posso movimentar hoje</p><strong className="mt-1 block text-3xl">{money(current.opening_liquidity)}</strong></div></div>
    <div className="mt-5 grid grid-cols-2 gap-2">
     <article className="rounded-xl bg-emerald-950/20 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-300/80">Entrou</p><strong className="mt-1 block text-lg text-emerald-200">{money(current.realized_true_income_in_month)}</strong></article>
     <article className="rounded-xl bg-blue-950/35 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-blue-300/80">Ainda entra</p><strong className="mt-1 block text-lg">{money(current.expected_reliable_income_remaining)}</strong></article>
     <article className="rounded-xl bg-rose-950/20 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-rose-300/80">Já saiu</p><strong className="mt-1 block text-lg text-rose-200">{money(current.realized_funding_in_month)}</strong></article>
     <article className="rounded-xl bg-amber-950/30 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-300/80">Ainda pode sair</p><strong className="mt-1 block text-lg">{money(current.projected_funding_remaining)}</strong></article>
    </div>
    <div className="mt-5 border-t border-slate-800 pt-4"><p className="text-xs text-slate-400">Deve sobrar comigo no fim do mês</p><strong className="mt-1 block text-2xl">{money(current.projected_ending_liquidity)}</strong><p className="mt-1 text-[11px] text-slate-500">Minha responsabilidade restante: {money(current.economic_responsibility_remaining)}</p></div>
   </div></section>

   <section><FinancialSectionHeading title="Onde está nosso dinheiro" icon={<WalletCards className="h-5 w-5 text-blue-400"/>}/>{memberResources.length===0?<p className="rounded-2xl bg-slate-900/35 p-4 text-sm text-slate-500">Nenhum recurso pôde ser atribuído individualmente.</p>:(()=>{const groups=[
    {key:'accounts',label:'Contas',rows:memberResources.filter(item=>Boolean(item.institution)&&!item.is_investment&&item.resource_restriction!=='reserve'&&item.type!=='meal_benefit')},
    {key:'money',label:'Dinheiro',rows:memberResources.filter(item=>!item.institution&&!item.is_investment&&item.resource_restriction!=='reserve'&&item.type!=='meal_benefit')},
    {key:'benefits',label:'Benefícios',rows:memberResources.filter(item=>!item.is_investment&&item.type==='meal_benefit')},
    {key:'investments',label:'Investimentos',rows:memberResources.filter(item=>item.is_investment||item.resource_restriction==='reserve')}
   ].filter(group=>group.rows.length>0);return <div className="space-y-3"><div className="mb-2 px-1"><p className="text-sm text-slate-500">Valor acompanhado</p><strong className="text-3xl">{money(attributedResourceTotal)}</strong></div>{groups.map(group=>{const ordered=[...group.rows].sort((a,b)=>Number(b.attributed_amount)-Number(a.attributed_amount));const total=ordered.reduce((sum,item)=>sum+Number(item.attributed_amount),0);return <details key={group.key} className="group/resources rounded-2xl border border-slate-800/80 bg-slate-900/30"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3"><div><p className="font-bold text-slate-200">{group.label}</p><p className="text-[11px] text-slate-500">{ordered.length} {ordered.length===1?'recurso':'recursos'}</p></div><div className="flex items-center gap-2"><strong className="text-sm text-slate-200">{money(total)}</strong><ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-open/resources:rotate-90"/></div></summary><div className="grid grid-cols-2 gap-2 border-t border-slate-800/70 p-3 sm:grid-cols-3">{ordered.map(item=><ResourceActionRow key={item.account_id} resource={{accountId:item.account_id,name:item.name,type:item.type,institution:item.institution,ownerLabel:resourceOwnerLabel(item.owner_member_ids),resourceRestriction:item.resource_restriction,isInvestment:item.is_investment,amount:Number(item.attributed_amount),amountLabel:item.allocation_ratio<1?`Sua parte · ${Math.round(item.allocation_ratio*100)}%`:'Saldo atribuído',detailLabel:item.resource_restriction==='reserve'?'Reserva':item.allocation_ratio<1?`total ${money(item.current_balance)}`:null}} onAction={onResourceAction}/>)}</div></details>})}</div>})()}</section>

   <section><FinancialSectionHeading title="Cartões" icon={<CreditCard className="h-5 w-5 text-violet-400"/>}/>{cardRows.length===0?<p className="rounded-2xl bg-slate-900/35 p-4 text-sm text-slate-500">Nenhum compromisso seu em cartões agora.</p>:<div className="space-y-2">{cardRows.map(({card,responsibility})=><article key={card.card_id} role="button" tabIndex={0} onClick={()=>onOpenCard?.(card.card_id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onOpenCard?.(card.card_id)}}} className="cursor-pointer rounded-[1.5rem] bg-slate-900/60 p-4 transition-transform hover:-translate-y-0.5"><div className="flex items-start justify-between gap-3"><div><b className="text-base">{card.card_name}</b><p className="mt-1 text-xs text-slate-500">{card.next_due_date?'Vence '+shortDate(card.next_due_date):'Sem vencimento confirmado'}</p></div><ChevronRight className="h-5 w-5 text-slate-600"/></div><div className="mt-4 grid grid-cols-3 gap-2"><div><p className="text-xs text-slate-500">Minha fatura</p><strong className="mt-1 block text-base">{money(responsibility?.member_current_invoice_responsibility??0)}</strong></div><div><p className="text-xs text-slate-500">Meu futuro</p><strong className="mt-1 block text-base">{money(responsibility?.member_future_responsibility??0)}</strong></div><div><p className="text-xs text-slate-500">Limite livre</p><strong className="mt-1 block text-base text-emerald-300">{money(card.available_limit)}</strong></div></div></article>)}</div>}</section>

   <section><FinancialSectionHeading title="Valores com pessoas"/><div className="grid grid-cols-2 gap-3"><article className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-4"><p className="text-xs text-emerald-300">Tenho a receber</p><strong className="mt-1 block text-lg">{money(current.settlement_receivable_position)}</strong></article><article className="rounded-2xl border border-amber-900/50 bg-amber-950/20 p-4"><p className="text-xs text-amber-300">Tenho a repassar</p><strong className="mt-1 block text-lg">{money(current.settlement_payable_position)}</strong></article></div></section>

   <UpcomingFinancialEvents perspective={perspective} onOpenCard={onOpenCard}/>

   <section><FinancialSectionHeading title="Olhando pra frente"/>{memberProjection.length===0?<p className="mt-3 text-sm text-slate-500">Ainda não há projeções individuais.</p>:<div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">{memberProjection.map((m,index)=><article key={m.financial_month} className="min-w-[76%] snap-start rounded-[1.5rem] bg-slate-900/60 p-4 sm:min-w-[46%]"><div className="flex items-center justify-between"><b className="capitalize">{monthLabel(m.financial_month)}</b>{index===0&&<span className="rounded-full bg-blue-500/10 px-2 py-1 text-[11px] font-bold text-blue-300">agora</span>}</div><p className="mt-4 text-xs text-slate-500">Pode terminar comigo</p><strong className={`mt-1 block text-2xl ${Number(m.projected_ending_liquidity)<0?'text-rose-300':'text-slate-100'}`}>{money(m.projected_ending_liquidity)}</strong>{m.projected_net_change!==0&&<p className={`mt-1 text-xs font-semibold ${m.projected_net_change<0?'text-rose-300':'text-emerald-300'}`}>{m.projected_net_change>0?'▲ ':'▼ '}{money(Math.abs(m.projected_net_change))} no mês</p>}<div className="mt-4 flex justify-between gap-3 text-xs"><span className="text-emerald-300">+ {money(Number(m.realized_true_income_in_month)+Number(m.expected_reliable_income_remaining)+Number(m.scheduled_settlement_inflow))}</span><span className="text-rose-300">− {money(Number(m.realized_funding_in_month)+Number(m.projected_funding_remaining)+Number(m.scheduled_settlement_outflow))}</span></div></article>)}</div>}</section>
  </>}</div>;
 }

 return <div className="space-y-7">
  <FinancialPageHeader title="Casa"/>
  {monthNavigator}
  {selector}
  {hasPartialFailure&&<p role="status" className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-4 text-sm text-amber-100">Algumas análises não puderam ser confirmadas agora. O Casa mantém visíveis apenas os dados que conseguiu ler e não substitui informações ausentes por R$ 0,00.</p>}

  <section>
   <FinancialSectionHeading title="Como estamos?" icon={<CircleGauge className="h-5 w-5 text-blue-400"/>}/>
   <div className="rounded-[2rem] border border-slate-800 bg-slate-900/65 p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Agora</p>{currentCash===null?<strong className="mt-1 block text-xl">Não confirmado</strong>:<strong className="mt-1 block text-3xl">{money(currentCash)}</strong>}<p className="mt-1 text-[11px] text-slate-500">Saldo atual em contas e dinheiro físico.</p></div><div className="flex flex-col items-end gap-2">{health&&<span className={`rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold ${healthClass[health.health]}`}>{healthText[health.health]}</span>}{confidence&&confidence.confidence_state!=='well_updated'&&<span className="max-w-44 rounded-full bg-amber-400/10 px-2.5 py-1 text-right text-[11px] font-semibold text-amber-200">{confidence.confidence_label}</span>}</div></div>
    {!availability.projection||!currentMonth?<p className="mt-5 text-sm text-slate-400">Ainda não há resumo financeiro confirmado para este mês.</p>:(()=>{const entered=Number(currentMonth.realized_true_income_in_month);const expected=Number(currentMonth.expected_reliable_income_remaining);const realized=Number(currentMonth.realized_commitments_in_month);const pending=Number(currentMonth.remaining_commitments_in_month)+Number(currentMonth.projected_recurring_commitments)+Number(currentMonth.prior_pending_outflow);return <div className="mt-5 grid grid-cols-2 gap-2">
     <article className="rounded-xl bg-emerald-950/20 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-300/80">Entrou</p><strong className="mt-1 block text-lg text-emerald-200">{money(entered)}</strong></article>
     <article className="rounded-xl bg-blue-950/35 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-blue-300/80">Ainda entra</p><strong className="mt-1 block text-lg">{money(expected)}</strong></article>
     <article className="rounded-xl bg-rose-950/20 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-rose-300/80">Já comprometido</p><strong className="mt-1 block text-lg text-rose-200">{money(realized)}</strong></article>
     <article className="rounded-xl bg-amber-950/30 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-300/80">Ainda compromete</p><strong className="mt-1 block text-lg">{money(pending)}</strong></article>
    </div>})()}
    <div className="mt-5 border-t border-slate-800 pt-4"><p className="text-xs text-slate-400">Deve sobrar no fim do mês</p>{projectedEndingCash===null?<strong className="mt-1 block text-lg">Não confirmado</strong>:<strong className="mt-1 block text-2xl">{money(projectedEndingCash)}</strong>}<p className="mt-1 text-[11px] text-slate-500">Considera entradas confiáveis ainda esperadas e compromissos conhecidos.</p></div>
   </div>
   {!availability.guidance&&unavailable('A orientação de cobertura está indisponível agora. O Casa não vai presumir quanto está livre ou faltando.')}
   {guidance&&guidance.guidance_state!=='covered'&&<article className="mt-3 rounded-2xl border border-rose-900/70 bg-rose-950/20 p-4"><h3 className="font-bold">{guidance.guidance_title}</h3>{guidance.guidance_state==='covered_by_expected_income'?<p className="mt-1 text-sm">O caixa atual sozinho não cobre tudo, mas as entradas confiáveis previstas fecham o mês.</p>:<><p className="mt-1 text-sm">Faltam <strong>{money(gap??0)}</strong> na projeção para cobrir os compromissos conhecidos.</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><button onClick={()=>onCoverageAction?.('transfer',gap??0)} className="min-h-11 rounded-xl border border-slate-700 px-3 text-sm font-bold">Mover dinheiro de outra conta da Casa</button>{Number(guidance.reserve_balance)+Number(guidance.investment_balance)>0&&<button onClick={()=>onCoverageAction?.('reserve',gap??0)} className="min-h-11 rounded-xl border border-slate-700 px-3 text-sm font-bold">Usar dinheiro de uma reserva ou investimento</button>}<button onClick={()=>onCoverageAction?.('loan',gap??0)} className="min-h-11 rounded-xl border border-slate-700 px-3 text-sm font-bold">Pegar dinheiro emprestado</button></div></>}</article>}
  </section>

  {availability.attention?<FinancialPriorityCenter items={attention} onNavigate={onAttentionAction}><UpcomingFinancialEvents perspective={perspective} onOpenCard={onOpenCard} embedded/></FinancialPriorityCenter>:unavailable('Não foi possível conferir o centro de atenção. Nenhuma pendência foi presumida como resolvida.')}

  <section>
   <FinancialSectionHeading title="Onde está nosso dinheiro" icon={<WalletCards className="h-5 w-5 text-blue-400"/>}/>
   {!availability.resources||!resources?unavailable('Não foi possível confirmar os saldos dos recursos da Casa.'):(()=>{const groups=[
    {key:'accounts',label:'Contas',rows:householdResourceRows.filter(item=>Boolean(item.institution)&&!item.is_investment&&item.resource_restriction!=='reserve'&&item.type!=='meal_benefit')},
    {key:'money',label:'Dinheiro',rows:householdResourceRows.filter(item=>!item.institution&&!item.is_investment&&item.resource_restriction!=='reserve'&&item.type!=='meal_benefit')},
    {key:'benefits',label:'Benefícios',rows:householdResourceRows.filter(item=>!item.is_investment&&item.type==='meal_benefit')},
    {key:'investments',label:'Investimentos',rows:householdResourceRows.filter(item=>item.is_investment||item.resource_restriction==='reserve')}
   ].filter(group=>group.rows.length>0);const resourceTotal=householdResourceRows.reduce((sum,item)=>sum+Number(item.current_balance),0);return <div className="space-y-3"><div className="mb-2 rounded-2xl bg-white/[0.04] p-4"><div className="flex items-end justify-between gap-3"><div><p className="text-xs text-slate-400">Valor acompanhado</p><strong className="mt-1 block text-3xl">{money(resourceTotal)}</strong></div><span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-300">{householdResourceRows.length} {householdResourceRows.length===1?'recurso':'recursos'}</span></div></div>{groups.map(group=>{const ordered=[...group.rows].sort((a,b)=>Number(b.current_balance)-Number(a.current_balance));const total=ordered.reduce((sum,item)=>sum+Number(item.current_balance),0);return <details key={group.key} className="group/resources rounded-2xl border border-slate-800/80 bg-slate-900/30"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3"><div><p className="font-bold text-slate-200">{group.label}</p><p className="text-[11px] text-slate-500">{ordered.length} {ordered.length===1?'recurso':'recursos'}</p></div><div className="flex items-center gap-2"><strong className="text-sm text-slate-200">{money(total)}</strong><ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-open/resources:rotate-90"/></div></summary><div className="grid grid-cols-2 gap-2 border-t border-slate-800/70 p-3 sm:grid-cols-3">{ordered.map(item=><ResourceActionRow key={item.account_id} resource={{accountId:item.account_id,name:item.name,type:item.type,institution:item.institution,ownerLabel:resourceOwnerLabel(item.owner_member_ids),resourceRestriction:item.resource_restriction,isInvestment:item.is_investment,amount:Number(item.current_balance),amountLabel:'Saldo atual',detailLabel:item.resource_restriction==='reserve'?'Reserva':item.is_investment?'Posição patrimonial':null}} onAction={onResourceAction}/>)}</div></details>})}</div>})()}
  </section>

  <section>
   <FinancialSectionHeading title="Cartões" icon={<CreditCard className="h-5 w-5 text-violet-400"/>}/>
   {!availability.cards?unavailable('Não foi possível confirmar faturas e exposição dos cartões agora.'):cards.length===0?<p className="text-sm text-slate-400">Nenhum cartão acompanhado pela Casa.</p>:<div className="space-y-2">{cards.map(c=>{const usage=c.utilization_ratio==null?null:Number(c.utilization_ratio)*100;const healthLabel=c.card_health==='red'?'Crítico':c.card_health==='yellow'?'Atenção':'Confortável';const healthTone=c.card_health==='red'?'text-rose-300':c.card_health==='yellow'?'text-amber-300':'text-emerald-300';return <article key={c.card_id} role="button" tabIndex={0} onClick={()=>onOpenCard?.(c.card_id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onOpenCard?.(c.card_id)}}} className="cursor-pointer rounded-[1.6rem] bg-slate-900/60 p-4 transition-transform hover:-translate-y-0.5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><b className="text-base">{c.card_name}</b><span className={'text-xs font-bold '+healthTone}>{healthLabel}</span></div><p className="mt-1 text-xs text-slate-500">{c.next_due_date?'Vence '+shortDate(c.next_due_date):'Sem vencimento confirmado'}</p></div><ChevronRight className="h-5 w-5 text-slate-600"/></div><div className="mt-4 grid grid-cols-3 gap-2"><div><p className="text-xs text-slate-500">Fatura</p><strong className="mt-1 block text-base">{money(c.current_invoice_remaining)}</strong></div><div><p className="text-xs text-slate-500">Futuro</p><strong className="mt-1 block text-base">{money(c.future_known_commitments)}</strong></div><div><p className="text-xs text-slate-500">Limite livre</p><strong className={'mt-1 block text-base '+(c.available_limit<0?'text-rose-300':'text-emerald-300')}>{money(c.available_limit)}</strong></div></div>{usage!=null&&<div className="mt-4"><div className="mb-1 flex justify-between text-xs text-slate-500"><span>Crédito comprometido</span><span>{Math.round(usage)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={'h-full rounded-full '+(c.card_health==='red'?'bg-rose-400':c.card_health==='yellow'?'bg-amber-400':'bg-violet-400')} style={{width:String(Math.min(100,Math.max(0,usage)))+'%'}}/></div></div>}{c.over_limit_amount>0&&<p className="mt-2 text-xs font-semibold text-rose-300">Acima do limite em {money(c.over_limit_amount)}.</p>}</article>})}</div>}
  </section>

  <SettlementHub perspective={perspective} onResolve={onSettlementAction}/>



  <section>
   <FinancialSectionHeading title="Olhando pra frente" icon={<Landmark className="h-5 w-5 text-emerald-400"/>}/>
   {!availability.projection?unavailable('Não foi possível confirmar a projeção dos próximos meses.'):projection.length===0?<p className="text-sm text-slate-400">Ainda não há projeções futuras.</p>:(()=>{return <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">{projection.map((m,index)=>{const realizedIn=Number(m.realized_true_income_in_month);const realizedOut=Number(m.realized_commitments_in_month);const committedOut=Number(m.remaining_commitments_in_month)+Number(m.prior_pending_outflow);const plannedIn=Number(m.expected_reliable_income_remaining);const plannedOut=Number(m.projected_recurring_commitments);const ending=Number(m.projected_ending_cash);const previousEnding=index>0?Number(projection[index-1].projected_ending_cash):null;const delta=previousEnding===null?null:ending-previousEnding;return <article key={m.financial_month} className="min-w-[84%] snap-start rounded-[1.6rem] border border-slate-800 bg-slate-900/60 p-4 sm:min-w-[52%]"><div className="flex items-center justify-between gap-2"><b className="capitalize">{monthLabel(m.financial_month)}</b>{index===0&&<span className="rounded-full bg-blue-500/10 px-2 py-1 text-[11px] font-bold text-blue-300">mês de referência</span>}</div><p className="mt-4 text-xs text-slate-500">Pode terminar com</p><strong className={`mt-1 block text-2xl ${ending<0?'text-rose-300':'text-slate-100'}`}>{money(ending)}</strong>{delta!==null&&<p className={`mt-1 text-xs font-semibold ${delta<0?'text-rose-300':delta>0?'text-emerald-300':'text-slate-500'}`}>{delta>0?'▲ ':delta<0?'▼ ':''}{money(Math.abs(delta))} vs. mês anterior</p>}<div className="mt-4 space-y-2"><div className="rounded-xl bg-slate-950/55 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Realizado</span><span className="text-[10px] text-slate-600">já aconteceu</span></div><div className="mt-1 flex justify-between gap-3 text-xs"><span className="text-emerald-300">+ {money(realizedIn)}</span><span className="text-rose-300">− {money(realizedOut)}</span></div></div><div className="rounded-xl bg-amber-950/10 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-amber-300/80">Comprometido</span><span className="text-[10px] text-slate-600">já existe para pagar</span></div><strong className="mt-1 block text-sm text-amber-200">− {money(committedOut)}</strong></div><div className="rounded-xl border border-dashed border-slate-700 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Planejado</span><span className="text-[10px] text-slate-600">ainda pode mudar</span></div><div className="mt-1 flex justify-between gap-3 text-xs"><span className="text-emerald-300/80">+ {money(plannedIn)}</span><span className="text-rose-300/80">− {money(plannedOut)}</span></div></div></div></article>})}</div>})()}
  </section>
 </div>;
}
