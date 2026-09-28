import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, CalendarClock, CreditCard, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { dateInTimeZone } from '../../finance/householdClock.js';
import { listUpcomingFinancialEvents, type UpcomingFinancialEvent } from '../../finance/upcomingFinancialEvents.js';
import type { FinancialPerspective } from './FinancialPerspectiveSelector.js';
import { FinancialSectionHeading } from './FinancialSectionHeading.js';

const money=(value:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
const shortDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const addDays=(date:string,days:number)=>{const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);};

export function UpcomingFinancialEvents({perspective,onOpenCard,embedded=false,refreshKey=0}:{perspective:FinancialPerspective;onOpenCard?:(cardId:string)=>void;embedded?:boolean;refreshKey?:number}){
 const{household,householdMembers}=useSupabaseAuth();
 const[items,setItems]=useState<UpcomingFinancialEvent[]>([]);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState(false);

 useEffect(()=>{let cancelled=false;if(!supabase||!household){setLoading(false);return()=>{cancelled=true;};}setLoading(true);setError(false);setItems([]);const today=dateInTimeZone(household.timezone);listUpcomingFinancialEvents(supabase,household.id,today,7,perspective==='household'?undefined:perspective).then(rows=>{if(!cancelled)setItems(rows);}).catch(()=>{if(!cancelled){setItems([]);setError(true);}}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[household?.id,household?.timezone,perspective,refreshKey]);

 const today=household?dateInTimeZone(household.timezone):'';
 const tomorrow=today?addDays(today,1):'';
 const dateLabel=(date:string)=>date===today?'Hoje':date===tomorrow?'Amanhã':shortDate(date);
 const memberName=(id:string|null)=>householdMembers.find(member=>member.id===id)?.display_name??'Membro';
 if(!loading&&!error&&items.length===0)return embedded?null:<div className="flex items-center gap-2 rounded-2xl bg-slate-900/35 px-3 py-2 text-xs text-slate-500"><CalendarClock className="h-4 w-4 text-cyan-500"/>Nada previsto nos próximos 7 dias.</div>;
 const primaryItems=items.slice(0,5);
 const extraItems=items.slice(5);
 const renderItem=(item:UpcomingFinancialEvent,index:number,withBorder=true)=>{const Icon=item.kind==='invoice'?CreditCard:item.kind==='settlement'?ArrowLeftRight:item.direction==='in'?ArrowUpRight:ArrowDownRight;const tone=item.direction==='in'?'text-emerald-300':item.direction==='out'?'text-rose-300':'text-cyan-300';const settlementDetail=item.kind==='settlement'&&perspective==='household'?`${memberName(item.payer_member_id)} → ${memberName(item.receiver_member_id)}`:null;return <article key={item.key} className={`flex items-center gap-3 px-3 py-3 ${withBorder&&index>0?'border-t border-slate-800':''}`}><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 ${tone}`}><Icon className="h-4 w-4"/></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-xs font-semibold text-slate-200">{item.title}</p>{item.is_recurring&&<span className="shrink-0 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">Recorrente</span>}</div><p className="mt-0.5 text-[10px] text-slate-500">{dateLabel(item.date)}{settlementDetail?` · ${settlementDetail}`:''}</p></div><strong className={`shrink-0 text-xs ${tone}`}>{item.direction==='in'?'+ ':item.direction==='out'?'− ':''}{money(item.amount)}</strong></div>{item.kind==='invoice'&&item.card_id&&<button type="button" onClick={()=>onOpenCard?.(item.card_id!)} className="mt-1 min-h-8 text-[11px] font-bold text-violet-300">Ver fatura</button>}</div></article>};

 return <section aria-labelledby="upcoming-title" className={embedded?'rounded-xl bg-slate-950/35 p-2':''}>
  {embedded?<div className="mb-1 flex items-center gap-2 px-1 text-xs font-bold text-cyan-300"><CalendarClock className="h-4 w-4"/>Próximos 7 dias</div>:<FinancialSectionHeading id="upcoming-title" title="Próximos 7 dias" icon={<CalendarClock className="h-5 w-5 text-cyan-400"/>}/>}
  {loading?<div className="flex min-h-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40"><LoaderCircle className="h-5 w-5 animate-spin text-cyan-300"/></div>:error?<p role="status" className="rounded-2xl border border-amber-900/60 bg-amber-950/15 p-3 text-xs text-amber-200">Não foi possível confirmar os próximos acontecimentos agora.</p>:<div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55">{primaryItems.map((item,index)=>renderItem(item,index))}{extraItems.length>0&&<details className="border-t border-slate-800"><summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 text-xs font-semibold text-slate-400"><span>Ver mais acontecimentos</span><span>{extraItems.length}</span></summary><div className="border-t border-slate-800">{extraItems.map((item,index)=>renderItem(item,index))}</div></details>}</div>}
 </section>;
}
