import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { HandHeart, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { forgiveThirdPartyPayable, listOpenThirdPartyObligations, type ThirdPartyObligation } from '../../finance/thirdPartyObligations.js';

const money=(value:unknown)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const normalizeAmount=(value:string)=>value.trim().replace(/\./g,'').replace(',','.');
const localDate=()=>{const now=new Date();const offset=now.getTimezoneOffset();return new Date(now.getTime()-offset*60_000).toISOString().slice(0,10);};

export function ThirdPartyPayableForgiveness({onBack}:{onBack:()=>void}){
  const{household,householdMembers}=useSupabaseAuth();
  const[payables,setPayables]=useState<ThirdPartyObligation[]>([]);
  const[obligationId,setObligationId]=useState('');
  const[amount,setAmount]=useState('');
  const[forgivenDate,setForgivenDate]=useState(localDate());
  const[percentages,setPercentages]=useState<Record<string,string>>({});
  const[notes,setNotes]=useState('');
  const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);
  const[error,setError]=useState<string|null>(null);const[success,setSuccess]=useState<string|null>(null);

  const load=async()=>{if(!supabase||!household)return;setLoading(true);setError(null);try{const rows=await listOpenThirdPartyObligations(supabase,household.id);setPayables(rows.filter(row=>row.kind==='payable'));}catch{setError('Não foi possível carregar os valores a pagar.');}finally{setLoading(false);}};
  useEffect(()=>{load();},[household?.id]);
  const selected=useMemo(()=>payables.find(row=>row.id===obligationId),[payables,obligationId]);
  const percentageTotal=useMemo(()=>householdMembers.reduce((sum,member)=>sum+(Number((percentages[member.id]??'0').replace(',','.'))||0),0),[householdMembers,percentages]);

  const choose=(id:string)=>{setObligationId(id);const row=payables.find(item=>item.id===id);setAmount(row?row.outstanding_amount.toFixed(2).replace('.',','):'');setPercentages({});setError(null);setSuccess(null);};
  const setAllTo=(memberId:string)=>{const next:Record<string,string>={};for(const member of householdMembers)next[member.id]=member.id===memberId?'100':'0';setPercentages(next);};

  const submit=async(event:FormEvent)=>{event.preventDefault();if(!supabase||!household||!selected)return;const normalized=normalizeAmount(amount);const numeric=Number(normalized);if(!Number.isFinite(numeric)||numeric<=0){setError('Informe um valor maior que zero.');return;}if(numeric>selected.outstanding_amount){setError('O perdão não pode superar o saldo ainda devido.');return;}if(Math.abs(percentageTotal-100)>0.000001){setError('Defina quem recebe o benefício econômico do perdão. Os percentuais precisam totalizar 100%.');return;}const allocations=householdMembers.map(member=>({memberId:member.id,percentage:Number((percentages[member.id]??'0').replace(',','.'))||0})).filter(item=>item.percentage>0);setSaving(true);setError(null);setSuccess(null);try{await forgiveThirdPartyPayable(supabase,{householdId:household.id,obligationId:selected.id,amount:normalized,forgivenDate,allocations,notes});setSuccess('Perdão registrado: a obrigação diminuiu e nasceu um ganho econômico, mas nenhum dinheiro entrou ou saiu e nenhum pagamento foi inventado.');setObligationId('');setAmount('');setPercentages({});setNotes('');await load();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível registrar o perdão da dívida.');}finally{setSaving(false);}};

  return <div className="space-y-4"><button type="button" onClick={onBack} className="text-sm font-semibold text-blue-300">← Voltar às intenções</button>{loading?<LoaderCircle className="mx-auto h-6 w-6 animate-spin"/>:<form onSubmit={submit} className="space-y-4 rounded-2xl border border-emerald-900/70 bg-emerald-950/20 p-4">
    <div><h2 className="font-bold">Dívida perdoada por outra pessoa</h2><p className="mt-1 text-sm text-slate-400">Use quando a dívida existia de verdade, mas o credor abriu mão de receber parte ou todo o saldo.</p></div>
    <div className="rounded-xl border border-blue-900 bg-blue-950/30 p-3 text-xs text-blue-200"><HandHeart className="mr-1 inline h-4 w-4"/><strong>Não é pagamento:</strong> o passivo diminui, mas nenhuma conta bancária é debitada. Como a Casa deixou de dever um valor real, existe ganho econômico sem entrada de caixa.</div>
    <label className="block text-sm">Qual dívida foi perdoada?<select value={obligationId} onChange={event=>choose(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{payables.map(item=><option key={item.id} value={item.id}>A pagar para {item.counterparty_name} · {money(item.outstanding_amount)}</option>)}</select></label>
    {selected&&<div className="rounded-xl bg-slate-950 p-3 text-sm"><p className="font-semibold">{selected.description}</p><p className="mt-1 text-slate-400">Original: {money(selected.original_amount)} · já pago/baixado: {money(selected.settled_amount)} · ainda devido: <strong className="text-amber-200">{money(selected.outstanding_amount)}</strong></p></div>}
    {selected&&<><label className="block text-sm">Quanto foi perdoado?<input inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/></label><label className="block text-sm">Data em que o perdão aconteceu<input type="date" value={forgivenDate} onChange={event=>setForgivenDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/></label>
    <fieldset className="space-y-3 rounded-xl border border-slate-800 p-3"><legend className="px-1 text-sm font-semibold">Quem recebe economicamente esse benefício?</legend><p className="text-xs text-slate-400">Não usamos quem criou a dívida, titular de conta ou quem pagaria como atalho. Declare o benefício explicitamente.</p>{householdMembers.map(member=><div key={member.id} className="grid grid-cols-[1fr_7rem] items-center gap-3"><button type="button" onClick={()=>setAllTo(member.id)} className="text-left text-sm text-blue-300">100% {member.display_name}</button><label className="text-xs text-slate-400"><span className="sr-only">Percentual de {member.display_name}</span><input inputMode="decimal" value={percentages[member.id]??''} onChange={event=>setPercentages(current=>({...current,[member.id]:event.target.value}))} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-right" placeholder="0"/>%</label></div>)}<p className={`text-right text-xs font-semibold ${Math.abs(percentageTotal-100)<0.000001?'text-emerald-300':'text-amber-300'}`}>Total: {percentageTotal.toLocaleString('pt-BR')}%</p></fieldset>
    <label className="block text-sm">Motivo / observação<textarea value={notes} onChange={event=>setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Ex.: credor decidiu perdoar o saldo restante"/></label></>}
    {payables.length===0&&<p className="rounded-xl bg-slate-950 p-3 text-sm text-slate-400">Não há valores a pagar em aberto para registrar perdão.</p>}{error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}{success&&<p role="status" className="text-sm text-emerald-300">{success}</p>}
    <button type="submit" disabled={saving||!selected} className="min-h-12 w-full rounded-xl bg-emerald-700 font-bold disabled:opacity-50">{saving?'Registrando…':'Registrar perdão sem inventar pagamento'}</button>
  </form>}</div>;
}
