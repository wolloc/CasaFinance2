import { useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { correctExpenseRoles, listExpenseRoleCorrectionPositions, type ExpenseRoleCorrectionPosition } from '../../finance/expenseRoleCorrections.js';

const money=(value:number|string|null|undefined)=>Number(value??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const defaultReason='Ajuste de responsabilidade do compromisso';

export function ExpenseRoleCorrectionAction({initialTransactionId}:{initialTransactionId?:string}={}){
  const{household,householdMembers}=useSupabaseAuth();
  const[rows,setRows]=useState<ExpenseRoleCorrectionPosition[]>([]);
  const[selectedId,setSelectedId]=useState('');
  const[firstMember,setFirstMember]=useState('');
  const[firstPct,setFirstPct]=useState('50');
  const[secondMember,setSecondMember]=useState('');
  const[mode,setMode]=useState<'single'|'split'>('single');
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[loadError,setLoadError]=useState<string|null>(null);
  const[error,setError]=useState<string|null>(null);
  const[success,setSuccess]=useState(false);

  const load=async()=>{
    if(!supabase||!household)return;
    setLoading(true);setLoadError(null);setError(null);
    try{
      const nextRows=await listExpenseRoleCorrectionPositions(supabase,household.id);
      const eligible=initialTransactionId?nextRows.filter(row=>row.transaction_id===initialTransactionId):nextRows;
      setRows(eligible);
      if(initialTransactionId&&eligible.length===0)setSelectedId('');
    }catch{
      setRows([]);
      setSelectedId('');
      setLoadError('Não foi possível conferir este compromisso agora.');
    }finally{setLoading(false);}
  };

  useEffect(()=>{void load();},[household?.id,initialTransactionId]);

  const selected=useMemo(()=>rows.find(row=>row.transaction_id===selectedId)??rows[0]??null,[rows,selectedId]);

  useEffect(()=>{
    if(!selected)return;
    setSelectedId(selected.transaction_id);
    const responsibility=selected.responsibility.filter(item=>item.member_id);
    if(responsibility.length>=2){
      setMode('split');
      setFirstMember(responsibility[0]?.member_id??'');
      setFirstPct(String(Number(responsibility[0]?.percentage??50)));
      setSecondMember(responsibility[1]?.member_id??'');
    }else{
      setMode('single');
      setFirstMember(responsibility[0]?.member_id??selected.buyer_member_id??householdMembers[0]?.id??'');
      setFirstPct('100');
      setSecondMember('');
    }
    setSuccess(false);setError(null);
  },[selected?.transaction_id]);

  const secondOptions=householdMembers.filter(member=>member.id!==firstMember);
  const secondName=householdMembers.find(member=>member.id===secondMember)?.display_name??'';

  const setSingle=(memberId:string)=>{
    setMode('single');setFirstMember(memberId);setFirstPct('100');setSecondMember('');setError(null);setSuccess(false);
  };

  const setSplit=()=>{
    const first=firstMember||householdMembers[0]?.id||'';
    const second=secondMember||householdMembers.find(member=>member.id!==first)?.id||'';
    setMode('split');setFirstMember(first);setSecondMember(second);setFirstPct('50');setError(null);setSuccess(false);
  };

  const submit=async()=>{
    if(!supabase||!household||!selected)return;
    const pct=Number(firstPct);
    if(!firstMember||!Number.isFinite(pct)||pct<=0||pct>=100||!secondMember||secondMember===firstMember){
      setError('Escolha duas pessoas e um percentual entre 1% e 99%.');
      return;
    }
    const responsibility=mode==='single'
      ?[{member_id:firstMember,percentage:100}]
      :[{member_id:firstMember,percentage:pct},{member_id:secondMember,percentage:100-pct}];
    setSaving(true);setError(null);setSuccess(false);
    try{
      await correctExpenseRoles(supabase,{
        householdId:household.id,
        transactionId:selected.transaction_id,
        buyerMemberId:selected.buyer_member_id,
        responsibility,
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

  const current=selected.responsibility.filter(item=>item.member_id).map(item=>`${householdMembers.find(member=>member.id===item.member_id)?.display_name??'Morador'} ${Number(item.percentage)}%`).join(' + ')||'Sem responsável definido';
  const amount=selected.responsibility.reduce((sum,item)=>sum+Number(item.amount??0),0)||0;
  const remaining=100-Number(firstPct||0);

  return <section className="rounded-2xl border border-cyan-900/45 bg-cyan-950/10 p-4">
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300"><Users className="h-4 w-4"/></span>
      <div className="min-w-0">
        <h2 className="font-bold text-slate-100">Quem fica com este compromisso?</h2>
        <p className="mt-1 text-xs leading-4 text-slate-500">Aqui você só ajusta a responsabilidade financeira. Quem comprou e quem pagou continuam iguais.</p>
      </div>
    </div>

    <div className="mt-4 rounded-xl bg-slate-950/60 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Hoje</p>
      <div className="mt-1 flex items-end justify-between gap-3"><strong className="text-sm text-slate-200">{current}</strong><span className="text-xs text-slate-500">{money(amount||selected.responsibility[0]?.amount)}</span></div>
    </div>

    <div className="mt-4 grid gap-2">
      {householdMembers.map(member=><button key={member.id} type="button" onClick={()=>setSingle(member.id)} className={`flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold transition-colors ${mode==='single'&&firstMember===member.id?'border-cyan-500 bg-cyan-500/10 text-cyan-100':'border-slate-700 bg-slate-950/40 text-slate-300'}`}><span>{member.display_name}</span>{mode==='single'&&firstMember===member.id?<Check className="h-4 w-4 text-cyan-300"/>:<span className="text-[11px] text-slate-600">100%</span>}</button>)}
      {householdMembers.length>=2&&<button type="button" onClick={setSplit} className={`flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold transition-colors ${mode==='split'?'border-cyan-500 bg-cyan-500/10 text-cyan-100':'border-slate-700 bg-slate-950/40 text-slate-300'}`}><span>Dividir entre vocês</span>{mode==='split'?<Check className="h-4 w-4 text-cyan-300"/>:<span className="text-[11px] text-slate-600">Personalizar</span>}</button>}
    </div>

    {mode==='split'&&<div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2 rounded-xl bg-slate-950/45 p-3">
      <label className="text-[11px] font-semibold text-slate-400">Pessoa<select value={firstMember} onChange={event=>setFirstMember(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-200">{householdMembers.map(member=><option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
      <label className="text-[11px] font-semibold text-slate-400">Parte<input inputMode="decimal" value={firstPct} onChange={event=>setFirstPct(event.target.value)} className="mt-1 min-h-10 w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 text-center text-sm text-slate-200"/></label>
      <div className="text-right text-[11px] font-semibold text-slate-500"><p>{secondName||'Outra pessoa'}</p><strong className="mt-2 block text-sm text-slate-300">{Number.isFinite(remaining)?Math.max(0,remaining):0}%</strong></div>
      <label className="col-span-3 text-[11px] font-semibold text-slate-400">Outra pessoa<select value={secondMember} onChange={event=>setSecondMember(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-200">{secondOptions.map(member=><option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
    </div>}

    {error&&<p role="alert" className="mt-3 rounded-xl border border-rose-800 bg-rose-950/30 p-3 text-xs text-rose-200">{error}</p>}
    {success&&<p role="status" className="mt-3 rounded-xl border border-emerald-800 bg-emerald-950/30 p-3 text-xs text-emerald-200">Responsabilidade atualizada. O comprador e o pagamento histórico permaneceram iguais.</p>}

    <button type="button" onClick={()=>void submit()} disabled={saving|| (mode==='split'&&(Number(firstPct)<=0||Number(firstPct)>=100))} className="mt-4 min-h-11 w-full rounded-xl bg-cyan-700 px-3 text-sm font-bold text-white disabled:opacity-50">{saving?'Salvando…':'Salvar responsabilidade'}</button>
  </section>;
}
