import { useEffect, useState } from 'react';
import { SupabaseAuthProvider, useSupabaseAuth } from './context/SupabaseAuthContext.js';
import { AuthScreen } from './components/auth/AuthScreen.js';
import { HouseholdOnboarding } from './components/auth/HouseholdOnboarding.js';
import { CasaFinanceApp } from './components/app/CasaFinanceApp.js';
import { MemberIdentityOnboarding } from './components/auth/MemberIdentityOnboarding.js';
import { MemberFinancialPreparation } from './components/auth/MemberFinancialPreparation.js';
import { supabase } from './lib/supabase.js';
import { getHouseholdFinancialSetupReadiness, type HouseholdFinancialSetupReadiness } from './finance/householdFinancialAccounts.js';

function AuthenticatedAppBoundary() {
  const { user, isLoading, household, householdLoading, householdMembers, householdMembersLoading, householdMembersError, retryHouseholdMembers } = useSupabaseAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-sm font-semibold text-slate-300">
        Recuperando sessão segura…
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  if (householdLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-slate-300">
        Verificando sua Casa…
      </div>
    );
  }

  if (!household) return <HouseholdOnboarding />;

  if (householdMembersLoading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-slate-300">Conferindo seu perfil na Casa…</div>;
  }

  if (householdMembersError) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 text-center text-slate-300">
        <div className="max-w-md space-y-3">
          <p className="font-semibold text-white">Não foi possível conferir as pessoas da Casa</p>
          <p className="text-sm">Por segurança, o Casa não libera registros financeiros enquanto não consegue confirmar seu vínculo.</p>
          <button type="button" onClick={retryHouseholdMembers} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">Tentar novamente</button>
        </div>
      </div>
    );
  }

  const currentMember = householdMembers.find((member) => member.profile_id === user.id);
  if (!currentMember) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 text-center text-slate-300">Não foi possível confirmar seu vínculo com esta Casa. Tente novamente antes de continuar.</div>;
  if (!currentMember.display_name_confirmed_at) return <MemberIdentityOnboarding />;

  return <FinancialReadinessBoundary currentMemberFinancialOnboardingCompleted={Boolean(currentMember.financial_onboarding_completed_at)} />;
}

function FinancialReadinessBoundary({ currentMemberFinancialOnboardingCompleted }: { currentMemberFinancialOnboardingCompleted: boolean }) {
  const { household } = useSupabaseAuth();
  const [readiness, setReadiness] = useState<HouseholdFinancialSetupReadiness | 'loading' | 'error'>('loading');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!supabase || !household) {
      setReadiness('error');
      return;
    }
    let active = true;
    setReadiness('loading');
    getHouseholdFinancialSetupReadiness(supabase, household.id)
      .then((state) => { if (active) setReadiness(state); })
      .catch(() => { if (active) setReadiness('error'); });
    return () => { active = false; };
  }, [household?.id, version]);

  if (readiness === 'loading') {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-slate-300">Conferindo o ponto de partida financeiro da Casa…</div>;
  }

  if (readiness === 'error') {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 text-center text-slate-300"><div className="max-w-md space-y-3"><p className="font-semibold text-white">Não foi possível confirmar a preparação financeira da Casa</p><p className="text-sm">Por segurança, o Casa não libera o cotidiano financeiro enquanto esse estado estiver desconhecido.</p><button type="button" onClick={() => setVersion((value) => value + 1)} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white">Tentar novamente</button></div></div>;
  }

  if (readiness !== 'ready') return <MemberFinancialPreparation />;
  if (!currentMemberFinancialOnboardingCompleted) return <MemberFinancialPreparation />;

  return <CasaFinanceApp />;
}

export default function App() {
  return (
    <SupabaseAuthProvider>
      <AuthenticatedAppBoundary />
    </SupabaseAuthProvider>
  );
}
