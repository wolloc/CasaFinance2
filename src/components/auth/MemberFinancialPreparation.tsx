import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, LoaderCircle, ShieldAlert, WalletCards } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { getHouseholdFinancialSetupReadiness, type HouseholdFinancialSetupReadiness } from '../../finance/householdFinancialAccounts.js';
import { HouseholdFinancialSetup } from './HouseholdFinancialSetup.js';

type ReadinessState = HouseholdFinancialSetupReadiness | 'loading' | 'error';

export function MemberFinancialPreparation() {
  const { household, householdMembers, user, completeFinancialOnboarding, isSubmitting, error } = useSupabaseAuth();
  const [resources, setResources] = useState(false);
  const [readiness, setReadiness] = useState<ReadinessState>('loading');
  const [readinessVersion, setReadinessVersion] = useState(0);
  const me=householdMembers.find(member=>member.profile_id===user?.id);
  const isOwner=me?.role==='owner';

  useEffect(()=>{
    if(!supabase||!household){setReadiness('error');return;}
    let active=true;
    setReadiness('loading');
    getHouseholdFinancialSetupReadiness(supabase,household.id)
      .then((state)=>{if(active)setReadiness(state);})
      .catch(()=>{if(active)setReadiness('error');});
    return()=>{active=false;};
  },[household?.id,readinessVersion]);

  const blocked=readiness==='needs_legacy_cutover'||readiness==='inconsistent_opening_without_cutoff';

  if(resources) {
    return <div className="min-h-[100dvh] bg-slate-950">
      <button type="button" onClick={()=>{setResources(false);setReadinessVersion(version=>version+1);}} className="fixed left-4 top-4 z-20 min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-200">Voltar à preparação</button>
      <HouseholdFinancialSetup memberOnboarding={!isOwner}/>
    </div>;
  }

  return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
    <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">{household?.name}</p>
      <h1 className="mt-2 text-2xl font-black">{isOwner?'Vamos montar o ponto de partida da sua Casa, '+(me?.display_name??'')+'.':'Tudo certo, '+(me?.display_name??'')+'. Vamos preparar seu Casa.'}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">{isOwner?'Antes de começar o dia a dia, você pode informar onde o dinheiro está, quais cartões já existem e qual é a posição inicial que o Casa deve acompanhar. Isso monta o retrato de partida sem transformar patrimônio antigo em renda nova.':'A Casa já existe. Agora você pode incluir o que é seu e quer acompanhar. O restante da Casa continua como já está. Você não precisa revisar nem confirmar saldos de outra pessoa.'}</p>

      {readiness==='loading'&&<div className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300"><LoaderCircle className="h-5 w-5 animate-spin text-blue-300"/>Conferindo se a posição inicial da Casa está pronta…</div>}

      {readiness==='error'&&<div className="mt-6 rounded-2xl border border-rose-900 bg-rose-950/30 p-4">
        <p role="alert" className="text-sm text-rose-200">Não foi possível confirmar a preparação financeira da Casa. Por segurança, o Casa não libera o cotidiano financeiro enquanto esse estado estiver desconhecido.</p>
        <button type="button" onClick={()=>setReadinessVersion(version=>version+1)} className="mt-3 min-h-11 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200">Tentar novamente</button>
      </div>}

      {blocked&&isOwner&&<div className="mt-6 rounded-2xl border border-amber-900 bg-amber-950/20 p-4">
        <div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"/><div><strong className="text-amber-100">Precisamos fechar o ponto de partida da Casa.</strong><p className="mt-1 text-sm text-amber-100/80">{readiness==='needs_legacy_cutover'?'Já existem contas cadastradas antes do controle financeiro canônico. Confirme uma única vez quanto havia nelas e de quem são os recursos.':'Existem posições iniciais sem uma data canônica de início. Essa inconsistência precisa ser revisada antes de liberar novos registros.'}</p></div></div>
        <button type="button" onClick={()=>setResources(true)} className="mt-4 min-h-12 w-full rounded-xl bg-amber-500 px-4 font-bold text-slate-950">Revisar posição inicial</button>
      </div>}

      {blocked&&!isOwner&&<div className="mt-6 rounded-2xl border border-amber-900 bg-amber-950/20 p-4">
        <div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"/><div><strong className="text-amber-100">A posição inicial da Casa ainda está sendo concluída.</strong><p className="mt-1 text-sm text-amber-100/80">Quem administra a Casa precisa concluir essa etapa. Você não precisa revisar saldos ou recursos de outra pessoa. Assim que ela estiver pronta, você poderá incluir o que é seu e entrar no cotidiano financeiro.</p></div></div>
        <button type="button" onClick={()=>setReadinessVersion(version=>version+1)} className="mt-4 min-h-11 w-full rounded-xl border border-amber-800 px-3 text-sm font-semibold text-amber-100">Conferir novamente</button>
      </div>}

      {readiness==='ready'&&<>
        <button type="button" onClick={()=>setResources(true)} className="mt-6 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-blue-800 bg-blue-950/30 px-4 text-left">
          <WalletCards className="h-5 w-5 text-blue-300"/><span className="flex-1"><strong className="block">{isOwner?'Adicionar recursos e cartões':'Adicionar meus recursos'}</strong><small className="text-slate-400">Contas, dinheiro, benefícios, investimentos e cartões.</small></span><ChevronRight className="h-5 w-5"/>
        </button>
        <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-sm text-slate-400"><strong className="text-slate-200">{isOwner?'Vai começar sem recursos cadastrados?':'Não tem nada para adicionar agora?'}</strong><p className="mt-1">{isOwner?'Você pode concluir a preparação e cadastrar depois em Ajustes. O Casa não inventará saldo até que um recurso seja informado.':'Sem problema. Você pode entrar no Casa e cadastrar seus recursos depois em Ajustes.'}</p></div>
        {error&&<p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
        <button type="button" disabled={isSubmitting} onClick={()=>void completeFinancialOnboarding()} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white disabled:opacity-60"><CheckCircle2 className="h-5 w-5"/>Concluir e entrar no Casa</button>
      </>}
    </section>
  </main>;
}
