import { useEffect,useMemo,useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listLoanPayerPlan,setLoanPayerPlan } from '../../finance/loanPrincipals.js';

export function LoanPayerPlanEditor({loanId,onUpdated}:{loanId:string;onUpdated?:()=>void}){
 const{household,householdMembers}=useSupabaseAuth();
 const[choice,setChoice]=useState('shared');
 const[loading,setLoading]=useState(true);
 const[saving,setSaving]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const currentLabel=useMemo(()=>choice==='shared'?'Dividido':householdMembers.find(m=>m.id===choice)?.display_name??'Não definido',[choice,householdMembers]);

 useEffect(()=>{let cancelled=false;if(!supabase||!household)return;setLoading(true);listLoanPayerPlan(supabase,household.id,loanId).then(rows=>{if(cancelled)return;if(rows.length===1&&Number(rows[0].percentage)===100)setChoice(rows[0].memberId);else if(rows.length>0)setChoice('shared');}).catch(()=>{if(!cancelled)setError('Não foi possível conferir quem está responsável pelas parcelas.')}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true};},[household?.id,loanId]);

 const save=async()=>{if(!supabase||!household)return;setSaving(true);setError(null);try{const allocations=choice==='shared'?householdMembers.map((member,index)=>({memberId:member.id,percentage:index===householdMembers.length-1?100-(Math.floor((100/householdMembers.length)*10000)/10000)*(householdMembers.length-1):Math.floor((100/householdMembers.length)*10000)/10000})):[{memberId:choice,percentage:100}];await setLoanPayerPlan(supabase,{householdId:household.id,obligationId:loanId,allocations});onUpdated?.();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível atualizar a responsabilidade das parcelas.')}finally{setSaving(false)}};

 if(loading)return <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-blue-300"/>;
 return <section className="rounded-2xl border border-blue-900/40 bg-blue-950/10 p-4">
  <div><h3 className="font-bold text-blue-100">Quem paga as parcelas?</h3><p className="mt-1 text-xs text-slate-500">Define a responsabilidade na projeção. A conta real continua sendo escolhida quando o pagamento acontecer.</p></div>
  <div className="mt-3 grid grid-cols-3 gap-2">{householdMembers.map(member=><button type="button" key={member.id} onClick={()=>setChoice(member.id)} className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${choice===member.id?'border-blue-500 bg-blue-950/50 text-blue-200':'border-slate-700 text-slate-400'}`}>{member.display_name}</button>)}<button type="button" onClick={()=>setChoice('shared')} className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${choice==='shared'?'border-blue-500 bg-blue-950/50 text-blue-200':'border-slate-700 text-slate-400'}`}>Dividido</button></div>
  <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Atual: <strong className="text-slate-300">{currentLabel}</strong></p><button type="button" onClick={()=>void save()} disabled={saving||!choice} className="min-h-10 rounded-xl bg-blue-600 px-3 text-sm font-bold disabled:opacity-50">{saving?'Salvando…':'Salvar responsável'}</button></div>
  {error&&<p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}
 </section>;
}
