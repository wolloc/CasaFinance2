import { useEffect, useState, type FormEvent } from 'react';
import { CalendarClock, CircleDollarSign, LoaderCircle, X } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdCategories, type HouseholdCategory } from '../../finance/householdCategories.js';
import { createIncomeFact, incomeNatureLabels, type IncomeConfidence, type IncomeNature } from '../../finance/incomeFacts.js';
import { isTransactionalResource, listInvestmentReserveResources, type InvestmentReserveResource } from '../../finance/investmentReserveAdjustments.js';
import { listIncomeDestinationAccounts } from '../../finance/householdFinancialAccounts.js';
import { dateInTimeZone, DEFAULT_HOUSEHOLD_TIMEZONE } from '../../finance/householdClock.js';
import { createRecurringIncomeRule, recurringIncomeEndDate, type RecurringIncomeFrequency } from '../../finance/recurringIncome.js';

const normalizeAmount=(value:string)=>value.trim().replace(/\./g,'').replace(',','.');
type IncomeDestination=InvestmentReserveResource&{ownerMemberIds:string[]};

export function IncomeCreationAction({onCreated,openRequestId=0}:{onCreated?:()=>void;openRequestId?:number}){
 const{household,householdMembers}=useSupabaseAuth();
 const[categories,setCategories]=useState<HouseholdCategory[]>([]);
 const[resources,setResources]=useState<IncomeDestination[]>([]);
 const[description,setDescription]=useState('');
 const[amount,setAmount]=useState('');
 const[expectedDate,setExpectedDate]=useState(()=>dateInTimeZone(household?.timezone??DEFAULT_HOUSEHOLD_TIMEZONE));
 const[categoryId,setCategoryId]=useState('');
 const[beneficiaryMemberId,setBeneficiaryMemberId]=useState('');
 const[plannedDestinationAccountId,setPlannedDestinationAccountId]=useState('');
 const[incomeNature,setIncomeNature]=useState<IncomeNature>('salary');
 const[economicState,setEconomicState]=useState<IncomeConfidence>('confirmed');
 const[notes]=useState('');
 const[recurring,setRecurring]=useState(false);
 const[recurringFrequency,setRecurringFrequency]=useState<RecurringIncomeFrequency>('monthly');
 const[recurringDuration,setRecurringDuration]=useState<'1'|'2'|'3'|'6'|'12'|'ongoing'|'custom'>('12');
 const[customRecurringCount,setCustomRecurringCount]=useState(5);
 const[loading,setLoading]=useState(true);
 const[saving,setSaving]=useState(false);
 const[loadError,setLoadError]=useState<string|null>(null);
 const[error,setError]=useState<string|null>(null);
 const[open,setOpen]=useState(false);
 const[handledRequestId,setHandledRequestId]=useState(0);

 const clearLoadedContext=()=>{setCategories([]);setResources([]);setCategoryId('');setPlannedDestinationAccountId('');};
 const load=async()=>{if(!supabase||!household)return;setLoading(true);setLoadError(null);setError(null);try{
  const[categoryRows,balanceRows,financial]=await Promise.all([
   listHouseholdCategories(supabase,household.id),
   listInvestmentReserveResources(supabase,household.id),
   listIncomeDestinationAccounts(supabase,household.id),
  ]);
  const accountById=new Map(financial.map(account=>[account.id,account]));
  setCategories(categoryRows.filter(category=>category.type==='income'));
  setResources(balanceRows.filter(isTransactionalResource).flatMap(resource=>{
   const account=accountById.get(resource.account_id);
   if(!account)return[];
   const ownerMemberIds=account.owner_member_ids?.length?account.owner_member_ids:account.owner_member_id?[account.owner_member_id]:[];
   return[{...resource,ownerMemberIds}];
  }));
 }catch{clearLoadedContext();setLoadError('Não foi possível conferir os dados necessários para registrar esta entrada.');}finally{setLoading(false);}};

 useEffect(()=>{void load();},[household?.id]);
 useEffect(()=>{if(openRequestId>0&&openRequestId!==handledRequestId){setHandledRequestId(openRequestId);setOpen(true);setError(null);setExpectedDate(dateInTimeZone(household?.timezone??DEFAULT_HOUSEHOLD_TIMEZONE));setBeneficiaryMemberId('');setPlannedDestinationAccountId('');setEconomicState('confirmed');setRecurring(false);setRecurringFrequency('monthly');setRecurringDuration('12');setCustomRecurringCount(5);}},[openRequestId,handledRequestId,household?.timezone]);

 const compatibleResources=beneficiaryMemberId?resources.filter(resource=>resource.ownerMemberIds.includes(beneficiaryMemberId)):[];
 const ownerLabel=(resource:IncomeDestination)=>{
  const names=resource.ownerMemberIds.map(id=>householdMembers.find(member=>member.id===id)?.display_name??'Titular');
  return names.length>1?`Conjunta · ${names.join(' + ')}`:`Titular · ${names[0]??'não identificado'}`;
 };
 const chooseBeneficiary=(memberId:string)=>{
  setBeneficiaryMemberId(memberId);
  if(!resources.some(resource=>resource.account_id===plannedDestinationAccountId&&resource.ownerMemberIds.includes(memberId)))setPlannedDestinationAccountId('');
 };
 const recurrenceCount=recurringDuration==='ongoing'?null:recurringDuration==='custom'?customRecurringCount:Number(recurringDuration);
 const recurrenceEndDate=recurring&&recurrenceCount?recurringIncomeEndDate(expectedDate,recurringFrequency,recurrenceCount):'';
 const chooseRecurringFrequency=(frequency:RecurringIncomeFrequency)=>{setRecurringFrequency(frequency);setRecurringDuration(frequency==='monthly'?'12':'3');setCustomRecurringCount(frequency==='monthly'?5:2);};

 const submit=async(event:FormEvent)=>{
  event.preventDefault();
  if(loadError||loading){setError('Recarregue os dados da Casa antes de criar a entrada.');return;}
  if(!supabase||!household)return;
  const normalized=normalizeAmount(amount);
  const numericAmount=Number(normalized);
  if(!beneficiaryMemberId){setError('Informe de quem é esta entrada.');return;}
  if(!plannedDestinationAccountId||!compatibleResources.some(resource=>resource.account_id===plannedDestinationAccountId)){setError('Escolha uma conta compatível com a pessoa que recebe esta entrada.');return;}
  if(!description.trim()){setError('Conte ao Casa de onde vem esta entrada.');return;}
  if(!Number.isFinite(numericAmount)||numericAmount<=0){setError('Informe um valor maior que zero.');return;}
  setSaving(true);setError(null);
  try{
   if(recurring){
    await createRecurringIncomeRule(supabase,{householdId:household.id,description,amount:normalized,startDate:expectedDate,endDate:recurrenceEndDate,frequency:recurringFrequency,categoryId:categoryId||null,beneficiaryMemberId,plannedDestinationAccountId,incomeNature,economicState,notes});
   }else{
    await createIncomeFact(supabase,{householdId:household.id,description,amount:normalized,expectedDate,categoryId:categoryId||null,beneficiaryMemberId,plannedDestinationAccountId,incomeNature,economicState,notes});
   }
   setDescription('');setAmount('');setCategoryId('');setPlannedDestinationAccountId('');setRecurring(false);setOpen(false);onCreated?.();
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
     <fieldset><legend className="text-sm font-semibold">De quem é esta entrada?</legend><div className="mt-2 grid grid-cols-2 gap-2">{householdMembers.map((member,index)=><button autoFocus={index===0} type="button" key={member.id} aria-pressed={beneficiaryMemberId===member.id} onClick={()=>chooseBeneficiary(member.id)} className={`min-h-12 rounded-xl border px-3 text-sm font-bold ${beneficiaryMemberId===member.id?'border-emerald-500 bg-emerald-950/40 text-emerald-200':'border-slate-700 bg-slate-950 text-slate-300'}`}>{member.display_name}</button>)}</div></fieldset>
     {beneficiaryMemberId&&<label className="text-sm font-semibold">Onde deve entrar?<select value={plannedDestinationAccountId} onChange={e=>setPlannedDestinationAccountId(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">Selecione</option>{compatibleResources.map(resource=><option key={resource.account_id} value={resource.account_id}>{resource.name} · {ownerLabel(resource)}</option>)}</select>{compatibleResources.length===0?<span className="mt-1 block text-xs font-normal text-amber-300">Não há conta transacional cadastrada para esta pessoa. Uma conta conjunta aparece aqui quando ela é titular.</span>:<span className="mt-1 block text-xs font-normal text-slate-500">Só aparecem contas desta pessoa e contas conjuntas das quais ela participa.</span>}<span className="mt-1 block text-xs font-normal text-slate-500">Escolher o destino não significa dinheiro recebido: o saldo só muda quando o recebimento acontecer de verdade.</span></label>}
     <label className="text-sm font-semibold">Valor<input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" className="mt-1 min-h-14 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 text-2xl font-black" placeholder="R$ 0,00"/></label>
     <label className="text-sm font-semibold">De onde vem?<input value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base" placeholder="Ex.: Salário Itaú"/></label>
     <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Tipo<select value={incomeNature} onChange={e=>setIncomeNature(e.target.value as IncomeNature)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3">{Object.entries(incomeNatureLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold">Quando?<input type="date" value={expectedDate} onChange={e=>setExpectedDate(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"/></label></div>
     <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Situação<select value={economicState} onChange={e=>setEconomicState(e.target.value as IncomeConfidence)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="confirmed">Confirmada</option><option value="forecast">Ainda é previsão</option></select><span className="mt-1 block text-xs font-normal text-slate-500">Confirmada significa que a entrada é conhecida; não significa recebida.</span></label><label className="text-sm font-semibold">Categoria <span className="font-normal text-slate-500">(opcional)</span><select value={categoryId} onChange={e=>setCategoryId(e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">Sem categoria</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
     <section className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4" aria-label="Recorrência opcional da entrada"><div className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300"><CalendarClock className="h-5 w-5"/></span><div className="min-w-0 flex-1"><p className="font-semibold text-slate-200">Repetir esta entrada</p><p className="mt-0.5 text-xs text-slate-500">Opcional · cada recebimento continua sendo uma ocorrência separada.</p></div><button type="button" aria-pressed={recurring} onClick={()=>setRecurring(value=>!value)} className={`min-h-10 shrink-0 rounded-xl px-3 text-sm font-bold ${recurring?'bg-slate-800 text-slate-200':'bg-emerald-500/10 text-emerald-300'}`}>{recurring?'Remover':'Adicionar'}</button></div>{recurring&&<div className="mt-4 space-y-4 border-t border-slate-800 pt-4"><fieldset><legend className="text-sm font-semibold text-slate-200">Como ela se repete?</legend><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" aria-pressed={recurringFrequency==='monthly'} onClick={()=>chooseRecurringFrequency('monthly')} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${recurringFrequency==='monthly'?'border-emerald-500 bg-emerald-950/40 text-emerald-200':'border-slate-700 text-slate-400'}`}>Todo mês</button><button type="button" aria-pressed={recurringFrequency==='yearly'} onClick={()=>chooseRecurringFrequency('yearly')} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${recurringFrequency==='yearly'?'border-emerald-500 bg-emerald-950/40 text-emerald-200':'border-slate-700 text-slate-400'}`}>Todo ano</button></div></fieldset><fieldset><legend className="text-sm font-semibold text-slate-200">Por quanto tempo?</legend><div className="mt-2 grid grid-cols-2 gap-2">{(recurringFrequency==='monthly'?(['3','6','12'] as const):(['1','2','3'] as const)).map(value=><button key={value} type="button" aria-pressed={recurringDuration===value} onClick={()=>setRecurringDuration(value)} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${recurringDuration===value?'border-emerald-500 bg-emerald-950/40 text-emerald-200':'border-slate-700 text-slate-400'}`}>{value} {recurringFrequency==='monthly'?(value==='1'?'mês':'meses'):(value==='1'?'ano':'anos')}</button>)}<button type="button" aria-pressed={recurringDuration==='ongoing'} onClick={()=>setRecurringDuration('ongoing')} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${recurringDuration==='ongoing'?'border-emerald-500 bg-emerald-950/40 text-emerald-200':'border-slate-700 text-slate-400'}`}>Até eu parar</button></div><button type="button" onClick={()=>setRecurringDuration('custom')} className={`mt-2 min-h-10 rounded-xl border px-3 text-xs font-semibold ${recurringDuration==='custom'?'border-emerald-500 bg-emerald-950/40 text-emerald-200':'border-slate-700 text-slate-400'}`}>Outro período</button>{recurringDuration==='custom'&&<label className="mt-2 block text-sm text-slate-300">Quantas ocorrências?<input type="number" min="1" max="120" value={customRecurringCount} onChange={e=>setCustomRecurringCount(Math.max(1,Math.min(120,Number(e.target.value)||1)))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"/><span className="mt-1 block text-[11px] text-slate-500">Conta a partir da primeira entrada informada.</span></label>}<p className="mt-2 text-[11px] text-slate-500">{recurringDuration==='ongoing'?'A série continua até você encerrar.':`${recurrenceCount} ocorrências na série · término calculado automaticamente.`}</p></fieldset><p className="rounded-xl bg-slate-900/70 p-3 text-xs text-slate-400">A primeira ocorrência é esta entrada de {expectedDate}. As próximas ficam projetadas e nenhuma altera o saldo até o recebimento real.</p></div>}</section>
     {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
     <button disabled={saving||!beneficiaryMemberId||compatibleResources.length===0} className="min-h-12 rounded-2xl bg-emerald-600 px-4 font-bold disabled:opacity-50">{saving?'Salvando…':'Salvar entrada'}</button>
    </form>}
   </div>
  </section>
 </div>;
}
