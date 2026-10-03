import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, LoaderCircle, RefreshCw } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listCardFinancialJourney, type CardFinancialJourney } from '../../finance/cardFinancialJourney.js';
import { getCardInvoiceExposure, listCardInvoiceItems, type CardInvoiceExposure, type CardInvoiceItem } from '../../finance/cardInvoiceItems.js';
import { listFinancialInvoices, type FinancialInvoice } from '../../finance/financialInvoices.js';

const money=(value:number|string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value));
const shortDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const monthLabel=(value:string)=>new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`));
const itemStateLabel=(item:CardInvoiceItem)=>item.commitment_state==='reversed'?'Estornado':item.commitment_state==='cancelled'?'Cancelado':null;
const itemInstallmentLabel=(item:CardInvoiceItem)=>item.installment_number&&item.total_installments?`Parcela ${item.installment_number}/${item.total_installments}`:item.source_installment_id?'Parcela':null;
const itemDisplayDate=(item:CardInvoiceItem)=>item.purchase_date??item.financial_date;

export function ContextualCardInvoices({cardId,onPay}:{cardId:string;onPay?:(invoice:FinancialInvoice)=>void}){
 const{household}=useSupabaseAuth();
 const[rows,setRows]=useState<CardFinancialJourney[]>([]);
 const[invoices,setInvoices]=useState<FinancialInvoice[]>([]);
 const[selectedInvoiceId,setSelectedInvoiceId]=useState('');
 const[exposure,setExposure]=useState<CardInvoiceExposure|null>(null);
 const[items,setItems]=useState<CardInvoiceItem[]>([]);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState(false);
 const[itemsLoading,setItemsLoading]=useState(false);
 const[itemsError,setItemsError]=useState(false);
 const[refreshKey,setRefreshKey]=useState(0);

 useEffect(()=>{let active=true;if(!supabase||!household)return;setLoading(true);setError(false);Promise.all([listCardFinancialJourney(supabase,household.id,cardId),listFinancialInvoices(supabase,household.id),getCardInvoiceExposure(supabase,household.id,cardId).catch(()=>null)]).then(([journey,invoiceRows,cardExposure])=>{if(!active)return;const ordered=[...journey].sort((a,b)=>a.invoice_month.localeCompare(b.invoice_month));setRows(ordered);setInvoices(invoiceRows.filter(row=>row.card_id===cardId));setExposure(cardExposure);const current=ordered.find(row=>row.is_current_invoice)??[...ordered].reverse().find(row=>!row.is_future_invoice)??ordered[0];setSelectedInvoiceId(current?.invoice_id??'');}).catch(()=>{if(active){setRows([]);setInvoices([]);setExposure(null);setSelectedInvoiceId('');setError(true);}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[household?.id,cardId,refreshKey]);

 useEffect(()=>{let active=true;if(!supabase||!household||!selectedInvoiceId){setItems([]);return()=>{active=false;};}setItemsLoading(true);setItemsError(false);listCardInvoiceItems(supabase,household.id,selectedInvoiceId).then(next=>{if(active)setItems(next);}).catch(()=>{if(active){setItems([]);setItemsError(true);}}).finally(()=>{if(active)setItemsLoading(false);});return()=>{active=false;};},[household?.id,selectedInvoiceId]);

 const selectedIndex=useMemo(()=>rows.findIndex(row=>row.invoice_id===selectedInvoiceId),[rows,selectedInvoiceId]);
 const sortedItems=useMemo(()=>[...items].sort((a,b)=>itemDisplayDate(b).localeCompare(itemDisplayDate(a))),[items]);
 const activeInvoice=selectedIndex>=0?rows[selectedIndex]:null;
 const paymentInvoice=activeInvoice?invoices.find(row=>row.invoice_id===activeInvoice.invoice_id)??null:null;
 const cardName=activeInvoice?.card_name??rows[0]?.card_name??'Cartão';
 const move=(direction:-1|1)=>{const next=selectedIndex+direction;if(next>=0&&next<rows.length)setSelectedInvoiceId(rows[next].invoice_id);};

 if(loading)return <LoaderCircle className="mx-auto mt-16 h-7 w-7 animate-spin text-violet-300"/>;
 if(error)return <div className="rounded-2xl border border-rose-900 p-4"><p role="alert" className="text-sm text-rose-200">Não foi possível conferir as faturas deste cartão. Nenhum valor foi presumido.</p><button type="button" onClick={()=>setRefreshKey(value=>value+1)} className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200"><RefreshCw className="h-4 w-4"/>Tentar novamente</button></div>;
 if(!activeInvoice)return <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center"><CreditCard className="mx-auto h-8 w-8 text-slate-500"/><p className="mt-3 font-semibold">Ainda não há faturas materializadas para {cardName}.</p><p className="mt-1 text-sm text-slate-500">Quando houver compras ou compromissos no cartão, a jornada aparece aqui.</p></div>;

 const periodLabel=activeInvoice.is_current_invoice?'Fatura atual':activeInvoice.is_future_invoice?'Próxima fatura':'Fatura anterior';
 const invoiceStatus=Number(activeInvoice.remaining_amount)<=0?'Fatura paga':activeInvoice.is_future_invoice?'Próxima fatura':'Fatura aberta';
 return <div className="space-y-4">
  <header className="px-1"><p className="text-xs font-bold uppercase tracking-widest text-violet-400">Cartão</p><h1 className="mt-1 text-2xl font-black">{cardName}</h1></header>

  {exposure&&<section className="rounded-[1.6rem] border border-slate-800 bg-slate-900/75 px-4 py-4">
   <div className="flex items-center justify-between gap-4"><div><p className="text-sm text-slate-400">Limite disponível</p><strong className={'mt-1 block text-2xl '+(Number(exposure.available_limit)<0?'text-rose-300':'text-slate-100')}>{money(exposure.available_limit)}</strong></div><div className="text-right text-xs text-slate-500"><p>Limite {money(exposure.credit_limit)}</p>{Number(exposure.future_known_commitments)>0&&<p className="mt-1">Futuro {money(exposure.future_known_commitments)}</p>}</div></div>
   {exposure.utilization_ratio!=null&&<div className="mt-3"><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className={'h-full rounded-full '+(exposure.card_health==='red'?'bg-rose-400':exposure.card_health==='yellow'?'bg-amber-400':'bg-violet-400')} style={{width:String(Math.min(100,Math.max(0,Number(exposure.utilization_ratio)*100)))+'%'}}/></div></div>}
  </section>}

  <section className="rounded-[1.75rem] border border-slate-800 bg-slate-900/75 p-4">
   <div className="flex items-center justify-between gap-2">
    <button type="button" aria-label="Fatura anterior" disabled={selectedIndex<=0} onClick={()=>move(-1)} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 disabled:opacity-25"><ChevronLeft className="h-5 w-5"/></button>
    <div className="text-center"><p className="text-[11px] font-bold uppercase tracking-wide text-violet-300">{periodLabel}</p><p className="mt-1 text-sm font-semibold capitalize text-slate-300">{monthLabel(activeInvoice.invoice_month)}</p></div>
    <button type="button" aria-label="Próxima fatura" disabled={selectedIndex>=rows.length-1} onClick={()=>move(1)} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 disabled:opacity-25"><ChevronRight className="h-5 w-5"/></button>
   </div>

   <div className="mt-4">
    <p className="text-sm font-semibold text-slate-300">{invoiceStatus}</p>
    <div className="mt-1 flex items-end justify-between gap-3"><strong className="text-3xl font-black">{money(activeInvoice.remaining_amount)}</strong><span className="pb-1 text-xs text-slate-500">vence {shortDate(activeInvoice.due_date)}</span></div>
    {Number(activeInvoice.paid_amount)>0&&<p className="mt-2 text-xs text-emerald-300">{money(activeInvoice.paid_amount)} já pago</p>}
    {Number(activeInvoice.remaining_amount)>0&&Number(activeInvoice.known_invoice_amount)!==Number(activeInvoice.remaining_amount)&&<p className="mt-1 text-xs text-slate-500">Total da fatura {money(activeInvoice.known_invoice_amount)}</p>}
   </div>

   <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-400"><span className="rounded-full bg-slate-800 px-2.5 py-1">{activeInvoice.purchase_commitment_count} {activeInvoice.purchase_commitment_count===1?'compra':'compras'}</span>{activeInvoice.installment_count>0&&<span className="rounded-full bg-slate-800 px-2.5 py-1">{activeInvoice.installment_count} {activeInvoice.installment_count===1?'parcela':'parcelas'}</span>}</div>

   {Number(activeInvoice.credit_amount)>0&&<p className="mt-3 text-xs text-cyan-300">Créditos/estornos: <strong>{money(activeInvoice.credit_amount)}</strong></p>}
   {paymentInvoice&&Number(paymentInvoice.outstanding_amount)>0&&<button type="button" onClick={()=>onPay?.(paymentInvoice)} className="mt-5 min-h-12 w-full rounded-2xl bg-blue-600 px-4 text-sm font-bold">{activeInvoice.is_future_invoice?'Adiantar pagamento':'Pagar tudo ou parte'}</button>}
  </section>

  <section>
   <h2 className="px-1 font-bold">Lançamentos</h2>
   {itemsLoading?<LoaderCircle className="mx-auto my-6 h-5 w-5 animate-spin text-violet-300"/>:itemsError?<p role="alert" className="mt-3 rounded-xl border border-rose-900 bg-rose-950/20 p-3 text-sm text-rose-200">Não foi possível carregar os lançamentos desta fatura.</p>:items.length===0?<p className="mt-3 py-6 text-center text-sm text-slate-500">Nenhum lançamento encontrado nesta fatura.</p>:<div className="mt-3 space-y-2">{sortedItems.map((item,index)=>{const state=itemStateLabel(item);const itemType=item.source_type==='card_opening_adjustment'?'Saldo inicial':itemInstallmentLabel(item)??'Compra';const date=itemDisplayDate(item);return <div key={item.commitment_key} className="relative flex gap-3 pl-1"><div className="relative flex w-4 shrink-0 justify-center"><span className="mt-5 h-2.5 w-2.5 rounded-full border-2 border-violet-400 bg-slate-950"/>{index<sortedItems.length-1&&<span className="absolute left-1/2 top-7 h-[calc(100%+0.5rem)] w-px -translate-x-1/2 bg-slate-700"/>}</div><article className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-900/75 p-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-400"><CreditCard className="h-4 w-4"/></span><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-slate-500">{shortDate(date)}</p><h3 className="mt-0.5 truncate text-sm font-semibold">{item.description}</h3><p className="mt-0.5 text-xs text-slate-500">{itemType}{state?' · '+state:''}</p></div><strong className="shrink-0 text-sm">{money(item.effective_amount)}</strong></div></article></div>})}</div>}
  </section>
 </div>;
}
