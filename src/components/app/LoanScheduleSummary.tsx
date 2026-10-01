import { useEffect,useMemo,useState } from 'react';
import { CalendarClock,LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listLoanSchedule,type LoanScheduleItem } from '../../finance/loanSchedule.js';

const money=(value:number|string)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dateLabel=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');

export function LoanScheduleSummary({loanId}:{loanId:string}){
 const{household}=useSupabaseAuth();
 const[rows,setRows]=useState<LoanScheduleItem[]>([]);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState(false);
 useEffect(()=>{let cancelled=false;if(!supabase||!household)return;setLoading(true);setError(false);listLoanSchedule(supabase,household.id,loanId).then(next=>{if(!cancelled)setRows(next);}).catch(()=>{if(!cancelled){setRows([]);setError(true);}}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[household?.id,loanId]);
 const totals=useMemo(()=>rows.reduce((sum,row)=>({scheduled:sum.scheduled+Number(row.scheduled_total_amount),remaining:sum.remaining+Number(row.remaining_total_amount)}),{scheduled:0,remaining:0}),[rows]);
 if(loading)return <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-blue-300"/>;
 if(error)return <p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/20 p-3 text-sm text-rose-200">Não foi possível conferir o cronograma deste empréstimo.</p>;
 if(rows.length===0)return <p className="rounded-xl border border-dashed border-slate-800 p-3 text-sm text-slate-500">Este empréstimo não possui cronograma canônico cadastrado.</p>;
 return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
  <div className="flex items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 font-bold"><CalendarClock className="h-5 w-5 text-blue-300"/>Cronograma</h3><p className="mt-1 text-sm text-slate-400">{rows.length} {rows.length===1?'parcela':'parcelas'} · total previsto {money(totals.scheduled)}</p><p className="mt-1 text-xs text-blue-200/80">As parcelas em aberto já reduzem a projeção dos meses em que vencem.</p></div><strong className="text-sm text-slate-200">Falta {money(totals.remaining)}</strong></div>
  <div className="mt-4 space-y-2">{rows.map(row=><article key={row.schedule_item_id} className="rounded-xl bg-slate-950/60 p-3"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm">{row.installment_number}ª parcela</strong><p className="mt-0.5 text-xs text-slate-500">Vence {dateLabel(row.due_date)}</p></div><div className="text-right"><strong className="text-sm">{money(row.scheduled_total_amount)}</strong><p className="mt-0.5 text-[10px] text-slate-500">{row.state==='paid'?'Paga':row.state==='partially_paid'?'Parcial':'Prevista'}</p></div></div><div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-slate-500"><span>Principal<br/><b className="text-slate-300">{money(row.principal_amount)}</b></span><span>Juros<br/><b className="text-slate-300">{money(row.projected_interest_amount)}</b></span><span>Tarifa<br/><b className="text-slate-300">{money(row.projected_fee_amount)}</b></span></div></article>)}</div>
 </section>;
}
