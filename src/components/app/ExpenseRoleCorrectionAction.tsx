import { useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, Plus, Users, X } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { listFinancialParties, type FinancialParty } from '../../finance/financialParties.js';
import { correctExpenseRoles, listExpenseRoleCorrectionPositions, type ExpenseRoleCorrectionPosition } from '../../finance/expenseRoleCorrections.js';

const money=(value:number|string|null|undefined)=>Number(value??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const defaultReason='Ajuste de responsabilidade do compromisso';

type Participant={kind:'member'|'party';id:string;percentage:string};

export function ExpenseRoleCorrectionAction({initialTransactionId,onCompleted}:{initialTransactionId?:string;onCompleted?:()=>void}={}){
  const{household,householdMembers}=useSupabaseAuth();
  const[rows,setRows]=useState<ExpenseRoleCorrectionPosition[]>([]);
  const[parties,setParties]=useState<FinancialParty[]>([]);
  const[selectedId,setSelectedId]=useState('');
  const[participants,setParticipants]=useState<Participant[]>([]);
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[loadError,setLoadError]=useState<string|null>(null);
  const[error,setError]=useState<string|null>(null);
  const[success,setSuccess]=useState(false);

  const load=async()=>{
    if(!supabase||!household)return;
    setLoading(true);setLoadError(null);setError(null);
    try{
      const [nextRows,nextParties]=await Promise.all([
        listExpenseRoleCorrectionPositions(supabase,household.id),
        listFinancialParties(supabase,household.id),
      ]);
      const eligible=initialTransactionId?nextRows.filter(row=>row.transaction_id===initialTransactionId):nextRows;
      setRows(eligible);
      setParties(nextParties);
      if(initialTransactionId&&eligible.length===0)setSelectedId('');
    }catch{
      setRows([]);setParties([]);setSelectedId('');
      setLoadError('Não foi possível conferir este compromisso agora.');
    }finally{setLoading(false);}
  };

  useEffect(()=>{void load();},[household?.id,initialTransactionId]);

  const selected=useMemo(()=>rows.find(row=>row.transaction_id===selectedId)??rows[0]??null,[rows,selectedId]);

  useEffect(()=>{
    if(!selected)return;
    setSelectedId(selected.transaction_id);
    const current=selected.responsibility.map(item=>item.party_id
      ? {kind:'party' as const,id:item.party_id,percentage:String(Number(item.percentage))}
      : item.member_id
        ? {kind:'member' as const,id:item.member_id,percentage:String(Number(item.percentage))}
        : null
    ).filter((item):item is Participant=>Boolean(item));
    setParticipants(current.length?current:[{kind:'member',id:selected.buyer_member_id??householdMembers[0]?.id??'',percentage:'100'}]);
    setSuccess(false);setError(null);
  },[selected?.transaction_id]);

  const amount=selected?.responsibility.reduce((sum,item)=>sum+Number(item.amount??0),0)||0;
  const totalPercentage=participants.reduce((sum,item)=>sum+(Number(item.percentage)||0),0);
  const canAdd=participants.length<3;
  const memberName=(id:string)=>householdMembers.find(member=>member.id===id)?.display_name??'Morador';
  const partyName=(id:string)=>parties.find(party=>party.id===id)?.name??'Terceiro';

  const updateParticipant=(index:number,patch:Partial<Participant>)=>{
    setParticipants(current=>current.map((item,itemIndex)=>itemIndex===index?{...item,...patch}:item));
    setError(null);setSuccess(false);
  };

  const removeParticipant=(index:number)=>{
    if(participants.length<=1)return;
    setParticipants(current=>current.filter((_,itemIndex)=>itemIndex!==index));
    setError(null);setSuccess(false);
  };

  const addThirdParty=()=>{
    if(!canAdd||parties.length===0)return;
    const next=[...participants,{kind:'party' as const,id:parties[0].id,percentage:'0'}];
    const equal=(100/next.length).toFixed(2);
    setParticipants(next.map(item=>({...item,percentage:equal})));
    setError(null);setSuccess(false);
  };

  const addMember=()=>{
    if(!canAdd)return;
    const available=householdMembers.find(member=>!participants.some(item=>item.kind==='member'&&item.id===member.id));
    if(!available)return;
    const next=[...participants,{kind:'member' as const,id:available.id,percentage:'0'}];
    const equal=(100/next.length).toFixed(2);
    setParticipants(next.map(item=>({...item,percentage:equal})));
    setError(null);setSuccess(false);
  };

  const setPreset=(mode:'single'|'equal')=>{
    if(!selected)return;
    if(mode==='single'){
      setParticipants([{kind:'member',id:selected.buyer_member_id??householdMembers[0]?.id??'',percentage:'100'}]);
    }else{
      const first=householdMembers[0]?.id??'';
      const second=householdMembers.find(member=>member.id!==first)?.id??'';
      if(!first||!second)return;
      setParticipants([{kind:'member',id:first,percentage:'50'},{kind:'member',id:second,percentage:'50'}]);
    }
    setError(null);setSuccess(false);
  };

  const submit=async()=>{
    if(!supabase||!household||!selected)return;
    const pctValues=participants.map(item=>Number(item.percentage));
    const duplicate=participants.some((item,index)=>participants.findIndex(candidate=>candidate.kind===item.kind&&candidate.id===item.id)!==index);
    if(participants.length<1||participants.length>3||participants.some(item=>!item.id)||pctValues.some(value=>!Number.isFinite(value)||value<=0)||Math.abs(totalPercentage-100)>0.001||duplicate){
      setError('Defina participantes diferentes e uma divisão que totalize 100%.');
      return;
    }
    setSaving(true);setError(null);setSuccess(false);
    try{
      await correctExpenseRoles(supabase,{
        householdId:household.id,
        transactionId:selected.transaction_id,
        buyerMemberId:selected.buyer_member_id,
        responsibility:participants.map(item=>item.kind==='member'
          ?{member_id:item.id,party_id:null,percentage:Number(item.percentage)}
          :{member_id:null,party_id:item.id,percentage:Number(item.percentage)}),
        reason:defaultReason,
      });
      setSuccess(true);
      await load();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Não foi possível atualizar a responsabilidade.');
    }finally{setSaving(false);}
  };

  if(loading)return <section className="rounded-2xl border border-cyan-900/40 bg-cyan-950/10 p-4"><div className="flex items-center gap-2 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin text-cyan-300"/>Conferindo o compromisso…</div></section>;
  if(loadError)return <section className="rounded-2xl border border-rose-900/70 bg-rose-950/20 p-4"><p role="alert" className="text-sm text-rose-200">{loadError}</p><button type="button" onClick={()=>void load()} className="mt-3 min-h-10 rounded-xl border border-rose-800 px-3 text-xs font-bold text-rose-200">Tentar novamente</button></section>;
  if(!selected)return null;

  const current=selected.responsibility.map(item=>item.party_id?partyName(item.party_id):item.member_id?memberName(item.member_id):'Participante').map((name,index)=>`${name} ${Number(selected.responsibility[index]?.percentage??0)}%`).join(' + ')||'Sem responsável definido';

  return <section className="rounded-2xl border border-cyan-900/45 bg-cyan-950/10 p-4">
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300"><Users className="h-4 w-4"/></span>
      <div className="min-w-0">
        <h2 className="font-bold text-slate-100">Quem fica com este compromisso?</h2>
        <p className="mt-1 text-xs leading-4 text-slate-500">Altere somente quem assume este valor. Quem comprou e quem pagou permanecem iguais.</p>
      </div>
    </div>

    <div className="mt-4 rounded-xl bg-slate-950/60 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Compromisso atual</p>
      <div className="mt-1 flex items-end justify-between gap-3"><strong className="text-sm text-slate-200">{current}</strong><span className="text-xs text-slate-500">{money(amount)}</span></div>
    </div>

    <div className="mt-4 grid gap-2">
      {participants.map((item,index)=><div key={`${item.kind}-${item.id}-${index}`} className="grid grid-cols-[92px_1fr_72px_36px] items-end gap-2 rounded-xl border border-slate-700 bg-slate-950/40 p-2.5">
        <label className="text-[10px] font-semibold text-slate-500">Tipo<select value={item.kind} onChange={event=>updateParticipant(index,{kind:event.target.value as Participant['kind'],id:event.target.value==='party'?(parties[0]?.id??''):(householdMembers[0]?.id??'')})} className="mt-1 min-h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"><option value="member">Morador</option><option value="party" disabled={parties.length===0}>Terceiro</option></select></label>
        <label className="text-[10px] font-semibold text-slate-500">Pessoa<select value={item.id} onChange={event=>updateParticipant(index,{id:event.target.value})} className="mt-1 min-h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200">{item.kind==='member'?householdMembers.map(member=><option key={member.id} value={member.id}>{member.display_name}</option>):parties.map(party=><option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
        <label className="text-[10px] font-semibold text-slate-500">%<input inputMode="decimal" value={item.percentage} onChange={event=>updateParticipant(index,{percentage:event.target.value})} className="mt-1 min-h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-center text-xs text-slate-200"/></label>
        <button type="button" disabled={participants.length<=1} onClick={()=>removeParticipant(index)} aria-label="Remover participante" className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-900 hover:text-slate-200 disabled:opacity-30"><X className="h-4 w-4"/></button>
      </div>)}
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={()=>setPreset('single')} className="min-h-9 rounded-xl border border-slate-700 px-3 text-xs font-bold text-slate-300">100% de um morador</button>
      {householdMembers.length>=2&&<button type="button" onClick={()=>setPreset('equal')} className="min-h-9 rounded-xl border border-slate-700 px-3 text-xs font-bold text-slate-300">Dividir entre vocês</button>}
      {canAdd&&parties.length>0&&<button type="button" onClick={addThirdParty} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-violet-800/70 bg-violet-950/20 px-3 text-xs font-bold text-violet-200"><Plus className="h-3.5 w-3.5"/>Adicionar terceiro</button>}
      {canAdd&&householdMembers.length>participants.filter(item=>item.kind==='member').length&&<button type="button" onClick={addMember} className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-slate-700 px-3 text-xs font-bold text-slate-300"><Plus className="h-3.5 w-3.5"/>Adicionar morador</button>}
    </div>

    <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-950/50 px-3 py-2 text-xs"><span className="text-slate-500">Total da responsabilidade</span><strong className={Math.abs(totalPercentage-100)<0.001?'text-emerald-300':'text-amber-300'}>{totalPercentage.toFixed(2)}%</strong></div>
    {error&&<p role="alert" className="mt-3 rounded-xl border border-rose-800 bg-rose-950/30 p-3 text-xs text-rose-200">{error}</p>}
    {success&&<p role="status" className="mt-3 rounded-xl border border-emerald-800 bg-emerald-950/30 p-3 text-xs text-emerald-200">Responsabilidade atualizada. O comprador e o pagamento histórico permaneceram iguais.</p>}

    <button type="button" onClick={()=>void submit()} disabled={saving||Math.abs(totalPercentage-100)>0.001} className="mt-4 min-h-11 w-full rounded-xl bg-cyan-700 px-3 text-sm font-bold text-white disabled:opacity-50">{saving?'Salvando…':'Salvar responsabilidade'}</button>
  </section>;
}
