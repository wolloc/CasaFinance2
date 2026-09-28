import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CreditCard, Landmark } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { FinancialPerspectiveSelector, type FinancialPerspective } from './FinancialPerspectiveSelector.js';
import { supabase } from '../../lib/supabase.js';
import { listEconomicMonthExpenses, listEconomicPeriodExpenses, listFinancialMonthExpenses, listFinancialPeriodExpenses, type EconomicMonthExpense, type FinancialMonthExpense, type ResponsibilityVisual } from '../../finance/expenseMonthViews.js';
import { getCategoryVisual } from '../categoryVisuals.js';
import { FinancialListSummaryCard } from './FinancialListSummaryCard.js';
import { FinancialPageHeader } from './FinancialPageHeader.js';
import { FinancialListState } from './FinancialListState.js';
import { FinancialPeriodNavigator } from './FinancialPeriodNavigator.js';
import { FinancialListSearch } from './FinancialListSearch.js';
import { FinancialCategoryBreakdown } from './FinancialCategoryBreakdown.js';

const money=(value:number|string|null|undefined)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value??0));
const currentMonth=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date());const year=parts.find(part=>part.type==='year')?.value??'';const month=parts.find(part=>part.type==='month')?.value??'';return `${year}-${month}`;};
const monthName=(value:string)=>new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}-01T12:00:00Z`));
const shiftMonth=(value:string,delta:number)=>{const [year,month]=value.split('-').map(Number);const date=new Date(Date.UTC(year,month-1+delta,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;};
const monthEnd=(value:string)=>{const[year,month]=value.split('-').map(Number);const date=new Date(Date.UTC(year,month,0));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;};
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value);
const compactDate=(value:string)=>validDate(value)?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)):'—';
const formatDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`)).replace('.','');
const sourceLabel=(row:FinancialMonthExpense)=>row.source_type==='card_installment'?'Parcela do cartão':row.source_type==='recurring_occurrence'?'Gasto recorrente':'Gasto do mês';
const instrumentLabel=(kind:string|null)=>kind==='card'?'Cartão':kind==='account'?'Conta':null;
const percentage=(value:number,total:number)=>total>0?Math.max(0,(value/total)*100):0;
const barWidth=(value:number,total:number)=>Math.min(100,percentage(value,total));

type ViewMode='financial'|'economic';
type CategorySummary={name:string;amount:number};

export function ExpenseMonthBrowser({perspective,onPerspectiveChange,refreshKey=0,onOpenTransaction}:{perspective:FinancialPerspective;onPerspectiveChange:(value:FinancialPerspective)=>void;refreshKey?:number;onOpenTransaction?:(transactionId:string,recurringRuleId?:string|null)=>void}){
  const{household,householdMembers}=useSupabaseAuth();
  const[month,setMonth]=useState(currentMonth());
  const[mode,setMode]=useState<ViewMode>('financial');
  const[financialRows,setFinancialRows]=useState<FinancialMonthExpense[]>([]);
  const[economicRows,setEconomicRows]=useState<EconomicMonthExpense[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(false);
  const[refreshVersion,setRefreshVersion]=useState(0);
  const[query,setQuery]=useState('');
  const[customRange,setCustomRange]=useState(false);
  const[rangeStart,setRangeStart]=useState(()=>`${currentMonth()}-01`);
  const[rangeEnd,setRangeEnd]=useState(()=>monthEnd(currentMonth()));
  const[periodPickerOpen,setPeriodPickerOpen]=useState(false);
  const customRangeReady=validDate(rangeStart)&&validDate(rangeEnd)&&rangeStart<=rangeEnd;

  useEffect(()=>{let cancelled=false;if(!supabase||!household){setLoading(false);return()=>{cancelled=true;};}if(customRange&&!customRangeReady){setFinancialRows([]);setEconomicRows([]);setError(false);setLoading(false);return()=>{cancelled=true;};}setLoading(true);setError(false);setFinancialRows([]);setEconomicRows([]);const memberId=perspective==='household'?undefined:perspective;const request=customRange?(mode==='financial'?listFinancialPeriodExpenses(supabase,household.id,rangeStart,rangeEnd,memberId):listEconomicPeriodExpenses(supabase,household.id,rangeStart,rangeEnd,memberId)):(mode==='financial'?listFinancialMonthExpenses(supabase,household.id,month,memberId):listEconomicMonthExpenses(supabase,household.id,month,memberId));request.then(rows=>{if(cancelled)return;if(mode==='financial')setFinancialRows(rows as FinancialMonthExpense[]);else setEconomicRows(rows as EconomicMonthExpense[]);}).catch(()=>{if(cancelled)return;setFinancialRows([]);setEconomicRows([]);setError(true);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[household?.id,month,customRange,customRangeReady,rangeStart,rangeEnd,mode,perspective,refreshKey,refreshVersion]);

  const financialSummary=useMemo(()=>{const byCategory=new Map<string,number>();let total=0;let realized=0;let remaining=0;for(const row of financialRows){const amount=Number(row.effective_amount);total+=amount;realized+=Number(row.realized_amount);remaining+=Number(row.remaining_amount);const name=row.category?.name?.trim()||'Sem categoria';byCategory.set(name,(byCategory.get(name)??0)+amount);}const categories=[...byCategory.entries()].map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);return{total,realized,remaining,categories};},[financialRows]);
  const economicSummary=useMemo(()=>{const byCategory=new Map<string,number>();let total=0;for(const row of economicRows){const amount=Number(row.amount);total+=amount;const name=row.category?.name?.trim()||'Sem categoria';byCategory.set(name,(byCategory.get(name)??0)+amount);}const categories=[...byCategory.entries()].map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount);return{total,count:economicRows.length,categories};},[economicRows]);

  const responsibilityLabel=(responsibility:ResponsibilityVisual)=>{
    if(responsibility.has_third_party&&responsibility.member_ids.length>0)return'Com outra pessoa';
    if(responsibility.has_third_party)return'Outra pessoa';
    if(responsibility.member_ids.length>1)return'Dividido';
    if(responsibility.member_ids.length===1)return householdMembers.find(member=>member.id===responsibility.member_ids[0])?.display_name??'Morador';
    return null;
  };

  const normalizedQuery=query.trim().toLocaleLowerCase('pt-BR');
  const filteredFinancialRows=useMemo(()=>normalizedQuery?financialRows.filter(row=>[row.description,sourceLabel(row),row.economic_date,row.instrument_label??'',row.category?.name??'',responsibilityLabel(row.responsibility)??''].some(value=>value.toLocaleLowerCase('pt-BR').includes(normalizedQuery))):financialRows,[financialRows,normalizedQuery,householdMembers]);
  const filteredEconomicRows=useMemo(()=>normalizedQuery?economicRows.filter(row=>[row.description,row.category?.name??'Sem categoria',row.transaction_date,responsibilityLabel(row.responsibility)??''].some(value=>value.toLocaleLowerCase('pt-BR').includes(normalizedQuery))):economicRows,[economicRows,normalizedQuery,householdMembers]);
  const visibleCount=mode==='financial'?filteredFinancialRows.length:filteredEconomicRows.length;
  const totalCount=mode==='financial'?financialRows.length:economicRows.length;
  const selectedMember=perspective==='household'?null:householdMembers.find(member=>member.id===perspective)??null;
  const periodLabel=customRange?(customRangeReady?`${compactDate(rangeStart)} – ${compactDate(rangeEnd)}`:'Escolha as datas'):monthName(month);
  const periodNoun=customRange?'período':'mês';

  return <section className="text-slate-100">
    <div className="space-y-3"><FinancialPageHeader title="Gastos"/><FinancialPeriodNavigator
      label={periodLabel}
      open={periodPickerOpen}
      onToggle={()=>setPeriodPickerOpen(value=>!value)}
      onClose={()=>setPeriodPickerOpen(false)}
      onPrevious={()=>{setCustomRange(false);setMonth(value=>shiftMonth(value,-1));setQuery('');}}
      onNext={()=>{setCustomRange(false);setMonth(value=>shiftMonth(value,1));setQuery('');}}
      customRange={customRange}
      allowCustomRange
      monthValue={month}
      monthAriaLabel="Escolher mês dos gastos"
      onMonthChange={value=>{setMonth(value);setQuery('');}}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      rangeReady={customRangeReady}
      onRangeStartChange={value=>{setRangeStart(value);if(value>rangeEnd)setRangeEnd(value);setQuery('');}}
      onRangeEndChange={value=>{setRangeEnd(value);setQuery('');}}
      onUseMonth={()=>setCustomRange(false)}
      onUseCustomRange={()=>{if(!customRange){setRangeStart(`${month}-01`);setRangeEnd(monthEnd(month));}setCustomRange(true);}}
      pickerTitle="Escolher período"
      pickerDescription="Mês inteiro ou datas específicas."
     />

    <div className="mt-4"><FinancialPerspectiveSelector value={perspective} onChange={onPerspectiveChange}/></div>

    <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1"><button type="button" onClick={()=>{setMode('economic');setQuery('')}} aria-pressed={mode==='economic'} className={`min-h-12 rounded-lg px-2 text-xs font-semibold ${mode==='economic'?'bg-blue-700 text-white':'text-slate-400'}`}>Gastos realizados</button><button type="button" onClick={()=>{setMode('financial');setQuery('')}} aria-pressed={mode==='financial'} className={`min-h-12 rounded-lg px-2 text-xs font-semibold ${mode==='financial'?'bg-blue-700 text-white':'text-slate-400'}`}>{customRange?'Compromissos do período':'Compromissos do mês'}</button></div>

    {!loading&&!error&&(mode==='financial'?financialRows.length>0:economicRows.length>0)&&(mode==='financial'?<FinancialMonthSummary total={financialSummary.total} realized={financialSummary.realized} remaining={financialSummary.remaining} categories={financialSummary.categories}/>:<EconomicMonthSummary total={economicSummary.total} count={economicSummary.count} categories={economicSummary.categories}/>)}


    {!loading&&!error&&totalCount>0&&<div className="mt-4"><FinancialListSearch value={query} onChange={setQuery} ariaLabel="Buscar gastos deste período" placeholder={mode==='financial'?'Buscar compromisso...':'Buscar compra, categoria ou pessoa...'} resultText={`${visibleCount} de ${totalCount} ${mode==='financial'?'compromissos':'gastos'} encontrados.`}/></div>}

    {loading?<div className="mt-4"><FinancialListState kind="loading"/></div>:error?<div className="mt-4"><FinancialListState kind="error" title="Não foi possível conferir este período." description="Nenhum valor antigo foi mantido na tela." onRetry={()=>setRefreshVersion(value=>value+1)}/></div>:mode==='financial'?financialRows.length===0?<div className="mt-4"><FinancialListState kind="empty" title={`Nenhum compromisso neste ${periodNoun}.`}/></div>:<div className="mt-4 space-y-2">{filteredFinancialRows.length===0?<FinancialListState kind="empty" title="Nenhum compromisso corresponde à busca."/>:filteredFinancialRows.map(row=>{const pending=Number(row.remaining_amount)>0;const tag=responsibilityLabel(row.responsibility);const{Icon,color}=getCategoryVisual(row.category??{name:'Sem categoria',type:'expense'});const original=Number(row.original_amount??row.household_effective_amount);const perspectiveAmount=Number(row.effective_amount);return <article key={row.commitment_key} role={row.source_transaction_id?'button':undefined} tabIndex={row.source_transaction_id?0:undefined} onClick={()=>row.source_transaction_id&&onOpenTransaction?.(row.source_transaction_id,row.recurring_rule_id)} onKeyDown={event=>{if(row.source_transaction_id&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onOpenTransaction?.(row.source_transaction_id,row.recurring_rule_id)}}} className={`rounded-2xl border bg-slate-900 p-4 ${pending?'border-orange-500/80':'border-slate-800'} ${row.source_transaction_id?'cursor-pointer transition-colors hover:border-slate-600':''}`}><div className="flex items-start gap-3"><span style={color?{color}:undefined} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-300"><Icon className="h-5 w-5"/></span><div className="min-w-0 flex-1"><div><div className="min-w-0"><p className="text-[11px] font-semibold text-slate-500"><CalendarDays className="mr-1 inline h-3 w-3"/>{formatDate(row.economic_date)}</p><h3 className="mt-0.5 truncate text-sm font-bold">{row.description}</h3><div className="mt-2 flex flex-wrap gap-1.5">{row.category?.name&&<span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{row.category.name}</span>}{tag&&<span className="rounded-full bg-blue-950 px-2 py-1 text-[11px] font-semibold text-blue-300">{tag}</span>}{instrumentLabel(row.instrument_kind)&&<span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{row.instrument_kind==='card'?<CreditCard className="mr-1 inline h-3 w-3"/>:<Landmark className="mr-1 inline h-3 w-3"/>}{row.instrument_label??instrumentLabel(row.instrument_kind)}</span>}</div><p className="mt-2 text-[11px] text-slate-500">{sourceLabel(row)}</p></div><div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-800/70 pt-2"><span className="text-[11px] text-slate-500">{row.economic_state==='forecast'?'Previsto':'Valor'}</span><strong className={`text-base font-black ${row.economic_state==='forecast'?'text-amber-300':'text-rose-200'}`}>{money(perspectiveAmount)}</strong>{selectedMember&&Math.abs(original-perspectiveAmount)>0.005&&<p className="mt-1 text-[11px] text-slate-500">valor original {money(original)}</p>}</div></div>{pending&&<p className="mt-2 text-[11px] text-amber-300">Ainda compromete {money(row.remaining_amount)}</p>}{row.source_type==='card_installment'&&<p className="mt-1 text-[11px] text-violet-300">Item da fatura; o pagamento não vira outro gasto.</p>}</div></div></article>})}</div>:economicRows.length===0?<div className="mt-4"><FinancialListState kind="empty" title={`Nenhum gasto realizado neste ${periodNoun}.`}/></div>:<div className="mt-4 space-y-2">{filteredEconomicRows.length===0?<FinancialListState kind="empty" title="Nenhum gasto corresponde à busca."/>:filteredEconomicRows.map(row=>{const tag=responsibilityLabel(row.responsibility);const{Icon,color}=getCategoryVisual(row.category??{name:'Sem categoria',type:'expense'});const original=Number(row.original_amount);const perspectiveAmount=Number(row.amount);return <article key={row.id} role="button" tabIndex={0} onClick={()=>onOpenTransaction?.(row.id,row.recurring_rule_id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onOpenTransaction?.(row.id,row.recurring_rule_id)}}} className="cursor-pointer rounded-2xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-slate-600"><div className="flex items-start gap-3"><span style={color?{color}:undefined} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-300"><Icon className="h-5 w-5"/></span><div className="min-w-0 flex-1"><div><div className="min-w-0"><p className="text-[11px] font-semibold text-slate-500">{formatDate(row.transaction_date)}</p><h3 className="mt-0.5 truncate text-sm font-bold">{row.description}</h3><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{row.category?.name??'Sem categoria'}</span>{tag&&<span className="rounded-full bg-blue-950 px-2 py-1 text-[11px] font-semibold text-blue-300">{tag}</span>}{instrumentLabel(row.instrument_kind)&&<span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{row.instrument_kind==='card'?<CreditCard className="mr-1 inline h-3 w-3"/>:<Landmark className="mr-1 inline h-3 w-3"/>}{row.instrument_label??instrumentLabel(row.instrument_kind)}</span>}</div></div><div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-800/70 pt-2"><span className="text-[11px] text-slate-500">Valor</span><strong className="text-base font-black text-rose-200">{money(perspectiveAmount)}</strong>{selectedMember&&Math.abs(original-perspectiveAmount)>0.005&&<p className="mt-1 text-[11px] text-slate-500">valor original {money(original)}</p>}{!selectedMember&&Math.abs(original-Number(row.household_amount))>0.005&&<p className="mt-1 text-[11px] text-slate-500">valor original {money(original)}</p>}</div></div>{selectedMember&&Math.abs(original-perspectiveAmount)>0.005&&<p className="mt-2 text-[11px] text-blue-300">Sua parte · valor original {money(original)}</p>}</div></div></article>})}</div>}
    </div>
  </section>;
}

function FinancialMonthSummary({total,realized,remaining,categories}:{total:number;realized:number;remaining:number;categories:CategorySummary[]}){
  return <FinancialListSummaryCard tone="expense" total={money(total)} meta={<><p><span className="text-emerald-300">{money(realized)}</span> realizado</p><p><span className="text-amber-300">{money(remaining)}</span> comprometido</p></>}><FinancialCategoryBreakdown categories={categories} total={total} tone="commitment" showBars/></FinancialListSummaryCard>;
}
function EconomicMonthSummary({total,count,categories}:{total:number;count:number;categories:CategorySummary[]}){
  return <FinancialListSummaryCard tone="expense" total={money(total)} meta={<span>{count} {count===1?'compra':'compras'}</span>}><FinancialCategoryBreakdown categories={categories} total={total} tone="expense" showBars footer="Leitura dos gastos realizados; não é meta ou orçamento."/></FinancialListSummaryCard>;
}
