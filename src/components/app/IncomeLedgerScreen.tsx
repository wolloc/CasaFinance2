import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdTransactions, type HouseholdTransaction } from '../../finance/householdTransactions.js';
import { ensureRecurringIncomeHorizon } from '../../finance/recurringIncome.js';
import { IncomeCreationAction } from './IncomeCreationAction.js';
import { IncomeReceiptAction } from './IncomeReceiptAction.js';
import { RecurringIncomeAction } from './RecurringIncomeAction.js';
import { RecurringIncomeManagement } from './RecurringIncomeManagement.js';
import { IncomeFactManagement } from './IncomeFactManagement.js';
import { dateInTimeZone } from '../../finance/householdClock.js';
import { FinancialPerspectiveSelector, type FinancialPerspective } from './FinancialPerspectiveSelector.js';
import { getCategoryVisual } from '../categoryVisuals.js';

const money=(value:string|number)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const stateLabel:Record<string,string>={forecast:'Prevista',confirmed:'Confirmada',realized:'Recebida',cancelled:'Cancelada',reversed:'Estornada'};
const stateTone:Record<string,string>={forecast:'bg-amber-950/70 text-amber-300',confirmed:'bg-blue-950/70 text-blue-300',realized:'bg-emerald-950/70 text-emerald-300',cancelled:'bg-slate-800 text-slate-400',reversed:'bg-rose-950/70 text-rose-300'};
const horizonDate=(today:string)=>{const [year,month,day]=today.split('-').map(Number);const date=new Date(Date.UTC(year+1,month-1,day));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;};
const currentMonth=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date());const year=parts.find(part=>part.type==='year')?.value??'';const month=parts.find(part=>part.type==='month')?.value??'';return `${year}-${month}`;};
const monthName=(value:string)=>new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}-01T12:00:00Z`));
const shiftMonth=(value:string,delta:number)=>{const[year,month]=value.split('-').map(Number);const date=new Date(Date.UTC(year,month-1+delta,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;};
const monthEnd=(value:string)=>{const[year,month]=value.split('-').map(Number);const date=new Date(Date.UTC(year,month,0));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;};
const formatDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)).replace('.','');

export function IncomeLedgerScreen({perspective,onPerspectiveChange,initialMoneyMovementId,initialReviewMoneyMovementId,createRequestId=0}:{perspective:FinancialPerspective;onPerspectiveChange:(value:FinancialPerspective)=>void;initialMoneyMovementId?:string;initialReviewMoneyMovementId?:string;createRequestId?:number}){
 const{household,householdMembers}=useSupabaseAuth();
 const[rows,setRows]=useState<HouseholdTransaction[]>([]);
 const[beneficiaryByTransaction,setBeneficiaryByTransaction]=useState<Map<string,string>>(new Map());
 const[loading,setLoading]=useState(true);
 const[refreshKey,setRefreshKey]=useState(0);
 const[error,setError]=useState<string|null>(null);
 const[reviewTransactionId,setReviewTransactionId]=useState<string|null>(null);
 const[month,setMonth]=useState(currentMonth());
 const[customRange,setCustomRange]=useState(false);
 const[rangeStart,setRangeStart]=useState(`${currentMonth()}-01`);
 const[rangeEnd,setRangeEnd]=useState(monthEnd(currentMonth()));

 useEffect(()=>{if(!supabase||!household)return;let active=true;setLoading(true);setError(null);setReviewTransactionId(null);const load=async()=>{try{
   try{await ensureRecurringIncomeHorizon(supabase!,household.id,horizonDate(dateInTimeZone(household.timezone)));}catch(loadError){console.warn('Casa Finance: não foi possível atualizar o horizonte de rendas recorrentes antes de listar Entradas.',loadError);}
   const[transactions,movement]=await Promise.all([
     listHouseholdTransactions(supabase!,household.id),
     initialReviewMoneyMovementId?supabase!.from('money_movements').select('related_transaction_id').eq('household_id',household.id).eq('id',initialReviewMoneyMovementId).maybeSingle():Promise.resolve({data:null,error:null}),
   ]);
   if(movement.error)throw movement.error;
   const incomeRows=transactions.filter(row=>row.type==='income');
   const ids=incomeRows.map(row=>row.id);
   const movementRows=ids.length>0?await supabase!.from('money_movements').select('related_transaction_id,beneficiary_member_id').eq('household_id',household.id).eq('kind','income').in('related_transaction_id',ids):{data:[],error:null};
   if(movementRows.error)throw movementRows.error;
   const beneficiaries=new Map<string,string>();
   for(const item of movementRows.data??[]){if(item.related_transaction_id&&item.beneficiary_member_id&&!beneficiaries.has(item.related_transaction_id))beneficiaries.set(item.related_transaction_id,item.beneficiary_member_id);}
   const filtered=perspective==='household'?incomeRows:incomeRows.filter(row=>beneficiaries.get(row.id)===perspective);
   if(!active)return;
   setRows(filtered);
   setBeneficiaryByTransaction(beneficiaries);
   if(initialReviewMoneyMovementId){const target=filtered.find(row=>row.id===movement.data?.related_transaction_id);if(target)setReviewTransactionId(target.id);}
 }catch{if(active){setRows([]);setBeneficiaryByTransaction(new Map());setError('Não foi possível carregar as rendas da Casa. Nenhuma renda foi presumida como ausente ou resolvida.');}}finally{if(active)setLoading(false);}};void load();return()=>{active=false;};},[household?.id,household?.timezone,perspective,refreshKey,initialReviewMoneyMovementId]);

 const refresh=()=>setRefreshKey(value=>value+1);
 const visibleRows=useMemo(()=>rows.filter(row=>customRange?(row.transaction_date>=rangeStart&&row.transaction_date<=rangeEnd):row.transaction_date.startsWith(month)),[rows,customRange,rangeStart,rangeEnd,month]);
 const total=useMemo(()=>visibleRows.reduce((sum,row)=>sum+(row.economic_state==='cancelled'||row.economic_state==='reversed'?0:Number(row.amount)),0),[visibleRows]);
 const memberName=(memberId:string|undefined)=>householdMembers.find(member=>member.id===memberId)?.display_name??'Morador';

 return <div className="space-y-5">
  <header><h1 className="text-2xl font-black">Entradas</h1></header>
  <FinancialPerspectiveSelector value={perspective} onChange={onPerspectiveChange}/>

  {!customRange&&<div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-1.5"><button type="button" aria-label="Mês anterior" onClick={()=>setMonth(value=>shiftMonth(value,-1))} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"><ChevronLeft className="h-5 w-5"/></button><label className="relative flex-1 cursor-pointer text-center"><span className="block text-base font-black capitalize text-slate-100">{monthName(month)}</span><span className="block text-[11px] text-slate-500">Toque para escolher outro mês</span><input aria-label="Escolher mês das entradas" type="month" value={month} onChange={event=>setMonth(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"/></label><button type="button" aria-label="Mês seguinte" onClick={()=>setMonth(value=>shiftMonth(value,1))} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"><ChevronRight className="h-5 w-5"/></button></div>}

  <button type="button" onClick={()=>{const next=!customRange;setCustomRange(next);if(next){setRangeStart(`${month}-01`);setRangeEnd(monthEnd(month));}}} className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-slate-400 hover:bg-slate-900 hover:text-slate-200"><CalendarRange className="h-4 w-4"/>{customRange?'Voltar à navegação mensal':'Escolher período personalizado'}</button>
  {customRange&&<div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3"><label className="text-xs text-slate-400">De<input type="date" value={rangeStart} onChange={event=>setRangeStart(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-900 px-3 text-sm text-slate-100"/></label><label className="text-xs text-slate-400">Até<input type="date" min={rangeStart} value={rangeEnd} onChange={event=>setRangeEnd(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-900 px-3 text-sm text-slate-100"/></label></div>}

  {!loading&&!error&&<div className="flex items-end justify-between rounded-xl bg-slate-900/70 px-3 py-2"><div><p className="text-[10px] uppercase tracking-wide text-slate-500">Total listado</p><strong className="text-lg text-emerald-300">{money(total)}</strong></div><span className="text-[11px] text-slate-500">{visibleRows.length} {visibleRows.length===1?'entrada':'entradas'}</span></div>}

  {!loading&&!error&&initialReviewMoneyMovementId&&<p className={`rounded-xl border p-3 text-xs ${reviewTransactionId?'border-cyan-900 bg-cyan-950/20 text-cyan-200':'border-slate-700 bg-slate-900 text-slate-300'}`}>{reviewTransactionId?'Esta entrada futura foi sinalizada pela revisão da projeção. O Casa releu o movimento e o fato econômico atual. Revise ou corrija a previsão abaixo; nenhum recebimento foi registrado.':'A entrada sinalizada pela revisão da projeção mudou ou já foi resolvida. Nada entrou no caixa.'}</p>}
  {initialMoneyMovementId&&<IncomeReceiptAction initialMoneyMovementId={initialMoneyMovementId} onCompleted={refresh}/>}
  <IncomeCreationAction onCreated={refresh} openRequestId={createRequestId}/>

  <section className="space-y-3">{loading?<LoaderCircle className="mx-auto h-5 w-5 animate-spin"/>:error?<p role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">{error}</p>:visibleRows.length===0?<div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center"><p className="text-sm font-semibold text-slate-300">Nenhuma entrada neste período.</p><p className="mt-1 text-xs text-slate-500">Altere o mês ou o período para consultar outros lançamentos.</p></div>:visibleRows.map(row=>{const targeted=row.id===reviewTransactionId;const visual=getCategoryVisual(row.category??{name:'Sem categoria',type:'income'});const beneficiary=beneficiaryByTransaction.get(row.id);const Icon=visual.Icon;return <article key={row.id} className={`rounded-2xl border bg-slate-900 p-4 ${targeted?'border-cyan-500 ring-1 ring-cyan-500/40':'border-slate-800'}`}><div className="flex items-start gap-3"><span style={visual.color?{color:visual.color}:undefined} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300"><Icon className="h-5 w-5"/></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-bold">{row.description}</h3><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-300">{formatDate(row.transaction_date)}</span><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-300">{row.category?.name??'Sem categoria'}</span>{beneficiary&&<span className="rounded-full bg-blue-950 px-2 py-1 text-[10px] font-semibold text-blue-300">{memberName(beneficiary)}</span>}<span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${stateTone[row.economic_state]??'bg-slate-800 text-slate-300'}`}>{stateLabel[row.economic_state]??row.economic_state}</span></div></div><strong className="shrink-0 text-emerald-300">+ {money(row.amount)}</strong></div>{Number(row.realized_amount)>0&&Number(row.realized_amount)!==Number(row.amount)&&<p className="mt-2 text-xs text-emerald-300">Recebido {money(row.realized_amount)}</p>}{targeted&&<span className="mt-2 inline-block rounded-full bg-cyan-950 px-2 py-1 text-[10px] font-bold text-cyan-300">Revisar projeção</span>}<details className="mt-3 border-t border-slate-800 pt-2"><summary className="cursor-pointer list-none text-xs font-semibold text-slate-500 hover:text-slate-300">Detalhes e ações</summary><div className="mt-2"><IncomeFactManagement transaction={row} onChanged={refresh}/></div></details></div></div></article>})}</section>

  <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
   <summary className="cursor-pointer list-none font-semibold text-slate-200">Recorrências e outras ações<span className="mt-1 block text-xs font-normal text-slate-500">Use quando quiser configurar uma renda que se repete, gerenciar uma série ou confirmar manualmente um recebimento.</span></summary>
   <div className="mt-4 space-y-4 border-t border-slate-800 pt-4"><RecurringIncomeAction onCreated={refresh}/><RecurringIncomeManagement refreshKey={refreshKey} onChanged={refresh}/>{!initialMoneyMovementId&&<IncomeReceiptAction initialMoneyMovementId={undefined} onCompleted={refresh}/>}</div>
  </details>
 </div>;
}
