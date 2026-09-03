import { Home, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';

export function PendingHouseholdScreen() {
  const { user, signOut, isSubmitting, error } = useSupabaseAuth();
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400"><Home className="h-7 w-7" /></div>
        <p className="mb-2 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400"><ShieldCheck className="h-4 w-4" /> Sessão autenticada</p>
        <h1 className="text-xl font-bold">Configuração inicial pendente</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Você entrou como <strong className="text-slate-200">{user?.email}</strong>. A criação e associação da Casa será habilitada na próxima etapa.</p>
        <p className="mt-3 rounded-xl bg-slate-950 p-3 text-left text-xs leading-5 text-slate-500">Seus dados financeiros em memória não foram vinculados a esta identidade.</p>
        {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
        <button type="button" onClick={signOut} disabled={isSubmitting} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60">
          {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
          Sair
        </button>
      </section>
    </main>
  );
}
