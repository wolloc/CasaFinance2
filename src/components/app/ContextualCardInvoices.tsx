import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CreditCard, LoaderCircle, RefreshCw } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listCardFinancialJourney, type CardFinancialJourney } from '../../finance/cardFinancialJourney.js';
import { listCardInvoiceItems, type CardInvoiceItem } from '../../finance/cardInvoiceItems.js';
import { listFinancialInvoices, type FinancialInvoice } from '../../finance/financialInvoices.js';

const money=(value:number|string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value));
const shortDate=(value:string)=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const monthLabel=(value:string)=>new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value.slice(0,10)}T12:00:00Z`));
const itemStateLabel=(item:CardInvoiceItem)=>item.commitment_state==='reversed'?'Estornado':item.commitment_state==='cancelled'?'Cancelado':Number(item.remaining_amount)>0?`Ainda compõe ${money(item.remaining_amount)} em aberto.`:'Liquidado nesta fatura.';
const itemStateClass=(item:CardInvoiceItem)=>item.commitment_state==='reversed'||item.commitment_state==='cancelled'?'text-cyan-300':Number(item.remaining_amount)>0?'text-amber-300':'text-emerald-300';

export function ContextualCardInvoices({cardId,onPay}:{cardId:string;onPay?:(invoice:FinancialInvoice)=>void}){
 const{household}=useSupabaseAuth();
 const[rows,setRows]=useState<CardFinancialJourney[]>([]);
 const[invoices,setInvoices]=useState<FinancialInvoice[]>([]);
 const[selectedInvoiceId,setSelectedInvoiceId]=useState('');
 const[items,setItems]=useState<CardInvoiceItem[]>([]);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState(false);
 const[itemsLoading,setItemsLoading]=useState(false);
 const[itemsError,setItemsError]=useState(false);
 const[refreshKey,setRefreshKey]=useState(0);

 useEffect(()=>{let active=true;if(!supabase||!household)return;setLoading(true);setError(false);Promise.all([listCardFinancialJourney(supabase,household.id,cardId),listFinancialInvoices(supabase,household.id)]).then(([journey,invoiceRows])=>{if(!active)return;const ordered=[...journey].sort((a,b)=>a.invoice_month.localeCompare(b.invoice_month));setRows(ordered);setInvoices(invoiceRows.filter(row=>row.card_id===cardId));const current=ordered.find(row=>row.is_current_invoice)??[...ordered].reverse().find(row=>!row.is_future_invoice)??ordered[0];setSelectedInvoiceId(current?.invoice_id??'');}).catch(()=>{if(active){setRows([]);setInvoices([]);setSelectedInvoiceId('');setError(true);}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[household?.id,cardId,refreshKey]);

 useEffect(()=>{let active=true;if(!supabase||!household||!selectedInvoiceId){setItems([]);return()=>{active=false;};}setItemsLoading(true);setItemsError(false);listCardInvoiceItems(supabase,household.id,selectedInvoiceId).then(next=>{if(active)setItems(next);}).catch(()=>{if(active){setItems([]);setItemsError(true);}}).finally(()=>{if(active)setItemsLoading(false);});return()=>{active=false;};},[household?.id,selectedInvoiceId]);

 const selectedIndex=useMemo(()=>rows.findIndex(row=>row.invoice_id===selectedInvoiceId),[rows,selectedInvoiceId]);
 const activeInvoice=selectedIndex>=0?rows[selectedIndex]:null;
 const paymentInvoice=activeInvoice?invoices.find(row=>row.invoice_id===activeInvoice.invoice_id)??null:null;
 const cardName=activeInvoice?.card_name??rows[0]?.card_name??'Cartão';
 const move=(direction:-1|1)=>{const next=selectedIndex+direction;if(next>=0&&next<rows.length)setSelectedInvoiceId(rows[next].invoice_id);};

 if(loading)return <LoaderCircle className="mx-auto mt-16 h-7 w-7 animate-spin text-violet-300"/>;
 if(error)return <div className="rounded-2xl border border-rose-900 p-4"><p role="alert" className="text-sm text-rose-200">Não foi possível conferir as faturas deste cartão. Nenhum valor foi presumido.</p><button type="button" onClick={()=>setRefreshKey(value=>value+1)} className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200"><RefreshCw className="h-4 w-4"/>Tentar novamente</button></div>;
 if(!activeInvoice)return <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center"><CreditCard className="mx-auto h-8 w-8 text-slate-500"/><p className="mt-3 font-semibold">Ainda não há faturas materializadas para {cardName}.</p><p className="mt-1 text-sm text-slate-500">Quando houver compras ou compromissos no cartão, a jornada aparece aqui.</p></div>;

 const periodLabel=activeInvoice.is_current_invoice?'Fatura atual':activeInvoice.is_future_invoice?'Próxima fatura':'Fatura anterior';
 return <div className="space-y-5">
  <header><p className="text-xs font-bold uppercase tracking-widest text-violet-400">Cartão</p><h1 className="mt-1 text-2xl font-black">{cardName}</h1><p className="mt-1 text-sm text-slate-400">Você entrou pelo cartão. Aqui a fatura é o contexto; a perspectiva Casa/morador não muda o total devido ao emissor.</p></header>
  <section className="rounded-[1.75rem] border border-slate-800 bg-slate-900/70 p-4">
   <div className="flex items-center justify-between gap-3">
    <button type="button" aria-label="Fatura anterior" disabled={selectedIndex<=0} onClick={()=>move(-1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-700 disabled:opacity-30"><ChevronLeft className="h-5 w-5"/></button>
    <div className="text-center"><p className="text-[11px] font-bold uppercase tracking-wide text-violet-300">{periodLabel}</p><h2 className="mt-1 font-black capitalize">{monthLabel(activeInvoice.invoice_month)}</h2><p className="mt-1 text-xs text-slate-500">vence {shortDate(activeInvoice.due_date)}</p></div>
    <button type="button" aria-label="Próxima fatura" disabled={selectedIndex>=rows.length-1} onClick={()=>move(1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-700 disabled:opacity-30"><ChevronRight className="h-5 w-5"/></button>
   </div>
   <div className="mt-5 grid grid-cols-3 gap-2 text-xs"><div><span className="text-slate-500">Total</span><strong className="mt-1 block text-base">{money(activeInvoice.known_invoice_amount)}</strong></div><div><span className="text-slate-500">Pago</span><strong className="mt-1 block text-base text-emerald-300">{money(activeInvoice.paid_amount)}</strong></div><div><span className="text-slate-500">Falta pagar</span><strong className="mt-1 block text-base text-amber-300">{money(activeInvoice.remaining_amount)}</strong></div></div>
   {Number(activeInvoice.credit_amount)>0&&<p className="mt-3 rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-3 text-xs text-cyan-200">Créditos/estornos nesta fatura: <strong>{money(activeInvoice.credit_amount)}</strong>. Isso reduz a obrigação do cartão; não é renda.</p>}
   {paymentInvoice&&Number(paymentInvoice.outstanding_amount)>0&&!activeInvoice.is_future_invoice&&<button type="button" onClick={()=>onPay?.(paymentInvoice)} className="mt-4 min-h-12 w-full rounded-2xl bg-blue-600 px-4 text-sm font-bold">Pagar fatura</button>}
  </section>

  <section className="space-y-3"><div><h2 className="font-bold">Lançamentos da fatura</h2><p className="text-xs text-slate-500">Itens vindos do read model financeiro canônico. O pagamento abaixo nunca vira uma nova despesa.</p></div>
   {itemsLoading?<LoaderCircle className="mx-auto h-5 w-5 animate-spin text-violet-300"/>:itemsError?<p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/20 p-3 text-sm text-rose-200">Não foi possível carregar os lançamentos desta fatura.</p>:items.length===0?<p className="rounded-2xl border border-dashed border-slate-700 p-5 text-sm text-slate-500">Nenhum lançamento canônico encontrado para esta fatura.</p>:items.map(item=><article key={item.commitment_key} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold">{item.description}</h3><p className="mt-1 text-xs text-slate-500">{item.source_type==='card_opening_adjustment'?'Saldo inicial do cartão':item.source_installment_id?'Parcela na fatura':'Compra na fatura'} · {shortDate(item.due_date??item.financial_date)}</p></div><strong className="shrink-0">{money(item.effective_amount)}</strong></div><p className={`mt-2 text-xs ${itemStateClass(item)}`}>{itemStateLabel(item)}</p></article>)}
  </section>
 </div>;
}
