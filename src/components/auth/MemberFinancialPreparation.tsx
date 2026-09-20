import { useState } from 'react';
import { CheckCircle2, ChevronRight, WalletCards } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { HouseholdFinancialSetup } from './HouseholdFinancialSetup.js';

export function MemberFinancialPreparation() {
  const { household, householdMembers, user, completeFinancialOnboarding, isSubmitting, error } = useSupabaseAuth();
  const [resources, setResources] = useState(false);
  const me=householdMembers.find(member=>member.profile_id===user?.id);
  if(resources) return <div className="min-h-[100dvh] bg-slate-950"><button type="button" onClick={()=>setResources(false)} className="fixed left-4 top-4 z-20 min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-200">Voltar à preparação</button><HouseholdFinancialSetup memberOnboarding /></div>;
  return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
    <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">{household?.name}</p>
      <h1 className="mt-2 text-2xl font-black">Tudo certo, {me?.display_name}. Vamos preparar seu Casa.</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">A Casa já existe. Agora você pode incluir o que é seu e quer acompanhar. O restante da Casa continua como já está. Você não precisa revisar nem confirmar saldos de outra pessoa.</p>
      <button type="button" onClick={()=>setResources(true)} className="mt-6 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-blue-800 bg-blue-950/30 px-4 text-left">
        <WalletCards className="h-5 w-5 text-blue-300"/><span className="flex-1"><strong className="block">Adicionar meus recursos</strong><small className="text-slate-400">Contas, dinheiro, benefícios, investimentos e cartões.</small></span><ChevronRight className="h-5 w-5"/>
      </button>
      <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-sm text-slate-400"><strong className="text-slate-200">Não tem nada para adicionar agora?</strong><p className="mt-1">Sem problema. Você pode entrar no Casa e cadastrar seus recursos depois em Ajustes.</p></div>
      {error&&<p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
      <button type="button" disabled={isSubmitting} onClick={()=>void completeFinancialOnboarding()} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white disabled:opacity-60"><CheckCircle2 className="h-5 w-5"/>Concluir e entrar no Casa</button>
    </section>
  </main>;
}
