import { SupabaseAuthProvider, useSupabaseAuth } from './context/SupabaseAuthContext.js';
import { AuthScreen } from './components/auth/AuthScreen.js';
import { HouseholdOnboarding } from './components/auth/HouseholdOnboarding.js';
import { CasaFinanceApp } from './components/app/CasaFinanceApp.js';
import { MemberIdentityOnboarding } from './components/auth/MemberIdentityOnboarding.js';

function AuthenticatedAppBoundary() {
  const { user, isLoading, household, householdLoading, householdMembers, householdMembersLoading } = useSupabaseAuth();

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

  const currentMember = householdMembers.find((member) => member.profile_id === user.id);
  if (currentMember && !currentMember.display_name_confirmed_at) return <MemberIdentityOnboarding />;

  return <CasaFinanceApp />;
}

export default function App() {
  return (
    <SupabaseAuthProvider>
      <AuthenticatedAppBoundary />
    </SupabaseAuthProvider>
  );
}
