import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, CreditCard, HandCoins, Utensils, WalletCards } from 'lucide-react';
import type { CardOverview } from '../../finance/cardOverview.js';
import type { HouseholdResourcePosition, MemberResourcePosition } from '../../finance/memberResources.js';
import type { ResourceNavigationAction } from './ResourceActionRow.js';
import { ResourceActionRow } from './ResourceActionRow.js';
import type { SettlementActionIntent } from '../../finance/settlementActionIntent.js';
import { SettlementHub } from './SettlementHub.js';
import { supabase } from '../../lib/supabase.js';

const money=(value:number|string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value));
type ResourceRow=HouseholdResourcePosition|MemberResourcePosition;

const amountOf=(row:ResourceRow)=>'attributed_amount' in row?Number(row.attributed_amount):Number(row.current_balance);

export function HomeFinancialMap({
  resources,
  cards,
  perspective,
  memberName,
  onOpenCard,
  onResourceAction,
  onSettlementAction,
}:{
  resources:ResourceRow[];
  cards:CardOverview[];
  perspective:'household'|string;
  memberName:(id:string)=>string;
  onOpenCard?:(cardId:string)=>void;
  onResourceAction?:(action:ResourceNavigationAction)=>void;
  onSettlementAction?:(intent:SettlementActionIntent)=>void;
}){
  const groups=[
    {key:'accounts',label:'Contas',rows:resources.filter(item=>Boolean(item.institution)&&!item.is_investment&&item.resource_restriction!=='reserve'&&item.type!=='meal_benefit')},
    {key:'cash',label:'Dinheiro',rows:resources.filter(item=>!item.institution&&!item.is_investment&&item.resource_restriction!=='reserve'&&item.type!=='meal_benefit')},
    {key:'benefits',label:'Benefícios',rows:resources.filter(item=>!item.is_investment&&item.type==='meal_benefit')},
    {key:'investments',label:'Investimentos e reservas',rows:resources.filter(item=>item.is_investment||item.resource_restriction==='reserve')},
  ].filter(group=>group.rows.length>0);
  const resourceTotal=resources.reduce((sum,item)=>sum+amountOf(item),0);
  const visibleCards=cards.filter(item=>perspective==='household'||item.member_responsibilities.some(row=>row.member_id===perspective&&row.member_responsibility_exposure>0));
  const cardTotals=visibleCards.reduce((totals,card)=>{
    const responsibility=perspective==='household'?null:card.member_responsibilities.find(row=>row.member_id===perspective);
    totals.current+=perspective==='household'?Number(card.current_invoice_remaining):Number(responsibility?.member_current_invoice_responsibility??0);
    totals.future+=perspective==='household'?Number(card.future_known_commitments):Number(responsibility?.member_future_responsibility??0);
    totals.limit+=Number(card.credit_limit);
    return totals;
  },{current:0,future:0,limit:0});

  return <section className="space-y-3">
    <div className="px-1"><h2 className="text-lg font-black text-slate-100">Onde está nosso dinheiro?</h2></div>

    <details open className="group rounded-[1.6rem] border border-slate-800 bg-slate-900/45">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300"><WalletCards className="h-4 w-4"/></span><div><p className="font-bold text-slate-200">Contas</p><p className="text-[11px] text-slate-500">{resources.length} {resources.length===1?'recurso acompanhado':'recursos acompanhados'}</p></div></div>
        <div className="flex items-center gap-2"><strong className="text-sm">{money(resourceTotal)}</strong><ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-open:rotate-90"/></div>
      </summary>
      <div className="space-y-2 border-t border-slate-800/80 p-3">
        {groups.map(group=>{const total=group.rows.reduce((sum,item)=>sum+amountOf(item),0);return <details key={group.key} className="group/sub rounded-2xl bg-slate-950/35">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5"><div><p className="text-sm font-bold text-slate-300">{group.label}</p><p className="text-[10px] text-slate-600">{group.rows.length} {group.rows.length===1?'item':'itens'}</p></div><div className="flex items-center gap-2"><strong className="text-sm text-slate-200">{money(total)}</strong><ChevronRight className="h-3.5 w-3.5 text-slate-600 transition-transform group-open/sub:rotate-90"/></div></summary>
          <div className="grid grid-cols-2 gap-2 border-t border-slate-800/70 p-2 sm:grid-cols-3">{group.rows.sort((a,b)=>amountOf(b)-amountOf(a)).map(item=><ResourceActionRow key={item.account_id} resource={{
            accountId:item.account_id,
            name:item.name,
            type:item.type,
            institution:item.institution,
            ownerLabel:item.owner_member_ids.map(memberName).join(' + ')||'Casa',
            resourceRestriction:item.resource_restriction,
            isInvestment:item.is_investment,
            amount:amountOf(item),
            amountLabel:'attributed_amount' in item&&item.allocation_ratio<1?`Sua parte · ${Math.round(item.allocation_ratio*100)}%`:'Saldo atual',
            detailLabel:item.resource_restriction==='reserve'?'Reserva':item.is_investment?'Posição patrimonial':null,
          }} onAction={onResourceAction}/>)}</div>
        </details>})}
      </div>
    </details>

    <details className="group rounded-[1.6rem] border border-violet-900/45 bg-violet-950/10">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300"><CreditCard className="h-4 w-4"/></span><div><p className="font-bold text-slate-200">Cartões</p><p className="text-[11px] text-slate-500">{visibleCards.length} {visibleCards.length===1?'cartão acompanhado':'cartões acompanhados'}</p></div></div>
        <ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-open:rotate-90"/>
      </summary>
      <div className="space-y-3 border-t border-violet-900/30 p-3">
        {visibleCards.length===0?<p className="p-2 text-sm text-slate-500">Nenhum cartão nesta perspectiva.</p>:<>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-950/35 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Neste mês</p><strong className="mt-1 block text-sm text-rose-200">{money(cardTotals.current)}</strong></div>
            <div className="rounded-xl bg-slate-950/35 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Próximos meses</p><strong className="mt-1 block text-sm text-amber-200">{money(cardTotals.future)}</strong></div>
            <div className="rounded-xl bg-slate-950/35 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Limite total</p><strong className="mt-1 block text-sm text-slate-100">{money(cardTotals.limit)}</strong></div>
          </div>
          {visibleCards.map(card=>{const responsibility=perspective==='household'?null:card.member_responsibilities.find(row=>row.member_id===perspective);const current=perspective==='household'?Number(card.current_invoice_remaining):Number(responsibility?.member_current_invoice_responsibility??0);const future=perspective==='household'?Number(card.future_known_commitments):Number(responsibility?.member_future_responsibility??0);const committed=current+future;const ratio=card.credit_limit>0?Math.min(1,committed/Number(card.credit_limit)):0;return <button type="button" key={card.card_id} onClick={()=>onOpenCard?.(card.card_id)} className="block w-full rounded-xl bg-slate-950/35 px-3 py-3 text-left">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-200">{card.card_name}</p><p className="mt-0.5 text-[11px] text-slate-500">{card.next_due_date?`Próxima fatura · ${new Date(`${card.next_due_date}T12:00:00`).toLocaleDateString('pt-BR')}`:'Sem vencimento confirmado'}</p></div><div className="text-right"><strong className="text-sm text-slate-100">{money(card.credit_limit)}</strong><p className="text-[10px] text-slate-600">limite total</p></div></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-400" style={{width:`${Math.round(ratio*100)}%`}}/></div>
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px]"><span className="text-rose-300">{money(current)} neste mês</span><span className="text-amber-300">{money(future)} próximos meses</span></div>
          </button>})}
        </>}
      </div>
    </details>

    <details className="group rounded-[1.6rem] border border-cyan-900/45 bg-cyan-950/10">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300"><HandCoins className="h-4 w-4"/></span><div><p className="font-bold text-slate-200">Outras pessoas</p><p className="text-[11px] text-slate-500">Valores a receber ou pagar fora da Casa</p></div></div>
        <ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-open:rotate-90"/>
      </summary>
      <div className="border-t border-cyan-900/30 p-3"><SettlementHub perspective={perspective} onResolve={onSettlementAction} embedded includeMembers={false}/></div>
    </details>
  </section>;
}


type BenefitMiniStatementRow={id:string;accountId:string;accountName:string;kind:string;amount:number;movementDate:string;description:string;direction:'in'|'out'};

function BenefitMiniStatement({accounts}:{accounts:Array<{id:string;name:string}>}){
 const[rows,setRows]=useState<BenefitMiniStatementRow[]>([]);
 const[loading,setLoading]=useState(true);
 const[failed,setFailed]=useState(false);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   if(!supabase||accounts.length===0){if(active){setRows([]);setLoading(false);}return;}
   setLoading(true);setFailed(false);
   try{
    const ids=accounts.map(account=>account.id);
    const[dest,source]=await Promise.all([
      supabase.from('money_movements').select('id,destination_account_id,kind,amount,movement_date,description').eq('state','realized').in('destination_account_id',ids).order('movement_date',{ascending:false}).limit(20),
      supabase.from('money_movements').select('id,source_account_id,kind,amount,movement_date,description').eq('state','realized').in('source_account_id',ids).order('movement_date',{ascending:false}).limit(20),
    ]);
    if(dest.error)throw dest.error;if(source.error)throw source.error;
    const names=new Map(accounts.map(account=>[account.id,account.name]));
    const incoming=(dest.data??[]).map(row=>({id:String(row.id),accountId:String(row.destination_account_id),accountName:names.get(String(row.destination_account_id))??'Benefício',kind:String(row.kind),amount:Number(row.amount),movementDate:String(row.movement_date),description:String(row.description),direction:'in' as const}));
    const outgoing=(source.data??[]).map(row=>({id:String(row.id),accountId:String(row.source_account_id),accountName:names.get(String(row.source_account_id))??'Benefício',kind:String(row.kind),amount:Number(row.amount),movementDate:String(row.movement_date),description:String(row.description),direction:'out' as const}));
    const merged=[...incoming,...outgoing].sort((a,b)=>b.movementDate.localeCompare(a.movementDate)||b.id.localeCompare(a.id)).slice(0,6);
    if(active)setRows(merged);
   }catch{if(active){setRows([]);setFailed(true);}}
   finally{if(active)setLoading(false);}
  };
  void load();
  return()=>{active=false;};
 },[accounts.map(account=>account.id).join(',')]);
 if(loading)return <p className="px-3 pb-3 text-[11px] text-slate-500">Carregando extrato…</p>;
 if(failed)return <p className="px-3 pb-3 text-[11px] text-amber-300">Não foi possível carregar o extrato dos benefícios agora.</p>;
 if(rows.length===0)return <p className="px-3 pb-3 text-[11px] text-slate-500">Nenhuma movimentação de benefício realizada ainda.</p>;
 return <div className="border-t border-slate-800/70 p-2">
   <div className="mb-2 flex items-center gap-2 px-1"><Utensils className="h-3.5 w-3.5 text-orange-300"/><p className="text-[11px] font-bold text-slate-300">Últimas movimentações</p></div>
   <div className="space-y-1.5">{rows.map(row=><div key={`${row.id}:${row.direction}`} className="flex items-center gap-2 rounded-xl bg-slate-950/55 px-2.5 py-2">
     <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${row.direction==='in'?'bg-emerald-500/10 text-emerald-300':'bg-rose-500/10 text-rose-300'}`}>{row.direction==='in'?<ArrowDownToLine className="h-3.5 w-3.5"/>:<ArrowUpFromLine className="h-3.5 w-3.5"/>}</span>
     <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-slate-300">{row.description}</p><p className="text-[10px] text-slate-600">{row.accountName} · {new Date(`${row.movementDate}T12:00:00Z`).toLocaleDateString('pt-BR')}</p></div>
     <strong className={`shrink-0 text-[11px] ${row.direction==='in'?'text-emerald-300':'text-rose-300'}`}>{row.direction==='in'?'+':'−'} {money(row.amount)}</strong>
   </div>)}</div>
 </div>;
}
