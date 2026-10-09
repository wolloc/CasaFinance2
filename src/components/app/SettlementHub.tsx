import { useEffect, useMemo, useState } from 'react';
import { Banknote, HandCoins, LoaderCircle, UsersRound } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listMemberSettlementEvents, listMemberSettlementPositions, type MemberSettlementEvent, type MemberSettlementPosition } from '../../finance/memberSettlements.js';
import { listOpenThirdPartyObligations, type ThirdPartyObligation } from '../../finance/thirdPartyObligations.js';
import type { SettlementActionIntent } from '../../finance/settlementActionIntent.js';
import { FinancialSectionHeading, financialUi } from './FinancialSectionHeading.js';
import { ThirdPartyContextModal } from './ThirdPartyContextModal.js';

const money=(value:number|string)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dateLabel=(value:string|null)=>{if(!value)return 'Sem vencimento';const date=new Date(`${value}T12:00:00`);const today=new Date();today.setHours(0,0,0,0);date.setHours(0,0,0,0);if(date.getTime()<today.getTime())return `Venceu em ${date.toLocaleDateString('pt-BR')}`;if(date.getTime()===today.getTime())return 'Vence hoje';return `Vence em ${date.toLocaleDateString('pt-BR')}`;};

type MemberPairSummary={
  key:string;
  leftId:string;
  rightId:string;
  realized:MemberSettlementPosition|null;
  projected:MemberSettlementPosition|null;
  projectedAmount:number;
};

type ThirdPartyGroup={
  counterpartyId:string;
  name:string;
  rows:ThirdPartyObligation[];
  net:number;
  nearestDue:string|null;
};

export function SettlementHub({onResolve,perspective='household',embedded=false,includeMembers=true,includeThirdParties=true}:{onResolve?:(intent:SettlementActionIntent)=>void;perspective?:'household'|string;embedded?:boolean;includeMembers?:boolean;includeThirdParties?:boolean}){
  const{household,householdMembers}=useSupabaseAuth();
  const[memberRows,setMemberRows]=useState<MemberSettlementPosition[]>([]);
  const[memberEvents,setMemberEvents]=useState<MemberSettlementEvent[]>([]);
  const[thirdPartyRows,setThirdPartyRows]=useState<ThirdPartyObligation[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(false);
  const[refreshKey,setRefreshKey]=useState(0);
  const[selectedThirdParty,setSelectedThirdParty]=useState<ThirdPartyGroup|null>(null);

  useEffect(()=>{let cancelled=false;if(!supabase||!household)return;setLoading(true);setError(false);Promise.all([listMemberSettlementPositions(supabase,household.id),listOpenThirdPartyObligations(supabase,household.id),listMemberSettlementEvents(supabase,household.id)]).then(([members,thirdParties,events])=>{if(cancelled)return;setMemberRows(members);setThirdPartyRows(thirdParties);setMemberEvents(events);}).catch(()=>{if(cancelled)return;setMemberRows([]);setThirdPartyRows([]);setMemberEvents([]);setError(true);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[household?.id,refreshKey]);

  const retry=()=>setRefreshKey(value=>value+1);
  const memberName=(id:string)=>householdMembers.find(member=>member.id===id)?.display_name??'Membro';
  const responsibilityLabel=(row:ThirdPartyObligation)=>{const members=row.responsibility_members.filter(item=>item.amount>0);if(members.length===0)return 'Casa';if(members.length===1)return memberName(members[0].member_id);const total=members.reduce((sum,item)=>sum+item.amount,0);const equalHalf=members.length===2&&members.every(item=>total>0&&Math.abs(item.amount/total*100-50)<0.01);if(equalHalf)return `50/50 · ${members.map(item=>memberName(item.member_id)).join(' + ')}`;return members.map(item=>`${memberName(item.member_id)} ${total>0?Math.round(item.amount/total*100):0}%`).join(' · ');};
  const eventLabel=(event:MemberSettlementEvent)=>event.source_money_movement_id&&event.kind==='adjustment'?'Transferência entre vocês':event.notes?.trim()||event.source_description||(event.kind==='explicit_settlement'?'Transferência já considerada':'Despesa ou compromisso');
  const pairEvents=(leftId:string,rightId:string,state:'realized'|'projected')=>memberEvents.filter(event=>event.state===state&&((event.debtor_member_id===leftId&&event.creditor_member_id===rightId)||(event.debtor_member_id===rightId&&event.creditor_member_id===leftId)));

  const memberPairs=useMemo<MemberPairSummary[]>(()=>{
    const keys=new Set<string>();
    for(const row of memberRows)keys.add([row.debtor_member_id,row.creditor_member_id].sort().join('|'));
    return [...keys].map(key=>{
      const[leftId,rightId]=key.split('|');
      const forward=memberRows.find(row=>row.debtor_member_id===leftId&&row.creditor_member_id===rightId)??null;
      const reverse=memberRows.find(row=>row.debtor_member_id===rightId&&row.creditor_member_id===leftId)??null;
      const realized=[forward,reverse].find(row=>row&&Number(row.net_position)>0)??null;
      const forwardProjected=Number(forward?.projected_outstanding??0)-Number(reverse?.projected_outstanding??0);
      const projected=forwardProjected>0?forward:forwardProjected<0?reverse:null;
      return{key,leftId,rightId,realized,projected,projectedAmount:Math.abs(forwardProjected)};
    }).filter(pair=>includeMembers&&(pair.realized||pair.projectedAmount>0)&&(perspective==='household'||pair.leftId===perspective||pair.rightId===perspective));
  },[memberRows,perspective,includeMembers]);

  const thirdPartyGroups=useMemo<ThirdPartyGroup[]>(()=>{
    const visibleRows=perspective==='household'?thirdPartyRows:thirdPartyRows.flatMap(row=>{const member=row.responsibility_members.find(item=>item.member_id===perspective);if(!member||!(member.amount>0))return[];return[{...row,outstanding_amount:Math.min(row.outstanding_amount,member.amount),responsibility_members:[member]}];});
    const groups=new Map<string,ThirdPartyObligation[]>();
    for(const row of visibleRows)groups.set(row.counterparty_id,[...(groups.get(row.counterparty_id)??[]),row]);
    if(!includeThirdParties)return [];
    return [...groups.entries()].map(([counterpartyId,rows])=>{
      const net=rows.reduce((sum,row)=>sum+(row.kind==='receivable'?Number(row.outstanding_amount):-Number(row.outstanding_amount)),0);
      const dueDates=rows.map(row=>row.due_date).filter((value):value is string=>Boolean(value)).sort();
      return{counterpartyId,name:rows[0]?.counterparty_name??'Outra pessoa',rows,net,nearestDue:dueDates[0]??null};
    }).sort((a,b)=>Math.abs(b.net)-Math.abs(a.net)||a.name.localeCompare(b.name));
  },[thirdPartyRows,perspective,includeThirdParties]);

  if(loading)return <section>{!embedded&&<FinancialSectionHeading title="Valores com pessoas" icon={<UsersRound className="h-5 w-5 text-cyan-400"/>}/>}<LoaderCircle className="h-5 w-5 animate-spin text-cyan-300"/></section>;

  return <section>
    {!embedded&&<FinancialSectionHeading title="Valores com pessoas" icon={<UsersRound className="h-5 w-5 text-cyan-400"/>}/>} 
    {!error&&!embedded&&<div className="mb-3 grid grid-cols-2 gap-2"><button type="button" onClick={()=>onResolve?.({kind:'loan',direction:'taken'})} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-900 bg-cyan-950/15 px-3 text-xs font-semibold text-cyan-200"><Banknote className="h-4 w-4"/>Peguei emprestado</button><button type="button" onClick={()=>onResolve?.({kind:'loan',direction:'granted'})} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-800 px-3 text-xs font-semibold text-slate-300"><Banknote className="h-4 w-4"/>Emprestei dinheiro</button></div>}
    {error&&<div className="rounded-xl border border-rose-900 bg-rose-950/30 p-3"><p role="alert" className="text-sm text-rose-200">Não foi possível conferir os valores com pessoas agora.</p><button type="button" onClick={retry} className="mt-3 min-h-10 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200">Tentar novamente</button></div>}

    {!error&&memberPairs.length===0&&thirdPartyGroups.length===0&&<div className="rounded-2xl border border-dashed border-slate-800 p-4"><p className="text-sm font-semibold text-slate-300">Tudo equilibrado por enquanto.</p></div>}

    {!error&&<div className="space-y-2">
      {memberPairs.map(pair=>{
        const current=pair.realized;
        const currentAmount=current?Number(current.net_position):0;
        const currentText=current?`${memberName(current.creditor_member_id)} tem ${money(currentAmount)} com ${memberName(current.debtor_member_id)}`:'Tudo equilibrado hoje';
        const projectedText=pair.projected&&pair.projectedAmount>0?`Tendência: ${memberName(pair.projected.creditor_member_id)} pode ficar com ${money(pair.projectedAmount)} de ${memberName(pair.projected.debtor_member_id)}`:'Sem diferença projetada';
        const realizedEvents=pairEvents(pair.leftId,pair.rightId,'realized');
        const projectedEvents=pairEvents(pair.leftId,pair.rightId,'projected');
        return <details key={pair.key} className="group rounded-2xl border border-cyan-900/60 bg-cyan-950/15 transition-colors hover:border-cyan-800/80">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0"><strong className="block text-sm">{memberName(pair.leftId)} ↔ {memberName(pair.rightId)}</strong><p className="mt-1 truncate text-xs text-slate-500">{current?currentText:'Tudo equilibrado hoje'}</p></div>
            <strong className="whitespace-nowrap text-base text-cyan-200">{current?money(currentAmount):money(0)}</strong>
          </summary>
          <div className="space-y-2 border-t border-slate-800 px-4 py-3">
            {pair.projectedAmount>0&&<details className="rounded-xl bg-slate-950/55 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-400">Ver tendência</summary><p className="mt-2 text-sm text-slate-400">{projectedText}</p></details>}
            {(realizedEvents.length>0||projectedEvents.length>0)&&<details className="rounded-xl bg-slate-950/55 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-400">Ver histórico e compromissos</summary><div className="mt-2 space-y-2">{[...realizedEvents,...projectedEvents].map(event=><div key={event.id} className="flex justify-between gap-3 text-xs"><span className="text-slate-500">{eventLabel(event)} · {new Date(`${event.financial_date}T12:00:00`).toLocaleDateString('pt-BR')}</span><strong className="whitespace-nowrap text-slate-300">{money(event.amount)}</strong></div>)}</div></details>}
          </div>
        </details>;
      })}

      {thirdPartyGroups.map(group=>{
        const status=perspective==='household'?(group.net>0?`${group.name} deve à Casa`:group.net<0?`A Casa deve a ${group.name}`:'Valores equilibrados'):(group.net>0?`${group.name} deve a você`:group.net<0?`Você deve a ${group.name}`:'Valores equilibrados');
        const responsibilityLabels=[...new Set(group.rows.map(responsibilityLabel))];
        const responsibility=responsibilityLabels.length===1?responsibilityLabels[0]:'Responsabilidade mista';
        return <details key={group.counterpartyId} className={`group ${financialUi.surfaceInteractive}`}>
          <summary onClick={event=>{event.preventDefault();setSelectedThirdParty(group);}} className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="block truncate text-sm">{group.name}</strong><span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{responsibility}</span></div><p className="mt-1 text-xs text-slate-500">{status}{group.nearestDue?` · ${dateLabel(group.nearestDue)}`:''}</p></div>
            <strong className={`whitespace-nowrap ${group.net>0?'text-emerald-300':group.net<0?'text-rose-300':'text-slate-300'}`}>{money(Math.abs(group.net))}</strong>
          </summary>
          <div className="space-y-3 border-t border-slate-800 px-4 py-3">{group.rows.map(row=><article key={row.id} className="rounded-xl bg-slate-950/55 p-3">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-slate-300">{row.kind==='receivable'?'A receber':'A pagar'} · {dateLabel(row.due_date)}</p><p className="mt-1 truncate text-xs text-slate-500">{row.description}</p><p className="mt-1 text-[10px] font-semibold text-cyan-300/80">{perspective==='household'?`Responsabilidade: ${responsibilityLabel(row)}`:'Sua parte desta posição'}</p></div><strong className="whitespace-nowrap text-sm">{money(row.outstanding_amount)}</strong></div>
            {row.origin_kind==='loan'&&row.kind==='payable'&&!row.source_transaction_id?<button type="button" onClick={()=>onResolve?.({kind:'loan-detail',obligationId:row.id})} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-800 bg-cyan-950/30 px-3 text-sm font-bold text-cyan-200"><Banknote className="h-4 w-4"/>Ver empréstimo</button>:<button type="button" onClick={()=>onResolve?.({kind:'third-party',obligationId:row.id,amount:Number(row.outstanding_amount)})} className="mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-800 bg-cyan-950/30 px-3 text-sm font-bold text-cyan-200"><HandCoins className="h-4 w-4"/>{row.kind==='receivable'?'Registrar recebimento':'Registrar pagamento'}</button>}
            <details className="mt-2 rounded-xl border border-slate-800 px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-slate-400">Outras opções</summary><div className="mt-2 grid gap-2">{row.origin_kind==='manual'&&row.state==='open'&&row.settled_amount===0&&<button type="button" onClick={()=>onResolve?.({kind:'third-party-manage',obligationId:row.id})} className="min-h-10 rounded-lg border border-slate-700 px-3 text-left text-xs font-semibold text-slate-300">Corrigir cadastro ou vencimento</button>}{row.kind==='receivable'?<button type="button" onClick={()=>onResolve?.({kind:'third-party-loss',obligationId:row.id})} className="min-h-10 rounded-lg border border-rose-900 px-3 text-left text-xs font-semibold text-rose-300">Não será recebido</button>:<button type="button" onClick={()=>onResolve?.({kind:'third-party-forgiveness',obligationId:row.id})} className="min-h-10 rounded-lg border border-emerald-900 px-3 text-left text-xs font-semibold text-emerald-300">Dívida foi perdoada</button>}</div></details>
          </article>)}</div>
        </details>;
      })}
    </div>}
    {selectedThirdParty&&<ThirdPartyContextModal counterpartyId={selectedThirdParty.counterpartyId} name={selectedThirdParty.name} net={selectedThirdParty.net} openRows={selectedThirdParty.rows} onClose={()=>setSelectedThirdParty(null)} onResolve={onResolve}/>}
  </section>;
}
