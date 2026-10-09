import { useEffect, useState } from 'react';
import { ChevronRight, CircleGauge, Landmark, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { getFinancialDashboard, getMemberFinancialPerspective, listUnattributedFundingDetails, type MemberMonthlyProjection, type UnattributedFundingDetail } from '../../finance/financialDashboard.js';
import { ensureRecurringExpenseHorizon, recurringExpenseRollingHorizonDate } from '../../finance/recurringExpenses.js';
import { ensureRecurringIncomeHorizon } from '../../finance/recurringIncome.js';
import type { CoverageActionKind } from '../../finance/coverageActionIntent.js';
import type { SettlementActionIntent } from '../../finance/settlementActionIntent.js';
import { FinancialPriorityCenter, type AttentionNavigationAction } from './FinancialPriorityCenter.js';
import { SafeHomeFinancialMap } from './HomeFinancialMap.js';
import { SettlementHub } from './SettlementHub.js';
import { dateInTimeZone } from '../../finance/householdClock.js';
import { FinancialPerspectiveSelector, type FinancialPerspective } from './FinancialPerspectiveSelector.js';
import { FinancialPeriodNavigator } from './FinancialPeriodNavigator.js';
import { listCardOverviews, type CardOverview } from '../../finance/cardOverview.js';
import { listHouseholdResourcePositions, listMemberResourcePositions, type HouseholdResourcePosition, type MemberResourcePosition } from '../../finance/memberResources.js';
import { UpcomingFinancialEvents } from './UpcomingFinancialEvents.js';
import type { ResourceNavigationAction } from './ResourceActionRow.js';
import { getHouseholdReferenceProjection, getMemberReferenceProjection, getReferenceMonthContext, normalizeReferenceMonth, shiftReferenceMonth, type ReferenceMonthContext } from '../../finance/referenceMonthDashboard.js';
import { FinancialPageHeader } from './FinancialPageHeader.js';
import { FinancialSectionHeading } from './FinancialSectionHeading.js';
import { MonthlyPositionStatement } from './MonthlyPositionStatement.js';

const money=(value:number|string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value));
const monthLabel=(value:string)=>new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`));
const shortDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const unavailable=(message:string)=><p role="status" className="rounded-2xl border border-amber-900/70 bg-amber-950/20 p-4 text-sm text-amber-100">{message}</p>;
type Dashboard=Awaited<ReturnType<typeof getFinancialDashboard>>;

export function CasaHomeScreen({perspective,onPerspectiveChange,onCoverageAction,onAttentionAction,onSettlementAction,onOpenCard,onResourceAction,refreshKey=0}:{perspective:FinancialPerspective;onPerspectiveChange:(value:FinancialPerspective)=>void;onCoverageAction?:(kind:CoverageActionKind,suggestedAmount:number)=>void;onAttentionAction?:(action:AttentionNavigationAction)=>void;onSettlementAction?:(intent:SettlementActionIntent)=>void;onOpenCard?:(cardId:string)=>void;onResourceAction?:(action:ResourceNavigationAction)=>void;refreshKey?:number}){
 const{household,householdMembers}=useSupabaseAuth();
 const[dashboard,setDashboard]=useState<Dashboard|null>(null);
 const[memberProjection,setMemberProjection]=useState<MemberMonthlyProjection[]>([]);
 const[memberCards,setMemberCards]=useState<CardOverview[]>([]);
 const[memberResources,setMemberResources]=useState<MemberResourcePosition[]>([]);
 const[unattributedDetails,setUnattributedDetails]=useState<UnattributedFundingDetail[]>([]);
 const[householdResourceRows,setHouseholdResourceRows]=useState<HouseholdResourcePosition[]>([]);
 const[memberLoading,setMemberLoading]=useState(false);
 const[memberError,setMemberError]=useState(false);
 const[memberDetailsWarning,setMemberDetailsWarning]=useState(false);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState(false);
 const[referenceMonth,setReferenceMonth]=useState('');
 const[periodPickerOpen,setPeriodPickerOpen]=useState(false);
 const[referenceContext,setReferenceContext]=useState<ReferenceMonthContext|null>(null);
 const[referenceProjection,setReferenceProjection]=useState<Dashboard['projection']>([]);
 const[referenceMemberProjection,setReferenceMemberProjection]=useState<MemberMonthlyProjection[]>([]);
 const[referenceLoading,setReferenceLoading]=useState(false);
 const[referenceError,setReferenceError]=useState(false);
 const[attentionRefreshKey,setAttentionRefreshKey]=useState(0);
 const currentReferenceMonth=household?normalizeReferenceMonth(dateInTimeZone(household.timezone)):'';

 useEffect(()=>{if(!household)return;setReferenceMonth(normalizeReferenceMonth(dateInTimeZone(household.timezone)));setPeriodPickerOpen(false);},[household?.id,household?.timezone,attentionRefreshKey,refreshKey]);
 useEffect(()=>{let cancelled=false;if(!supabase||!household||!referenceMonth){setReferenceContext(null);setReferenceProjection([]);setReferenceMemberProjection([]);return()=>{cancelled=true;};}setReferenceLoading(true);setReferenceError(false);setReferenceProjection([]);setReferenceMemberProjection([]);const load=async()=>{try{const context=await getReferenceMonthContext(supabase,household.id,referenceMonth);if(cancelled)return;setReferenceContext(context);if(context.period_kind==='future'){const [householdRows,memberRows]=await Promise.all([getHouseholdReferenceProjection(supabase,household.id,referenceMonth),perspective==='household'?Promise.resolve([]):getMemberReferenceProjection(supabase,household.id,perspective,referenceMonth)]);if(cancelled)return;setReferenceProjection(householdRows);setReferenceMemberProjection(memberRows);}}catch{if(!cancelled){setReferenceContext(null);setReferenceError(true);}}finally{if(!cancelled)setReferenceLoading(false);}};void load();return()=>{cancelled=true;};},[household?.id,referenceMonth,perspective,attentionRefreshKey,refreshKey]);
 useEffect(()=>{let cancelled=false;if(!supabase||!household)return()=>{cancelled=true;};setLoading(true);setError(false);setDashboard(null);const load=async()=>{try{const projectionHorizon=recurringExpenseRollingHorizonDate(dateInTimeZone(household.timezone));try{await ensureRecurringExpenseHorizon(supabase,household.id,projectionHorizon);}catch(error){console.warn('Casa Finance: não foi possível atualizar o horizonte de despesas recorrentes antes da Home.',error);}try{await ensureRecurringIncomeHorizon(supabase,household.id,projectionHorizon);}catch(error){console.warn('Casa Finance: não foi possível atualizar o horizonte de entradas recorrentes antes da Home.',error);}const nextDashboard=await getFinancialDashboard(supabase,household.id,household.timezone);if(!cancelled)setDashboard(nextDashboard);}catch{if(!cancelled)setError(true);}finally{if(!cancelled)setLoading(false);}};void load();return()=>{cancelled=true;};},[household?.id,household?.timezone,refreshKey]);
 useEffect(()=>{let cancelled=false;if(!supabase||!household){setHouseholdResourceRows([]);return()=>{cancelled=true;};}listHouseholdResourcePositions(supabase,household.id).then(rows=>{if(!cancelled)setHouseholdResourceRows(rows);}).catch(()=>{if(!cancelled)setHouseholdResourceRows([]);});return()=>{cancelled=true;};},[household?.id,attentionRefreshKey,refreshKey]);
 useEffect(()=>{let cancelled=false;if(!supabase||!household||perspective==='household'||!referenceMonth||referenceMonth!==currentReferenceMonth){setMemberProjection([]);setMemberCards([]);setMemberResources([]);setUnattributedDetails([]);setMemberError(false);setMemberDetailsWarning(false);return()=>{cancelled=true;};}setMemberLoading(true);setMemberError(false);setMemberDetailsWarning(false);setMemberProjection([]);setMemberCards([]);setMemberResources([]);setUnattributedDetails([]);Promise.allSettled([getMemberFinancialPerspective(supabase,household.id,perspective,household.timezone),listCardOverviews(supabase,household.id),listMemberResourcePositions(supabase,household.id,perspective),listUnattributedFundingDetails(supabase,household.id,currentReferenceMonth)]).then(([projectionResult,cardResult,resourceResult,detailResult])=>{if(cancelled)return;if(projectionResult.status==='rejected'){setMemberError(true);return;}setMemberDetailsWarning([cardResult,resourceResult,detailResult].some(result=>result.status==='rejected'));setMemberProjection(projectionResult.value);setMemberCards(cardResult.status==='fulfilled'?cardResult.value:[]);setMemberResources(resourceResult.status==='fulfilled'?resourceResult.value:[]);setUnattributedDetails(detailResult.status==='fulfilled'?detailResult.value:[]);}).finally(()=>{if(!cancelled)setMemberLoading(false);});return()=>{cancelled=true;};},[household?.id,household?.timezone,perspective,referenceMonth,currentReferenceMonth,attentionRefreshKey,refreshKey]);


 if(loading)return <LoaderCircle className="mx-auto mt-16 h-7 w-7 animate-spin text-blue-400"/>;
 if(error||!dashboard)return <p role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">Não foi possível carregar nenhuma fonte da posição financeira. Nenhum valor foi substituído por zero.</p>;

 const selectedMember=householdMembers.find(m=>m.id===perspective)??null;
 const{household:position,health,attention,projection,cards,settlements,resources,guidance,accountProjections,thirdPartyReceivables,availability}=dashboard;
 const currentMonth=availability.projection?projection[0]:undefined;
 const thirdPartyProjected=thirdPartyReceivables.reduce((sum,row)=>sum+Number(row.outstanding_amount),0);
 const currentCash=health?.current_cash!=null?Number(health.current_cash):resources?resources.availableCash:null;
 const gap=guidance?Number(guidance.coverage_gap):null;
 const memberName=(id:string)=>householdMembers.find(member=>member.id===id)?.display_name??'Morador';
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
  const futureOpening=futureCurrent?(perspective==='household'?Number((futureCurrent as Dashboard['projection'][number]).opening_cash):Number((futureCurrent as MemberMonthlyProjection).opening_liquidity)):0;
  const futureRealizedIncome=futureCurrent?Number(futureCurrent.realized_true_income_in_month):0;
  const futureExpectedIncome=futureCurrent?Number(futureCurrent.expected_reliable_income_remaining)+(perspective==='household'?0:Number((futureCurrent as MemberMonthlyProjection).scheduled_settlement_inflow)):0;
  const futureRealizedOutflow=futureCurrent?(perspective==='household'?Number((futureCurrent as Dashboard['projection'][number]).realized_commitments_in_month):Number((futureCurrent as MemberMonthlyProjection).realized_funding_in_month)):0;
  const futureRemainingOutflow=futureCurrent?(perspective==='household'
    ?Number((futureCurrent as Dashboard['projection'][number]).remaining_commitments_in_month)+Number((futureCurrent as Dashboard['projection'][number]).projected_recurring_commitments)+Number((futureCurrent as Dashboard['projection'][number]).prior_pending_outflow)
    :Number((futureCurrent as MemberMonthlyProjection).projected_funding_remaining)+Number((futureCurrent as MemberMonthlyProjection).scheduled_settlement_outflow)):0;
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
    <section>
     <FinancialSectionHeading title="Como estamos?" icon={<CircleGauge className="h-5 w-5 text-blue-400"/>}/>
     <div className="rounded-[2rem] border border-slate-800 bg-slate-900/65 p-5 shadow-sm">
      {!futureCurrent||futureEnding===null?<p className="text-sm text-slate-400">Ainda não temos informação suficiente para projetar este período.</p>:<MonthlyPositionStatement
       opening={futureOpening}
       realizedIncome={futureRealizedIncome}
       expectedIncome={futureExpectedIncome}
       realizedOutflow={futureRealizedOutflow}
       remainingOutflow={futureRemainingOutflow}
       ending={futureEnding}
       currentAvailable={futureOpening}
       subjectLabel={perspective==='household'?'Casa':selectedMember?.display_name??'Morador'}
       periodMode="future"
      />}
      {futureCurrent&&perspective!=='household'&&Number((futureCurrent as MemberMonthlyProjection).unattributed_funding_remaining)>0&&<p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-100">{money((futureCurrent as MemberMonthlyProjection).unattributed_funding_remaining)} ainda não têm responsável definido entre os moradores. O valor já está na projeção da Casa, mas não foi atribuído à sua projeção individual.</p>}
     </div>
    </section>
    {perspective==='household'&&<SafeHomeFinancialMap householdId={household?.id ?? ''} resources={householdResourceRows} cards={cards} perspective="household" memberName={memberName} onOpenCard={onOpenCard} onResourceAction={onResourceAction} onSettlementAction={onSettlementAction} refreshKey={attentionRefreshKey+refreshKey}/>}
    {futureRows.length>1&&<section><FinancialSectionHeading title="Olhando pra frente"/><div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">{futureRows.slice(1).map(row=>{const ending=perspective==='household'?Number((row as Dashboard['projection'][number]).projected_ending_cash):Number((row as MemberMonthlyProjection).projected_ending_liquidity);return <article key={row.financial_month} className="min-w-[68%] snap-start rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center gap-2"><span className={'h-2.5 w-2.5 rounded-full '+(ending<0?'bg-rose-400':'bg-emerald-400')}/><b className="capitalize">{monthLabel(row.financial_month)}</b></div><p className="mt-3 text-xs text-slate-500">{ending<0?'Pode faltar dinheiro no fechamento':'Deve fechar com'}</p><strong className={ending<0?'text-rose-300':'text-slate-100'}>{money(ending)}</strong></article>})}</div></section>}
   </>}
  </div>;
 }

 if(perspective!=='household'){
  const current=memberProjection[0];
  const memberBenefitBalance=memberResources.filter(item=>item.type==='meal_benefit').reduce((sum,item)=>sum+Number(item.attributed_amount),0);
  const memberInvestmentBalance=memberResources.filter(item=>item.is_investment).reduce((sum,item)=>sum+Number(item.attributed_amount),0);
  return <div className="space-y-7"><FinancialPageHeader title="Casa"/>{monthNavigator}{selector}{memberDetailsWarning&&<p role="status" className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-400">Alguns detalhes complementares não carregaram. A projeção principal do morador continua disponível.</p>}{memberLoading?<LoaderCircle className="mx-auto h-7 w-7 animate-spin"/>:memberError||!current?<p role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">Não foi possível carregar esta perspectiva financeira. Nenhum valor foi substituído por zero.</p>:<>
   <section><FinancialSectionHeading title="Como estamos?" icon={<CircleGauge className="h-5 w-5 text-blue-400"/>}/><div className="rounded-[2rem] border border-slate-800 bg-slate-900/65 p-5 shadow-sm">
    <MonthlyPositionStatement
     opening={Number(current.opening_liquidity)}
     realizedIncome={Number(current.realized_true_income_in_month)}
     expectedIncome={Number(current.expected_reliable_income_remaining)+Number(current.scheduled_settlement_inflow)}
     realizedOutflow={Number(current.realized_funding_in_month)}
     remainingOutflow={Number(current.projected_funding_remaining)+Number(current.scheduled_settlement_outflow)}
     ending={Number(current.projected_ending_liquidity)}
     currentAvailable={Number(current.opening_liquidity)}
     benefitBalance={memberBenefitBalance}
     investmentBalance={memberInvestmentBalance}
     subjectLabel={memberName(perspective)}
    />
    <p className="mt-3 text-[11px] text-slate-500">Minha responsabilidade econômica restante: {money(current.economic_responsibility_remaining)}.</p>
    {Number(current.unattributed_funding_remaining)>0&&<div className="mt-3 rounded-2xl border border-amber-900/60 bg-amber-950/15 p-3">
      <p className="text-sm font-bold text-amber-100">{money(current.unattributed_funding_remaining)} em compromissos da Casa ainda sem responsável definido</p>
      <div className="mt-2 space-y-2">{unattributedDetails.map(item=><div key={item.commitment_key} className="flex items-start justify-between gap-3 rounded-xl bg-slate-950/35 p-2.5"><div><p className="text-xs font-semibold text-slate-200">{item.description}</p>{item.due_date&&<p className="mt-0.5 text-[10px] text-slate-500">Vence {shortDate(item.due_date)}</p>}</div><strong className="text-xs text-amber-200">{money(item.amount)}</strong></div>)}</div>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">Esses valores já entram na projeção da Casa, mas ainda não foram atribuídos a um morador.</p>
      {unattributedDetails.some(item=>item.source_obligation_id)&&<div className="mt-2 flex flex-wrap gap-2">{unattributedDetails.filter(item=>item.source_obligation_id).map(item=><button key={item.commitment_key} type="button" onClick={()=>onSettlementAction?.({kind:'loan-detail',obligationId:item.source_obligation_id!})} className="min-h-9 rounded-xl border border-amber-800/70 px-3 text-xs font-bold text-amber-100">Definir responsável do empréstimo</button>)}</div>}
    </div>}
   </div></section>

   <section><FinancialSectionHeading title="Entre vocês"/><SettlementHub perspective={perspective} onResolve={onSettlementAction} embedded includeThirdParties={false}/></section>

   <SafeHomeFinancialMap resources={memberResources} cards={memberCards} perspective={perspective} memberName={memberName} onOpenCard={onOpenCard} onResourceAction={onResourceAction} onSettlementAction={onSettlementAction}/>

   <UpcomingFinancialEvents perspective={perspective} onOpenCard={onOpenCard}/>

   <section><FinancialSectionHeading title="Olhando pra frente"/>{memberProjection.length===0?<p className="mt-3 text-sm text-slate-500">Ainda não há projeções individuais.</p>:<div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2">{memberProjection.slice(1,4).map((m,index)=>{const ending=Number(m.projected_ending_liquidity);const previous=Number(memberProjection[index].projected_ending_liquidity);const delta=ending-previous;return <article key={m.financial_month} className="min-w-[72%] snap-start rounded-[1.5rem] bg-slate-900/60 p-4 sm:min-w-[44%]"><b className="capitalize">{monthLabel(m.financial_month)}</b><p className="mt-4 text-xs text-slate-500">{ending<0?'Pode faltar dinheiro no fechamento':'Se nada mudar, deve fechar com'}</p><strong className={`mt-1 block text-2xl ${ending<0?'text-rose-300':'text-slate-100'}`}>{money(ending)}</strong><p className={`mt-2 text-[11px] font-semibold ${delta<0?'text-rose-300':delta>0?'text-emerald-300':'text-slate-500'}`}>{delta>0?'Melhora ':delta<0?'Cai ': 'Sem mudança '}{money(Math.abs(delta))} vs. mês anterior</p></article>})}</div>}</section>
  </>}</div>;
 }

 return <div className="space-y-7">
  <FinancialPageHeader title="Casa"/>
  {monthNavigator}
  {selector}

  <section>
   <FinancialSectionHeading title="Como estamos?" icon={<CircleGauge className="h-5 w-5 text-blue-400"/>}/>
   <div className="rounded-[2rem] border border-slate-800 bg-slate-900/65 p-5 shadow-sm">
    {!availability.projection||!currentMonth?<p className="text-sm text-slate-400">Ainda não há resumo financeiro confirmado para este mês.</p>:<MonthlyPositionStatement
     opening={Number(currentMonth.opening_cash)}
     realizedIncome={Number(currentMonth.realized_true_income_in_month)}
     expectedIncome={Number(currentMonth.expected_reliable_income_remaining)}
     realizedOutflow={Number(currentMonth.realized_commitments_in_month)}
     remainingOutflow={Number(currentMonth.remaining_commitments_in_month)+Number(currentMonth.projected_recurring_commitments)+Number(currentMonth.prior_pending_outflow)}
     ending={Number(currentMonth.projected_ending_cash)+thirdPartyProjected}
     currentAvailable={currentCash}
     coverageState={guidance&&Number(currentMonth.projected_ending_cash)+thirdPartyProjected>=0&&guidance.guidance_state==='needs_funding_plan'?'covered_by_expected_income':guidance?.guidance_state}
     coverageGap={gap??0}
     thirdPartyExpectedInflow={thirdPartyProjected}
     reserveAndInvestments={guidance?Number(guidance.reserve_balance)+Number(guidance.investment_balance):0}
     benefitBalance={resources?.benefits??0}
     investmentBalance={resources?.investments??0}
     subjectLabel="Casa"
    />}

   </div>
   {!availability.guidance&&unavailable('A orientação de cobertura está indisponível agora. O Casa não vai presumir quanto está livre ou faltando.')}
   {guidance&&(guidance.guidance_state==='needs_resource_reallocation'||guidance.guidance_state==='needs_funding_plan')&&<article className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/45 p-4"><p className="text-sm font-bold text-slate-200">Quer ajustar esse mês?</p><p className="mt-1 text-xs text-slate-400">Essas ações mudam a forma de cobertura; nenhuma é aplicada automaticamente.</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><button onClick={()=>onCoverageAction?.('transfer',gap??0)} className="min-h-11 rounded-xl border border-slate-700 px-3 text-sm font-bold">Mover dinheiro de outra conta</button>{Number(guidance.reserve_balance)+Number(guidance.investment_balance)>0&&<button onClick={()=>onCoverageAction?.('reserve',gap??0)} className="min-h-11 rounded-xl border border-slate-700 px-3 text-sm font-bold">Usar reserva ou investimento</button>}<button onClick={()=>onCoverageAction?.('loan',gap??0)} className="min-h-11 rounded-xl border border-slate-700 px-3 text-sm font-bold">Ver opção de empréstimo</button></div></article>}
  </section>

  <section className="rounded-[1.6rem] border border-cyan-800/60 bg-gradient-to-br from-cyan-950/40 to-slate-900/60 p-4 shadow-lg shadow-cyan-950/15">
   <FinancialSectionHeading title="Entre vocês" icon={<Landmark className="h-5 w-5 text-cyan-300"/>}/>
   <p className="mb-3 text-xs text-slate-400">Acertos entre os moradores, separados dos valores com terceiros.</p>
   {!availability.settlements?unavailable('Não foi possível conferir os valores entre moradores agora.'):<SettlementHub perspective="household" onResolve={onSettlementAction} embedded includeMembers includeThirdParties={false}/>}
  </section>>

  {availability.attention?<FinancialPriorityCenter items={attention} onNavigate={onAttentionAction} onResolved={()=>setAttentionRefreshKey(value=>value+1)}><UpcomingFinancialEvents perspective={perspective} onOpenCard={onOpenCard} embedded refreshKey={attentionRefreshKey+refreshKey}/></FinancialPriorityCenter>:unavailable('Não foi possível conferir o centro de atenção. Nenhuma pendência foi presumida como resolvida.')}

  {!availability.resources||!resources?unavailable('Não foi possível confirmar os saldos dos recursos da Casa.'):<SafeHomeFinancialMap householdId={household?.id ?? ''} resources={householdResourceRows} cards={cards} perspective="household" memberName={memberName} onOpenCard={onOpenCard} onResourceAction={onResourceAction} onSettlementAction={onSettlementAction} refreshKey={attentionRefreshKey+refreshKey}/>}

  <section>
   <FinancialSectionHeading title="Olhando pra frente" icon={<Landmark className="h-5 w-5 text-emerald-400"/>}/>
   {!availability.projection?unavailable('Não foi possível confirmar a projeção dos próximos meses.'):projection.length===0?<p className="text-sm text-slate-400">Ainda não há projeções futuras.</p>:(()=>{return <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">{projection.slice(1,4).map((m,index)=>{const ending=Number(m.projected_ending_cash);const previous=Number(projection[index].projected_ending_cash);const delta=ending-previous;return <article key={m.financial_month} className="min-w-[68%] snap-start rounded-[1.6rem] border border-slate-800 bg-slate-900/60 p-4 sm:min-w-[42%]"><div className="flex items-center gap-2"><span className={'h-2.5 w-2.5 rounded-full '+(ending<0?'bg-rose-400':'bg-emerald-400')}/><b className="capitalize">{monthLabel(m.financial_month)}</b></div><p className="mt-4 text-xs text-slate-500">{ending<0?'Pode faltar dinheiro no fechamento':'Se nada mudar, deve fechar com'}</p><strong className={`mt-1 block text-2xl ${ending<0?'text-rose-300':'text-slate-100'}`}>{money(ending)}</strong><p className={`mt-2 text-[11px] font-semibold ${delta<0?'text-rose-300':delta>0?'text-emerald-300':'text-slate-500'}`}>{delta>0?'Melhora ':delta<0?'Cai ': 'Sem mudança '}{money(Math.abs(delta))} vs. mês anterior</p></article>})}</div>})()}
  </section>
 </div>;
}
