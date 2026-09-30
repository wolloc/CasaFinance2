import { useEffect, useMemo, useState } from 'react';
import { Banknote, HandCoins, History, LoaderCircle, X } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import {
  listThirdPartyObligationHistory,
  type ThirdPartyObligation,
  type ThirdPartyObligationHistory,
  type ThirdPartyObligationHistoryEvent,
} from '../../finance/thirdPartyObligations.js';
import type { SettlementActionIntent } from '../../finance/settlementActionIntent.js';

const money=(value:number|string)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const formatDate=(value:string)=>new Date(value.length===10?`${value}T12:00:00`:value).toLocaleDateString('pt-BR');

const originLabels:Record<string,string>={
  loan:'Empréstimo',
  advance:'Adiantamento',
  shared_expense:'Despesa compartilhada',
  reimbursement:'Reembolso',
  informal_debt:'Valor combinado',
  invoice_financing:'Financiamento de fatura',
  manual:'Valor registrado',
  other:'Valor com pessoa',
};

const eventLabels:Record<ThirdPartyObligationHistoryEvent['kind'],string>={
  receipt:'Recebimento',
  payment:'Pagamento',
  cancellation:'Cancelamento',
  write_off:'Baixa do valor',
  adjustment:'Correção',
};

type TimelineItem={
  key:string;
  date:string;
  title:string;
  description:string;
  amount:number;
  balance:number;
  tone:'origin'|'positive'|'neutral';
};

function buildTimeline(history:ThirdPartyObligationHistory):TimelineItem[]{
  const items:TimelineItem[]=[];
  for(const obligation of history.obligations){
    let balance=obligation.original_amount;
    items.push({
      key:`origin-${obligation.id}`,
      date:obligation.obligation_date,
      title:originLabels[obligation.origin_kind]??'Valor com pessoa',
      description:obligation.description,
      amount:obligation.original_amount,
      balance,
      tone:'origin',
    });
    for(const event of obligation.events){
      if(['receipt','payment','cancellation','write_off'].includes(event.kind))balance=Math.max(0,balance-event.amount);
      items.push({
        key:event.id,
        date:event.occurred_at,
        title:eventLabels[event.kind],
        description:event.notes?.trim()||obligation.description,
        amount:event.amount,
        balance,
        tone:event.kind==='receipt'||event.kind==='payment'?'positive':'neutral',
      });
    }
  }
  return items.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());
}

export function ThirdPartyContextModal({
  counterpartyId,
  name,
  net,
  openRows,
  onClose,
  onResolve,
}:{
  counterpartyId:string;
  name:string;
  net:number;
  openRows:ThirdPartyObligation[];
  onClose:()=>void;
  onResolve?:(intent:SettlementActionIntent)=>void;
}){
  const{household}=useSupabaseAuth();
  const[history,setHistory]=useState<ThirdPartyObligationHistory|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    if(!supabase||!household)return;
    setLoading(true);
    setError(false);
    listThirdPartyObligationHistory(supabase,household.id,counterpartyId)
      .then(result=>{if(!cancelled)setHistory(result);})
      .catch(()=>{if(!cancelled){setHistory(null);setError(true);}})
      .finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[household?.id,counterpartyId]);

  const timeline=useMemo(()=>history?buildTimeline(history):[],[history]);
  const status=net>0?`${name} deve à Casa`:net<0?`A Casa deve a ${name}`:'Valores equilibrados';

  const resolve=(intent:SettlementActionIntent)=>{onClose();onResolve?.(intent);};

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section role="dialog" aria-modal="true" aria-label={`Histórico com ${name}`} className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-700 bg-slate-900 shadow-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Valores com pessoas</p>
          <h2 className="mt-1 truncate text-xl font-black">{name}</h2>
          <p className="mt-1 text-sm text-slate-400">{status}</p>
        </div>
        <button type="button" aria-label={`Fechar histórico com ${name}`} onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300"><X className="h-4 w-4"/></button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <section className="rounded-2xl bg-slate-950/60 p-4">
          <p className="text-xs text-slate-500">Posição atual</p>
          <strong className={`mt-1 block text-2xl ${net>0?'text-emerald-300':net<0?'text-rose-300':'text-slate-200'}`}>{money(Math.abs(net))}</strong>
          <p className="mt-1 text-xs text-slate-500">Este saldo resume somente o que continua em aberto hoje.</p>
        </section>

        {openRows.length>0&&<section>
          <h3 className="text-sm font-bold text-slate-200">Em aberto</h3>
          <div className="mt-2 space-y-2">{openRows.map(row=><article key={row.id} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-xs font-semibold text-slate-300">{row.kind==='receivable'?'A receber':'A pagar'}</p><p className="mt-1 text-sm text-slate-400">{row.description}</p>{row.due_date&&<p className="mt-1 text-xs text-slate-600">Combinado para {formatDate(row.due_date)}</p>}</div>
              <strong className="whitespace-nowrap text-sm text-slate-100">{money(row.outstanding_amount)}</strong>
            </div>
            {row.origin_kind==='loan'&&row.kind==='payable'&&!row.source_transaction_id
              ?<button type="button" onClick={()=>resolve({kind:'loan-detail',obligationId:row.id})} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-800 bg-cyan-950/30 px-3 text-sm font-bold text-cyan-200"><Banknote className="h-4 w-4"/>Ver empréstimo</button>
              :<button type="button" onClick={()=>resolve({kind:'third-party',obligationId:row.id,amount:Number(row.outstanding_amount)})} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-800 bg-cyan-950/30 px-3 text-sm font-bold text-cyan-200"><HandCoins className="h-4 w-4"/>{row.kind==='receivable'?'Registrar recebimento':'Registrar pagamento'}</button>}
            <details className="mt-2 rounded-xl border border-slate-800 px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-400">Outras opções</summary>
              <div className="mt-2 grid gap-2">
                {row.origin_kind==='manual'&&row.state==='open'&&row.settled_amount===0&&<button type="button" onClick={()=>resolve({kind:'third-party-manage',obligationId:row.id})} className="min-h-10 rounded-lg border border-slate-700 px-3 text-left text-xs font-semibold text-slate-300">Corrigir cadastro ou vencimento</button>}
                {row.kind==='receivable'
                  ?<button type="button" onClick={()=>resolve({kind:'third-party-loss',obligationId:row.id})} className="min-h-10 rounded-lg border border-rose-900 px-3 text-left text-xs font-semibold text-rose-300">Não será recebido</button>
                  :<button type="button" onClick={()=>resolve({kind:'third-party-forgiveness',obligationId:row.id})} className="min-h-10 rounded-lg border border-emerald-900 px-3 text-left text-xs font-semibold text-emerald-300">Dívida foi perdoada</button>}
              </div>
            </details>
          </article>)}</div>
        </section>}

        <section>
          <div className="flex items-center gap-2"><History className="h-4 w-4 text-cyan-300"/><h3 className="text-sm font-bold text-slate-200">Extrato da relação</h3></div>
          <p className="mt-1 text-xs text-slate-500">Mostra como os valores surgiram e o que aconteceu depois. Pagamentos e recebimentos não viram novos gastos ou rendas.</p>
          {loading?<LoaderCircle className="mx-auto my-8 h-6 w-6 animate-spin text-cyan-300"/>:error?<p role="alert" className="mt-3 rounded-xl border border-rose-900 bg-rose-950/20 p-3 text-sm text-rose-200">Não foi possível carregar o histórico agora. A posição atual continua preservada.</p>:timeline.length===0?<p className="mt-3 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">Ainda não há histórico registrado com esta pessoa.</p>:<div className="mt-3 space-y-2">{timeline.map(item=><article key={item.key} className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-xs font-semibold text-slate-300">{item.title}</p><p className="mt-1 text-sm text-slate-400">{item.description}</p><p className="mt-1 text-[11px] text-slate-600">{formatDate(item.date)}</p></div>
              <strong className={`whitespace-nowrap text-sm ${item.tone==='positive'?'text-cyan-200':'text-slate-200'}`}>{money(item.amount)}</strong>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Saldo deste valor após o evento: <strong className="text-slate-400">{money(item.balance)}</strong></p>
          </article>)}</div>}
        </section>
      </div>
    </section>
  </div>;
}
