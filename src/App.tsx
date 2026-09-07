import { SupabaseAuthProvider, useSupabaseAuth } from './context/SupabaseAuthContext.js';
import { AuthScreen } from './components/auth/AuthScreen.js';
import { HouseholdOnboarding } from './components/auth/HouseholdOnboarding.js';
import { CasaFinanceApp } from './components/app/CasaFinanceApp.js';

function AuthenticatedAppBoundary() {
  const { user, isLoading, household, householdLoading } = useSupabaseAuth();

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

  return household ? <CasaFinanceApp /> : <HouseholdOnboarding />;
}

export default function App() {
  return (
    <SupabaseAuthProvider>
      <AuthenticatedAppBoundary />
    </SupabaseAuthProvider>
  );
}
