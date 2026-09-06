import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listOpenThirdPartyObligations, writeOffThirdPartyReceivable, type ThirdPartyObligation } from '../../finance/thirdPartyObligations.js';

const formatMoney=(value:unknown)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const normalizeAmount=(value:string)=>value.trim().replace(/\./g,'').replace(',','.');
const localDate=()=>{const now=new Date();const offset=now.getTimezoneOffset();return new Date(now.getTime()-offset*60_000).toISOString().slice(0,10);};

export function ThirdPartyReceivableWriteOff({onBack}:{onBack:()=>void}){
  const{household,householdMembers}=useSupabaseAuth();
  const[receivables,setReceivables]=useState<ThirdPartyObligation[]>([]);
  const[obligationId,setObligationId]=useState('');
  const[amount,setAmount]=useState('');
  const[lossDate,setLossDate]=useState(localDate());
  const[percentages,setPercentages]=useState<Record<string,string>>({});
  const[notes,setNotes]=useState('');
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState<string|null>(null);
  const[success,setSuccess]=useState<string|null>(null);

  const load=async()=>{if(!supabase||!household)return;setLoading(true);setError(null);try{const rows=await listOpenThirdPartyObligations(supabase,household.id);setReceivables(rows.filter(row=>row.kind==='receivable'));}catch{setError('Não foi possível carregar os valores a receber.');}finally{setLoading(false);}};
  useEffect(()=>{load();},[household?.id]);
  const selected=useMemo(()=>receivables.find(row=>row.id===obligationId),[receivables,obligationId]);
  const percentageTotal=useMemo(()=>householdMembers.reduce((sum,member)=>sum+(Number((percentages[member.id]??'0').replace(',','.'))||0),0),[householdMembers,percentages]);

  const chooseReceivable=(id:string)=>{setObligationId(id);const row=receivables.find(item=>item.id===id);setAmount(row?row.outstanding_amount.toFixed(2).replace('.',','):'');setPercentages({});setError(null);setSuccess(null);};
  const setAllTo=(memberId:string)=>{const next:Record<string,string>={};for(const member of householdMembers)next[member.id]=member.id===memberId?'100':'0';setPercentages(next);};

  const submit=async(event:FormEvent)=>{event.preventDefault();if(!supabase||!household||!selected)return;const normalized=normalizeAmount(amount);const numeric=Number(normalized);if(!Number.isFinite(numeric)||numeric<=0){setError('Informe um valor de perda maior que zero.');return;}if(numeric>selected.outstanding_amount){setError('A baixa não pode superar o saldo ainda a receber.');return;}const allocations=householdMembers.map(member=>({memberId:member.id,percentage:Number((percentages[member.id]??'0').replace(',','.'))||0})).filter(item=>item.percentage>0);if(Math.abs(percentageTotal-100)>0.000001){setError('Defina quem assume economicamente a perda. Os percentuais precisam totalizar 100%.');return;}setSaving(true);setError(null);setSuccess(null);try{await writeOffThirdPartyReceivable(supabase,{householdId:household.id,obligationId:selected.id,amount:normalized,lossDate,allocations,notes});setSuccess('Baixa registrada como perda econômica. Nenhum dinheiro entrou ou saiu: o valor a receber diminuiu e a perda ficou vinculada à obrigação original.');setObligationId('');setAmount('');setPercentages({});setNotes('');await load();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível registrar a baixa.');}finally{setSaving(false);}};

  return <div className="space-y-4"><button type="button" onClick={onBack} className="text-sm font-semibold text-blue-300">← Voltar às intenções</button>{loading?<LoaderCircle className="mx-auto h-6 w-6 animate-spin"/>:<form onSubmit={submit} className="space-y-4 rounded-2xl border border-rose-900/70 bg-rose-950/20 p-4">
    <div><h2 className="font-bold">Dar baixa em valor que não será recebido</h2><p className="mt-1 text-sm text-slate-400">Use quando a dívida existia de verdade, mas parte ou todo o saldo ficou incobrável. Isso é diferente de corrigir um lançamento feito por engano.</p></div>
    <div className="rounded-xl border border-amber-900 bg-amber-950/20 p-3 text-xs text-amber-200"><AlertTriangle className="mr-1 inline h-4 w-4"/><strong>Não é cancelamento neutro:</strong> abrir mão de um valor que a Casa realmente tinha direito de receber cria uma perda econômica. Não cria saída de caixa, porque o dinheiro já não estava disponível.</div>
    <label className="block text-sm">Qual valor não será recebido?<select value={obligationId} onChange={event=>chooseReceivable(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{receivables.map(item=><option key={item.id} value={item.id}>A receber de {item.counterparty_name} · {formatMoney(item.outstanding_amount)}</option>)}</select></label>
    {selected&&<div className="rounded-xl bg-slate-950 p-3 text-sm"><p className="font-semibold">{selected.description}</p><p className="mt-1 text-slate-400">Original: {formatMoney(selected.original_amount)} · já liquidado/baixado: {formatMoney(selected.settled_amount)} · ainda a receber: <strong className="text-amber-200">{formatMoney(selected.outstanding_amount)}</strong></p></div>}
    {selected&&<><label className="block text-sm">Quanto ficou perdido?<input inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/></label><label className="block text-sm">Data em que a perda foi reconhecida<input type="date" value={lossDate} onChange={event=>setLossDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/></label>
    <fieldset className="space-y-3 rounded-xl border border-slate-800 p-3"><legend className="px-1 text-sm font-semibold">Quem assume economicamente essa perda?</legend><p className="text-xs text-slate-400">Isso não é quem emprestou nem quem receberia por padrão. Informe explicitamente de quem é a perda econômica.</p>{householdMembers.map(member=><div key={member.id} className="grid grid-cols-[1fr_7rem] items-center gap-3"><button type="button" onClick={()=>setAllTo(member.id)} className="text-left text-sm text-blue-300">100% {member.display_name}</button><label className="text-xs text-slate-400"><span className="sr-only">Percentual de {member.display_name}</span><input inputMode="decimal" value={percentages[member.id]??''} onChange={event=>setPercentages(current=>({...current,[member.id]:event.target.value}))} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-right" placeholder="0"/>%</label></div>)}<p className={`text-right text-xs font-semibold ${Math.abs(percentageTotal-100)<0.000001?'text-emerald-300':'text-amber-300'}`}>Total: {percentageTotal.toLocaleString('pt-BR')}%</p></fieldset>
    <label className="block text-sm">Motivo / observação<textarea value={notes} onChange={event=>setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Ex.: pessoa não tem mais condição de pagar e decidimos encerrar a cobrança"/></label></>}
    {receivables.length===0&&<p className="rounded-xl bg-slate-950 p-3 text-sm text-slate-400">Não há valores a receber em aberto para dar baixa.</p>}{error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}{success&&<p role="status" className="text-sm text-emerald-300">{success}</p>}
    <button type="submit" disabled={saving||!selected} className="min-h-12 w-full rounded-xl bg-rose-700 font-bold disabled:opacity-50">{saving?'Registrando…':'Reconhecer perda sem movimentar caixa'}</button>
  </form>}</div>;
}
