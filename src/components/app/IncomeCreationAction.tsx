import { useEffect, useState, type FormEvent } from 'react';
import { CircleDollarSign, LoaderCircle, X } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdCategories, type HouseholdCategory } from '../../finance/householdCategories.js';
import { createIncomeFact, incomeNatureLabels, type IncomeConfidence, type IncomeNature } from '../../finance/incomeFacts.js';
import { isTransactionalResource, listInvestmentReserveResources, type InvestmentReserveResource } from '../../finance/investmentReserveAdjustments.js';
import { dateInTimeZone, DEFAULT_HOUSEHOLD_TIMEZONE } from '../../finance/householdClock.js';

const normalizeAmount=(value:string)=>value.trim().replace(/\./g,'').replace(',','.');

export function IncomeCreationAction({onCreated,openRequestId=0}:{onCreated?:()=>void;openRequestId?:number}){
 const{household,householdMembers}=useSupabaseAuth();
 const[categories,setCategories]=useState<HouseholdCategory[]>([]);
 const[resources,setResources]=useState<InvestmentReserveResource[]>([]);
 const[description,setDescription]=useState('');
 const[amount,setAmount]=useState('');
 const[expectedDate,setExpectedDate]=useState(()=>dateInTimeZone(household?.timezone??DEFAULT_HOUSEHOLD_TIMEZONE));
 const[categoryId,setCategoryId]=useState('');
 const[beneficiaryMemberId,setBeneficiaryMemberId]=useState('');
 const[plannedDestinationAccountId,setPlannedDestinationAccountId]=useState('');
 const[incomeNature,setIncomeNature]=useState<IncomeNature>('salary');
 const[economicState,setEconomicState]=useState<IncomeConfidence>('forecast');
 const[notes,setNotes]=useState('');
 const[loading,setLoading]=useState(true);
 const[saving,setSaving]=useState(false);
 const[loadError,setLoadError]=useState<string|null>(null);
 const[error,setError]=useState<string|null>(null);
 const[open,setOpen]=useState(false);
 const[handledRequestId,setHandledRequestId]=useState(0);

 const clearLoadedContext=()=>{setCategories([]);setResources([]);setCategoryId('');setPlannedDestinationAccountId('');};
 const load=async()=>{if(!supabase||!household)return;setLoading(true);setLoadError(null);setError(null);try{const[categoryRows,accountRows]=await Promise.all([listHouseholdCategories(supabase,household.id),listInvestmentReserveResources(supabase,household.id)]);setCategories(categoryRows.filter(category=>category.type==='income'));setResources(accountRows.filter(isTransactionalResource));}catch{clearLoadedContext();setLoadError('Não foi possível conferir os dados necessários para registrar esta entrada.');}finally{setLoading(false);}};

 useEffect(()=>{void load();},[household?.id]);
 useEffect(()=>{if(openRequestId>0&&openRequestId!==handledRequestId){setHandledRequestId(openRequestId);setOpen(true);setError(null);setExpectedDate(dateInTimeZone(household?.timezone??DEFAULT_HOUSEHOLD_TIMEZONE));}},[openRequestId,handledRequestId,household?.timezone]);

 const submit=async(event:FormEvent)=>{
  event.preventDefault();
  if(loadError||loading){setError('Recarregue os dados da Casa antes de criar a entrada.');return;}
  if(!supabase||!household)return;
  const normalized=normalizeAmount(amount);
  const numericAmount=Number(normalized);
  if(!description.trim()){setError('Conte ao Casa de onde vem esta entrada.');return;}
  if(!Number.isFinite(numericAmount)||numericAmount<=0){setError('Informe um valor maior que zero.');return;}
  if(!beneficiaryMemberId){setError('Informe de quem é esta entrada.');return;}
  if(!plannedDestinationAccountId){setError('Informe onde espera receber este dinheiro.');return;}
  setSaving(true);setError(null);
  try{
   await createIncomeFact(supabase,{householdId:household.id,description,amount:normalized,expectedDate,categoryId:categoryId||null,beneficiaryMemberId,plannedDestinationAccountId,incomeNature,economicState,notes});
   setDescription('');setAmount('');setCategoryId('');setNotes('');setOpen(false);onCreated?.();
  }catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível criar a entrada.');}
  finally{setSaving(false);}
 };

 if(!open)return null;
 return <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center">
  <section role="dialog" aria-modal="true" aria-label="Nova entrada" className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-slate-900 shadow-2xl">
   <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
    <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300"><CircleDollarSign className="h-5 w-5"/></span><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Entrada</p><h2 className="text-lg font-black">Nova entrada</h2></div></div>
    <button type="button" aria-label="Fechar nova entrada" onClick={()=>setOpen(false)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-800 text-slate-300"><X className="h-5 w-5"/></button>
   </header>
   <div className="p-4">
    {loading?<LoaderCircle className="mx-auto my-8 h-5 w-5 animate-spin"/>:loadError?<div className="rounded-xl border border-rose-900 bg-rose-950/30 p-3"><p role="alert" className="text-sm text-rose-200">{loadError}</p><button type="button" onClick={()=>void load()} className="mt-3 min-h-11 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200">Tentar novamente</button></div>:<form onSubmit={submit} className="grid gap-4">
     <label className="text-sm font-semibold">Valor<input autoFocus value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" className="mt-1 min-h-14 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-2xl font-black" placeholder="R$ 0,00"/></label>
     <label className="text-sm font-semibold">De onde vem?<input value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base" placeholder="Ex.: Salário Itaú"/></label>
     <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Tipo<select value={incomeNature} onChange={e=>setIncomeNature(e.target.value as IncomeNature)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3">{Object.entries(incomeNatureLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold">Quando?<input type="date" value={expectedDate} onChange={e=>setExpectedDate(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"/></label></div>
     <label className="text-sm font-semibold">De quem é?<select value={beneficiaryMemberId} onChange={e=>setBeneficiaryMemberId(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">Selecione</option>{householdMembers.map(member=><option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
     <label className="text-sm font-semibold">Onde deve entrar?<select value={plannedDestinationAccountId} onChange={e=>setPlannedDestinationAccountId(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">Selecione</option>{resources.map(resource=><option key={resource.account_id} value={resource.account_id}>{resource.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">O saldo só muda quando o recebimento acontecer de verdade.</span></label>
     <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Confiança<select value={economicState} onChange={e=>setEconomicState(e.target.value as IncomeConfidence)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="forecast">Prevista</option><option value="confirmed">Confirmada</option></select></label><label className="text-sm font-semibold">Categoria <span className="font-normal text-slate-500">(opcional)</span><select value={categoryId} onChange={e=>setCategoryId(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">Sem categoria</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
     <details className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-300">Adicionar observação</summary><textarea value={notes} onChange={e=>setNotes(e.target.value)} className="mt-3 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-900 p-3"/></details>
     {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
     <button disabled={saving||resources.length===0} className="min-h-12 rounded-2xl bg-emerald-600 px-4 font-bold disabled:opacity-50">{saving?'Salvando…':'Salvar entrada'}</button>
    </form>}
   </div>
  </section>
 </div>;
}
