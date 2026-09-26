import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, LoaderCircle, Repeat2, X } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdTransactions, type HouseholdTransaction } from '../../finance/householdTransactions.js';
import { ensureRecurringIncomeHorizon } from '../../finance/recurringIncome.js';
import { IncomeCreationAction } from './IncomeCreationAction.js';
import { IncomeReceiptAction } from './IncomeReceiptAction.js';
import { RecurringIncomeManagement } from './RecurringIncomeManagement.js';
import { IncomeFactManagement } from './IncomeFactManagement.js';
import { dateInTimeZone } from '../../finance/householdClock.js';
import { FinancialPerspectiveSelector, type FinancialPerspective } from './FinancialPerspectiveSelector.js';
import { getCategoryVisual } from '../categoryVisuals.js';
import { FinancialListSummaryCard } from './FinancialListSummaryCard.js';

const money=(value:string|number)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const stateLabel:Record<string,string>={forecast:'Prevista',confirmed:'Confirmada',realized:'Recebida',cancelled:'Cancelada',reversed:'Estornada'};
const stateTone:Record<string,string>={forecast:'bg-amber-950/70 text-amber-300',confirmed:'bg-blue-950/70 text-blue-300',realized:'bg-emerald-950/70 text-emerald-300',cancelled:'bg-slate-800 text-slate-400',reversed:'bg-rose-950/70 text-rose-300'};
const horizonDate=(today:string)=>{const [year,month,day]=today.split('-').map(Number);const date=new Date(Date.UTC(year+1,month-1,day));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;};
const monthInTimeZone=(timeZone:string)=>dateInTimeZone(timeZone).slice(0,7);
const monthName=(value:string)=>new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}-01T12:00:00Z`));
const shiftMonth=(value:string,delta:number)=>{const[year,month]=value.split('-').map(Number);const date=new Date(Date.UTC(year,month-1+delta,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;};
const monthEnd=(value:string)=>{const[year,month]=value.split('-').map(Number);const date=new Date(Date.UTC(year,month,0));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;};
const formatDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)).replace('.','');
const compactDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));

export function IncomeLedgerScreen({perspective,onPerspectiveChange,initialMoneyMovementId,initialReviewMoneyMovementId,createRequestId=0}:{perspective:FinancialPerspective;onPerspectiveChange:(value:FinancialPerspective)=>void;initialMoneyMovementId?:string;initialReviewMoneyMovementId?:string;createRequestId?:number}){
 const{household,householdMembers}=useSupabaseAuth();
 const[rows,setRows]=useState<HouseholdTransaction[]>([]);
 const[beneficiariesByTransaction,setBeneficiariesByTransaction]=useState<Map<string,string[]>>(new Map());
 const[recurringRuleByTransaction,setRecurringRuleByTransaction]=useState<Map<string,string>>(new Map());
 const[activeRecurringRuleId,setActiveRecurringRuleId]=useState<string|null>(null);
 const[detailTransaction,setDetailTransaction]=useState<HouseholdTransaction|null>(null);
 const[loading,setLoading]=useState(true);
 const[refreshKey,setRefreshKey]=useState(0);
 const[error,setError]=useState<string|null>(null);
 const[reviewTransactionId,setReviewTransactionId]=useState<string|null>(null);
 const initialHouseholdMonth=monthInTimeZone(household?.timezone??'America/Sao_Paulo');
 const[month,setMonth]=useState(initialHouseholdMonth);
 const[customRange,setCustomRange]=useState(false);
 const[rangeStart,setRangeStart]=useState(`${initialHouseholdMonth}-01`);
 const[rangeEnd,setRangeEnd]=useState(monthEnd(initialHouseholdMonth));
 const[periodPickerOpen,setPeriodPickerOpen]=useState(false);

 useEffect(()=>{if(!household)return;const current=monthInTimeZone(household.timezone);setMonth(current);setRangeStart(`${current}-01`);setRangeEnd(monthEnd(current));setCustomRange(false);setPeriodPickerOpen(false);},[household?.id,household?.timezone]);

 useEffect(()=>{if(!supabase||!household)return;let active=true;setLoading(true);setError(null);setReviewTransactionId(null);const load=async()=>{try{
   try{await ensureRecurringIncomeHorizon(supabase!,household.id,horizonDate(dateInTimeZone(household.timezone)));}catch(loadError){console.warn('Casa Finance: não foi possível atualizar o horizonte de rendas recorrentes antes de listar Entradas.',loadError);}
   const[transactions,movement]=await Promise.all([
     listHouseholdTransactions(supabase!,household.id),
     initialReviewMoneyMovementId?supabase!.from('money_movements').select('related_transaction_id').eq('household_id',household.id).eq('id',initialReviewMoneyMovementId).maybeSingle():Promise.resolve({data:null,error:null}),
   ]);
   if(movement.error)throw movement.error;
   const incomeRows=transactions.filter(row=>row.type==='income');
   const ids=incomeRows.map(row=>row.id);
   const[movementRows,recurringRows]=ids.length>0?await Promise.all([
     supabase!.from('money_movements').select('related_transaction_id,beneficiary_member_id').eq('household_id',household.id).eq('kind','income').in('related_transaction_id',ids),
     supabase!.from('recurring_occurrences').select('transaction_id,recurring_rule_id').eq('household_id',household.id).in('transaction_id',ids),
   ]):[{data:[],error:null},{data:[],error:null}];
   if(movementRows.error)throw movementRows.error;
   if(recurringRows.error)throw recurringRows.error;
   const beneficiaries=new Map<string,string[]>();
   for(const item of movementRows.data??[]){if(!item.related_transaction_id||!item.beneficiary_member_id)continue;const current=beneficiaries.get(item.related_transaction_id)??[];if(!current.includes(item.beneficiary_member_id))beneficiaries.set(item.related_transaction_id,[...current,item.beneficiary_member_id]);}
   const recurringRules=new Map<string,string>();
   for(const item of recurringRows.data??[]){if(item.transaction_id&&item.recurring_rule_id)recurringRules.set(String(item.transaction_id),String(item.recurring_rule_id));}
   const filtered=perspective==='household'?incomeRows:incomeRows.filter(row=>beneficiaries.get(row.id)?.includes(perspective));
   if(!active)return;
   setRows(filtered);
   setBeneficiariesByTransaction(beneficiaries);
   setRecurringRuleByTransaction(recurringRules);
   if(initialReviewMoneyMovementId){const target=filtered.find(row=>row.id===movement.data?.related_transaction_id);if(target){setReviewTransactionId(target.id);setCustomRange(false);setMonth(target.transaction_date.slice(0,7));}}
 }catch{if(active){setRows([]);setBeneficiariesByTransaction(new Map());setRecurringRuleByTransaction(new Map());setError('Não foi possível carregar as rendas da Casa. Nenhuma renda foi presumida como ausente ou resolvida.');}}finally{if(active)setLoading(false);}};void load();return()=>{active=false;};},[household?.id,household?.timezone,perspective,refreshKey,initialReviewMoneyMovementId]);

 const refresh=()=>setRefreshKey(value=>value+1);
 const visibleRows=useMemo(()=>rows.filter(row=>customRange?(row.transaction_date>=rangeStart&&row.transaction_date<=rangeEnd):row.transaction_date.startsWith(month)),[rows,customRange,rangeStart,rangeEnd,month]);
 const total=useMemo(()=>visibleRows.reduce((sum,row)=>sum+(row.economic_state==='cancelled'||row.economic_state==='reversed'?0:Number(row.amount)),0),[visibleRows]);
 const categorySummary=useMemo(()=>{const byCategory=new Map<string,number>();for(const row of visibleRows){if(row.economic_state==='cancelled'||row.economic_state==='reversed')continue;const name=row.category?.name?.trim()||'Sem categoria';byCategory.set(name,(byCategory.get(name)??0)+Number(row.amount));}return[...byCategory.entries()].map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);},[visibleRows]);
 const beneficiaryLabel=(memberIds:string[]|undefined)=>{if(!memberIds?.length)return null;const names=householdMembers.filter(member=>memberIds.includes(member.id)).map(member=>member.display_name);return names.length>0?names.join(' + '):'Morador';};
 const periodLabel=customRange?`${compactDate(rangeStart)} – ${compactDate(rangeEnd)}`:monthName(month);

 return <div className="space-y-5">
  <header><h1 className="text-2xl font-black">Entradas</h1></header>

  <div className="relative">
   <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-1.5"><button type="button" aria-label="Mês anterior" onClick={()=>{setCustomRange(false);setMonth(value=>shiftMonth(value,-1));}} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"><ChevronLeft className="h-5 w-5"/></button><button type="button" onClick={()=>setPeriodPickerOpen(value=>!value)} aria-expanded={periodPickerOpen} className="flex min-h-11 flex-1 flex-col items-center justify-center rounded-xl text-center hover:bg-slate-900"><span className="block text-base font-black capitalize text-slate-100">{periodLabel}</span><span className="block text-[11px] text-slate-500">Toque para escolher o período</span></button><button type="button" aria-label="Mês seguinte" onClick={()=>{setCustomRange(false);setMonth(value=>shiftMonth(value,1));}} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800"><ChevronRight className="h-5 w-5"/></button></div>

   {periodPickerOpen&&<div className="absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"><div className="flex items-center justify-between"><div><strong className="text-sm">Escolher período</strong><p className="text-xs text-slate-500">Mês inteiro ou datas específicas.</p></div><button type="button" aria-label="Fechar escolha de período" onClick={()=>setPeriodPickerOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800"><X className="h-4 w-4"/></button></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setCustomRange(false)} className={`min-h-10 rounded-xl border text-xs font-bold ${!customRange?'border-blue-500 bg-blue-500/15 text-blue-200':'border-slate-800 text-slate-400'}`}>Mês inteiro</button><button type="button" onClick={()=>{if(!customRange){setRangeStart(`${month}-01`);setRangeEnd(monthEnd(month));}setCustomRange(true);}} className={`min-h-10 rounded-xl border text-xs font-bold ${customRange?'border-blue-500 bg-blue-500/15 text-blue-200':'border-slate-800 text-slate-400'}`}><CalendarRange className="mr-1 inline h-4 w-4"/>Personalizado</button></div>{!customRange?<label className="mt-3 block text-xs font-semibold text-slate-400">Mês<input aria-label="Escolher mês das entradas" type="month" value={month} onChange={event=>setMonth(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-sm text-slate-100"/></label>:<div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs text-slate-400">De<input type="date" value={rangeStart} onChange={event=>setRangeStart(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-sm text-slate-100"/></label><label className="text-xs text-slate-400">Até<input type="date" min={rangeStart} value={rangeEnd} onChange={event=>setRangeEnd(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3 text-sm text-slate-100"/></label></div>}<button type="button" onClick={()=>setPeriodPickerOpen(false)} className="mt-3 min-h-11 w-full rounded-xl bg-blue-600 text-sm font-bold">Aplicar</button></div>}
  </div>

  <FinancialPerspectiveSelector value={perspective} onChange={onPerspectiveChange}/>

  {!loading&&!error&&<IncomeSummary total={total} count={visibleRows.length} categories={categorySummary}/>} 

  {!loading&&!error&&initialReviewMoneyMovementId&&<p className={`rounded-xl border p-3 text-xs ${reviewTransactionId?'border-cyan-900 bg-cyan-950/20 text-cyan-200':'border-slate-700 bg-slate-900 text-slate-300'}`}>{reviewTransactionId?'Esta entrada futura foi sinalizada pela revisão da projeção. O Casa releu o movimento e o fato econômico atual. Revise ou corrija a previsão abaixo; nenhum recebimento foi registrado.':'A entrada sinalizada pela revisão da projeção mudou ou já foi resolvida. Nada entrou no caixa.'}</p>}
  {initialMoneyMovementId&&<IncomeReceiptAction initialMoneyMovementId={initialMoneyMovementId} onCompleted={refresh}/>}
  <IncomeCreationAction onCreated={refresh} openRequestId={createRequestId}/>

  <section className="space-y-3">{loading?<LoaderCircle className="mx-auto h-5 w-5 animate-spin"/>:error?<p role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/30 p-4 text-sm text-rose-200">{error}</p>:visibleRows.length===0?<div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center"><p className="text-sm font-semibold text-slate-300">Nenhuma entrada neste período.</p><p className="mt-1 text-xs text-slate-500">Altere o mês ou o período para consultar outros lançamentos.</p></div>:visibleRows.map(row=>{const targeted=row.id===reviewTransactionId;const visual=getCategoryVisual(row.category??{name:'Sem categoria',type:'income'});const beneficiary=beneficiaryLabel(beneficiariesByTransaction.get(row.id));const recurringRuleId=recurringRuleByTransaction.get(row.id);const Icon=visual.Icon;return <article key={row.id} role="button" tabIndex={0} onClick={()=>setDetailTransaction(row)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setDetailTransaction(row)}}} className={`cursor-pointer rounded-2xl border bg-slate-900 p-4 transition-colors hover:border-slate-600 ${targeted?'border-cyan-500 ring-1 ring-cyan-500/40':'border-slate-800'}`}><div className="flex items-start gap-3"><span style={visual.color?{color:visual.color}:undefined} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300"><Icon className="h-5 w-5"/></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-bold">{row.description}</h3><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-300">{formatDate(row.transaction_date)}</span><span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] text-slate-300">{row.category?.name??'Sem categoria'}</span>{beneficiary&&<span className="rounded-full bg-blue-950 px-2 py-1 text-[10px] font-semibold text-blue-300">{beneficiary}</span>}{recurringRuleId&&<span className="rounded-full bg-violet-950 px-2 py-1 text-[10px] font-semibold text-violet-300">Recorrente</span>}<span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${stateTone[row.economic_state]??'bg-slate-800 text-slate-300'}`}>{stateLabel[row.economic_state]??row.economic_state}</span></div></div><strong className="shrink-0 text-emerald-300">+ {money(row.amount)}</strong></div>{Number(row.realized_amount)>0&&Number(row.realized_amount)!==Number(row.amount)&&<p className="mt-2 text-xs text-emerald-300">Recebido {money(row.realized_amount)}</p>}{targeted&&<span className="mt-2 inline-block rounded-full bg-cyan-950 px-2 py-1 text-[10px] font-bold text-cyan-300">Revisar projeção</span>}</div></div></article>})}</section>

  {!initialMoneyMovementId&&<details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
   <summary className="cursor-pointer list-none font-semibold text-slate-200">Outras ações<span className="mt-1 block text-xs font-normal text-slate-500">Confirme manualmente um recebimento existente quando precisar.</span></summary>
   <div className="mt-4 border-t border-slate-800 pt-4"><IncomeReceiptAction initialMoneyMovementId={undefined} onCompleted={refresh}/></div>
  </details>}

  {detailTransaction&&<div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center"><section role="dialog" aria-modal="true" aria-label="Detalhe da entrada" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-slate-900 p-4 shadow-2xl"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Detalhe da entrada</p><h2 className="mt-1 text-lg font-black">{detailTransaction.description}</h2><p className="mt-1 text-sm text-slate-400">+ {money(detailTransaction.amount)} · {formatDate(detailTransaction.transaction_date)}</p></div><button type="button" aria-label="Fechar detalhe da entrada" onClick={()=>setDetailTransaction(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300"><X className="h-4 w-4"/></button></div><IncomeFactManagement transaction={detailTransaction} onChanged={()=>{refresh();setDetailTransaction(null)}}/>{recurringRuleByTransaction.get(detailTransaction.id)&&<button type="button" onClick={()=>{setActiveRecurringRuleId(recurringRuleByTransaction.get(detailTransaction.id)??null);setDetailTransaction(null)}} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-900 px-3 text-sm font-bold text-violet-300"><Repeat2 className="h-4 w-4"/>Gerenciar esta recorrência</button>}</section></div>}

  {activeRecurringRuleId&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center"><section role="dialog" aria-modal="true" aria-label="Gerenciar recorrência da entrada" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] bg-slate-950 p-3 shadow-2xl"><div className="mb-2 flex justify-end"><button type="button" aria-label="Fechar gerenciamento da recorrência" onClick={()=>setActiveRecurringRuleId(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300"><X className="h-4 w-4"/></button></div><RecurringIncomeManagement refreshKey={refreshKey} focusRuleId={activeRecurringRuleId} onChanged={()=>{refresh();setActiveRecurringRuleId(null);}}/></section></div>}
 </div>;
}

function IncomeSummary({total,count,categories}:{total:number;count:number;categories:Array<{name:string;amount:number}>}){
 const percentage=(value:number)=>total>0?Math.round((value/total)*100):0;
 return <FinancialListSummaryCard tone="income" total={money(total)} meta={<span>{count} {count===1?'entrada':'entradas'}</span>}>{categories.length>0&&<details className="mt-2 border-t border-slate-800 pt-2"><summary className="flex min-h-9 cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-300"><span>Ver categorias</span><span className="text-[10px] font-normal text-slate-500">{categories.length}</span></summary><div className="mt-3 space-y-2">{categories.map(category=><div key={category.name} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-slate-300">{category.name}</span><strong className="shrink-0 text-emerald-300">{money(category.amount)} · {percentage(category.amount)}%</strong></div>)}</div></details>}</FinancialListSummaryCard>;
}
