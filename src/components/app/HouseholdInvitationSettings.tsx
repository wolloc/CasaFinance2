import { Check, Copy, Link, LoaderCircle, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';

export function HouseholdInvitationSettings(){
  const{user,householdMembers,createInvitation,isSubmitting,error}=useSupabaseAuth();
  const[email,setEmail]=useState('');
  const[invitation,setInvitation]=useState<{token:string;expiresAt:string}|null>(null);
  const[copied,setCopied]=useState(false);
  const owner=householdMembers.some(member=>member.profile_id===user?.id&&member.role==='owner');
  const complete=householdMembers.length>=2;

  if(!owner)return null;
  if(complete)return <div className="mt-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 text-xs text-emerald-200"><Users className="mr-1 inline h-4 w-4"/>A Casa já está completa com duas pessoas.</div>;

  const submit=async(event:FormEvent)=>{event.preventDefault();setCopied(false);const result=await createInvitation(email);if(result)setInvitation({token:result.token,expiresAt:result.expiresAt});};
  const copy=async()=>{if(!invitation)return;const link=`${window.location.origin}/?invitation=${encodeURIComponent(invitation.token)}`;await navigator.clipboard.writeText(link);setCopied(true);};

  return <div className="mt-4 border-t border-slate-800 pt-4"><h3 className="text-sm font-bold">Convidar a outra pessoa da Casa</h3><p className="mt-1 text-xs text-slate-500">Gere um link para a outra pessoa entrar com a própria conta. O Casa aceita no máximo duas pessoas ativas.</p><form onSubmit={submit} className="mt-3 space-y-3"><label className="block text-xs text-slate-400">E-mail da pessoa (opcional)<input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="gui@email.com" className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"/></label><button disabled={isSubmitting} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-purple-700 text-sm font-semibold disabled:opacity-50">{isSubmitting?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Link className="h-4 w-4"/>}Gerar convite</button></form>{invitation&&<div className="mt-3 rounded-xl border border-purple-800 bg-purple-950/30 p-3"><p className="text-xs text-purple-200">Link seguro pronto para compartilhar.</p><p className="mt-1 text-[11px] text-slate-500">Válido até {new Intl.DateTimeFormat('pt-BR').format(new Date(invitation.expiresAt))}.</p><button type="button" onClick={copy} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-purple-700 text-sm font-semibold text-purple-200">{copied?<Check className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}{copied?'Convite copiado':'Copiar link do convite'}</button></div>}{error&&<p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}</div>;
}
