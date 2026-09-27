import { useEffect,useMemo,useState,type FormEvent } from 'react';
import { Banknote,LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { isTransactionalResource,listInvestmentReserveResources,type InvestmentReserveResource } from '../../finance/investmentReserveAdjustments.js';
import { listLoanSchedule,type LoanScheduleItem } from '../../finance/loanSchedule.js';
import { recordScheduledLoanPayment } from '../../finance/loanPayments.js';

const money=(value:number|string)=>Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const norm=(value:string)=>value.trim().replace(/\./g,'').replace(',','.');
const today=()=>{const d=new Date();const o=d.getTimezoneOffset();return new Date(d.getTime()-o*60000).toISOString().slice(0,10);};

export function LoanScheduledPayment({loanId}:{loanId:string}){
 const{household,householdMembers,user}=useSupabaseAuth();
 const[rows,setRows]=useState<LoanScheduleItem[]>([]);
 const[accounts,setAccounts]=useState<InvestmentReserveResource[]>([]);
 const[source,setSource]=useState('');
 const[funder,setFunder]=useState('');
 const[principal,setPrincipal]=useState('');
 const[interest,setInterest]=useState('');
 const[fee,setFee]=useState('');
 const[date,setDate]=useState(today());
 const[loading,setLoading]=useState(true);
 const[saving,setSaving]=useState(false);
 const[error,setError]=useState<string|null>(null);
 const[message,setMessage]=useState<string|null>(null);
 const currentMember=useMemo(()=>householdMembers.find(member=>member.profile_id===user?.id)??null,[householdMembers,user?.id]);
 const next=rows.find(row=>row.state==='projected'||row.state==='partially_paid')??null;
 const load=async()=>{if(!supabase||!household)return;setLoading(true);setError(null);try{const[schedule,resources]=await Promise.all([listLoanSchedule(supabase,household.id,loanId),listInvestmentReserveResources(supabase,household.id)]);setRows(schedule);setAccounts(resources.filter(isTransactionalResource));}catch{setRows([]);setAccounts([]);setError('Não foi possível conferir o cronograma e as contas agora.');}finally{setLoading(false);}};
 useEffect(()=>{void load();},[household?.id,loanId]);
 useEffect(()=>{if(currentMember?.id&&!funder)setFunder(currentMember.id);},[currentMember?.id,funder]);
 useEffect(()=>{if(!next){setPrincipal('');setInterest('');setFee('');return;}setPrincipal(String(next.remaining_principal_amount));setInterest(String(next.remaining_interest_amount));setFee(String(next.remaining_fee_amount));},[next?.schedule_item_id,next?.remaining_principal_amount,next?.remaining_interest_amount,next?.remaining_fee_amount]);
 const submit=async(event:FormEvent)=>{event.preventDefault();if(!supabase||!household||!next)return;const p=Number(norm(principal||'0'));const i=Number(norm(interest||'0'));const f=Number(norm(fee||'0'));if(!source||!funder||p<0||i<0||f<0||p+i+f<=0){setError('Informe a conta, quem pagou e ao menos um valor positivo.');return;}if(p>Number(next.remaining_principal_amount)||i>Number(next.remaining_interest_amount)||f>Number(next.remaining_fee_amount)){setError('O pagamento não pode superar o que ainda falta nesta parcela.');return;}setSaving(true);setError(null);setMessage(null);try{await recordScheduledLoanPayment(supabase,{householdId:household.id,scheduleItemId:next.schedule_item_id,sourceAccountId:source,funderMemberId:funder,principalAmount:norm(principal||'0'),interestAmount:norm(interest||'0'),feeAmount:norm(fee||'0'),paidAt:new Date(`${date}T12:00:00`).toISOString()});setMessage(`Pagamento registrado: ${money(p+i+f)} saiu uma única vez. Principal, juros e tarifa foram tratados separadamente.`);await load();}catch(c){setError(c instanceof Error?c.message:'Não foi possível registrar o pagamento desta parcela.');}finally{setSaving(false);}};
 if(loading)return <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-blue-300"/>;
 if(rows.length===0)return null;
 if(!next)return <section className="rounded-2xl border border-emerald-900/50 bg-emerald-950/15 p-4"><strong className="text-emerald-200">Empréstimo quitado</strong><p className="mt-1 text-sm text-slate-400">Todas as parcelas do cronograma estão pagas.</p></section>;
 return <section className="rounded-2xl border border-blue-900/50 bg-blue-950/10 p-4">
  <div><h3 className="font-bold">Pagar próxima parcela</h3><p className="mt-1 text-sm text-slate-400">{next.installment_number}ª parcela · vence em {new Date(`${next.due_date}T12:00:00`).toLocaleDateString('pt-BR')} · falta {money(next.remaining_total_amount)}</p></div>
  <form onSubmit={submit} className="mt-4 space-y-3">
   <div className="grid grid-cols-3 gap-2"><label className="text-xs text-slate-400">Principal<input inputMode="decimal" value={principal} onChange={e=>setPrincipal(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-2 text-sm"/></label><label className="text-xs text-slate-400">Juros<input inputMode="decimal" value={interest} onChange={e=>setInterest(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-2 text-sm"/></label><label className="text-xs text-slate-400">Tarifa<input inputMode="decimal" value={fee} onChange={e=>setFee(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-2 text-sm"/></label></div>
   <label className="block text-sm">De qual conta saiu?<select value={source} onChange={e=>setSource(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3"><option value="">Selecione</option>{accounts.map(account=><option key={account.account_id} value={account.account_id}>{account.name}</option>)}</select></label>
   <label className="block text-sm">Quem pagou?<select value={funder} onChange={e=>setFunder(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3"><option value="">Selecione</option>{householdMembers.map(member=><option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
   <label className="block text-sm">Quando pagou?<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-950 px-3"/></label>
   <p className="text-xs text-slate-500">Você pode reduzir qualquer componente para registrar um pagamento parcial. O restante continua aberto nesta mesma parcela.</p>
   {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
   {message&&<p role="status" className="text-sm text-emerald-300">{message}</p>}
   <button disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50"><Banknote className="h-4 w-4"/>{saving?'Registrando…':'Registrar pagamento da parcela'}</button>
  </form>
 </section>;
}
