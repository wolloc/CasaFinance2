import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, CreditCard, FolderTree, LoaderCircle, LogOut, Pencil, UserCircle, UserRound, Users, X } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { consumeAccountReviewIntent } from '../../finance/accountReviewIntent.js';
import { supabase } from '../../lib/supabase.js';
import { HouseholdFinancialSetup } from '../auth/HouseholdFinancialSetup.js';
import { HouseholdCategoriesSetup } from '../auth/HouseholdCategoriesSetup.js';
import { FinancialPartiesSettings } from './FinancialPartiesSettings.js';
import { HouseholdInvitationSettings } from './HouseholdInvitationSettings.js';

type Area='menu'|'financial'|'categories';

export function SettingsScreen(){
 const{household,householdMembers,user,signOut,isSubmitting,refreshHousehold,renameHouseholdMember}=useSupabaseAuth();
 const accountReview=useMemo(()=>consumeAccountReviewIntent(),[]);
 const[area,setArea]=useState<Area>(accountReview?'financial':'menu');
 const[editingHouseholdName,setEditingHouseholdName]=useState(false);
 const[householdName,setHouseholdName]=useState(household?.name??'');
 const[savingHouseholdName,setSavingHouseholdName]=useState(false);
 const[householdNameMessage,setHouseholdNameMessage]=useState<string|null>(null);
 const[editingMemberId,setEditingMemberId]=useState<string|null>(null);
 const[memberName,setMemberName]=useState('');
 const[savingMember,setSavingMember]=useState(false);const[memberNameMessage,setMemberNameMessage]=useState<string|null>(null);

 useEffect(()=>{if(!editingHouseholdName)setHouseholdName(household?.name??'')},[household?.name,editingHouseholdName]);

 const saveHouseholdName=async()=>{
  const nextName=householdName.trim();
  if(!supabase||!household?.id||!nextName||nextName===household.name){setEditingHouseholdName(false);return}
  setSavingHouseholdName(true);setHouseholdNameMessage(null);
  try{
   const response=await supabase.from('households').update({name:nextName}).eq('id',household.id).select('id').single();
   if(response.error)throw response.error;
   await refreshHousehold();
   setEditingHouseholdName(false);setHouseholdNameMessage('Nome da Casa atualizado.');
  }catch{setHouseholdNameMessage('Não foi possível atualizar o nome da Casa.')}
  finally{setSavingHouseholdName(false)}
 };
 const openMemberEdit=(memberId:string,name:string)=>{setEditingMemberId(memberId);setMemberName(name);setMemberNameMessage(null);};
 const saveMember=async()=>{
  if(!editingMemberId||!memberName.trim())return;
  setSavingMember(true);setMemberNameMessage(null);
  const ok=await renameHouseholdMember(editingMemberId,memberName);
  if(ok){setEditingMemberId(null);setMemberNameMessage('Nome do membro atualizado.');}
  else setMemberNameMessage('Não foi possível atualizar o nome deste membro. Tente novamente.');
  setSavingMember(false);
 };
 const currentMember=householdMembers.find(member=>member.profile_id===user?.id);
 const canRename=(memberId:string)=>currentMember?.role==='owner'||currentMember?.id===memberId;

 if(area==='financial')return <div><Back onClick={()=>setArea('menu')}/><HouseholdFinancialSetup initialAccountId={accountReview?.accountId??null}/></div>;
 if(area==='categories')return <HouseholdCategoriesSetup onBack={()=>setArea('menu')}/>;

 return <div className="space-y-6">
  <header><h1 className="text-3xl font-black">Ajustes</h1></header>

  <section className="rounded-[1.6rem] bg-slate-900/60 p-4">
   <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300"><Users className="h-5 w-5"/></span><div><h2 className="font-bold">Casa e membros</h2><p className="text-xs text-slate-500">Como vocês aparecem no Casa.</p></div></div>{!editingHouseholdName&&<button type="button" aria-label="Editar nome da Casa" onClick={()=>{setHouseholdName(household?.name??'');setEditingHouseholdName(true);setHouseholdNameMessage(null)}} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-blue-300"><Pencil className="h-4 w-4"/></button>}</div>
   <div className="mt-4 rounded-2xl bg-slate-950/55 p-3">
    {editingHouseholdName?<div><label className="text-xs font-semibold text-slate-400" htmlFor="household-name">Nome da Casa</label><div className="mt-2 flex gap-2"><input id="household-name" autoFocus maxLength={80} value={householdName} onChange={event=>setHouseholdName(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-blue-500"/><button type="button" aria-label="Cancelar" onClick={()=>setEditingHouseholdName(false)} className="min-h-11 min-w-11 rounded-xl text-slate-300"><X className="mx-auto h-4 w-4"/></button><button type="button" aria-label="Salvar nome da Casa" disabled={savingHouseholdName||!householdName.trim()} onClick={saveHouseholdName} className="min-h-11 min-w-11 rounded-xl bg-blue-600 text-white disabled:opacity-50">{savingHouseholdName?<LoaderCircle className="mx-auto h-4 w-4 animate-spin"/>:<Check className="mx-auto h-4 w-4"/>}</button></div></div>:<div><p className="text-xs text-slate-500">Casa</p><strong className="text-lg">{household?.name}</strong></div>}
   </div>
   {householdNameMessage&&<p role="status" className={'mt-2 text-xs '+(householdNameMessage==='Nome da Casa atualizado.'?'text-emerald-400':'text-rose-300')}>{householdNameMessage}</p>}

   <div className="mt-3 space-y-2">{householdMembers.map(member=><article key={member.id} className="flex min-h-14 items-center gap-3 rounded-2xl bg-slate-950/45 px-3 py-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/10 font-bold text-blue-300">{member.display_name.trim().charAt(0).toUpperCase()||<UserRound className="h-4 w-4"/>}</span>{editingMemberId===member.id?<div className="flex min-w-0 flex-1 gap-2"><input autoFocus maxLength={80} value={memberName} onChange={event=>setMemberName(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 text-base"/><button type="button" aria-label="Cancelar edição do membro" onClick={()=>setEditingMemberId(null)} className="min-h-11 min-w-11 rounded-xl text-slate-400"><X className="mx-auto h-4 w-4"/></button><button type="button" aria-label="Salvar nome do membro" disabled={savingMember||!memberName.trim()} onClick={saveMember} className="min-h-11 min-w-11 rounded-xl bg-blue-600 disabled:opacity-50">{savingMember?<LoaderCircle className="mx-auto h-4 w-4 animate-spin"/>:<Check className="mx-auto h-4 w-4"/>}</button></div>:<><div className="min-w-0 flex-1"><strong className="block truncate">{member.display_name}</strong><span className="text-xs text-slate-500">{member.role==='owner'?'Responsável pela Casa':'Membro'}</span></div>{canRename(member.id)&&<button type="button" aria-label={'Editar nome de '+member.display_name} onClick={()=>openMemberEdit(member.id,member.display_name)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-blue-300"><Pencil className="h-4 w-4"/></button>}</>}</article>)}</div>
   {memberNameMessage&&<p role="status" className={'mt-2 text-xs '+(memberNameMessage==='Nome do membro atualizado.'?'text-emerald-400':'text-rose-300')}>{memberNameMessage}</p>}
   <div className="mt-3"><HouseholdInvitationSettings/></div>
  </section>

  <FinancialPartiesSettings/>

  <section className="space-y-2">
   <SettingsLink icon={CreditCard} title="Contas e cartões" subtitle="Saldos, limites e posição inicial" tone="text-blue-300" onClick={()=>setArea('financial')}/>
   <SettingsLink icon={FolderTree} title="Categorias" subtitle="Como gastos e entradas são organizados" tone="text-emerald-300" onClick={()=>setArea('categories')}/>
  </section>

  <section className="rounded-[1.6rem] bg-slate-900/55 p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-slate-300"><UserCircle className="h-5 w-5"/></span><div className="min-w-0"><h2 className="font-bold">Minha conta</h2><p className="truncate text-sm text-slate-500">{user?.email??'E-mail indisponível'}</p></div></div><button onClick={signOut} disabled={isSubmitting} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-rose-300 hover:bg-rose-950/20"><LogOut className="h-4 w-4"/>Sair da conta</button></section>
 </div>
}

function SettingsLink({icon:Icon,title,subtitle,tone,onClick}:{icon:typeof CreditCard;title:string;subtitle:string;tone:string;onClick:()=>void}){return <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 rounded-[1.35rem] bg-slate-900/55 px-4 py-3 text-left transition-colors hover:bg-slate-900"><span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 '+tone}><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><strong className="block">{title}</strong><span className="mt-0.5 block truncate text-sm text-slate-500">{subtitle}</span></span><ChevronRight className="h-5 w-5 text-slate-600"/></button>}
function Back({onClick}:{onClick:()=>void}){return <button onClick={onClick} className="mb-3 flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-300"><ArrowLeft className="h-4 w-4"/>Voltar aos ajustes</button>}
