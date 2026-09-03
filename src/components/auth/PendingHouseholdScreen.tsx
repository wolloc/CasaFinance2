import { Home, LoaderCircle, LogOut, ShieldCheck } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';

export function PendingHouseholdScreen() {
  const { user, household, signOut, isSubmitting, householdLoading, createHousehold, error } = useSupabaseAuth();
  const [householdName, setHouseholdName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const submissionLock = useRef(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submissionLock.current) return;
    submissionLock.current = true;
    setSuccess(null);
    const result = await createHousehold(householdName, displayName);
    if (result) setSuccess(result.alreadyExisted ? `Você já pertence à Casa “${result.householdName}”.` : `Casa “${result.householdName}” criada com sucesso.`);
    submissionLock.current = false;
  };

  if (householdLoading) return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-slate-300">Verificando sua Casa…</main>;
  if (household) return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 text-slate-100"><section className="w-full max-w-md rounded-3xl border border-emerald-800 bg-slate-900 p-6 text-center shadow-2xl"><ShieldCheck className="mx-auto mb-4 h-10 w-10 text-emerald-400" /><h1 className="text-xl font-bold">Casa pronta</h1><p className="mt-3 text-sm text-slate-300">Você já pertence à Casa <strong>{household.name}</strong>.</p><button type="button" onClick={signOut} disabled={isSubmitting} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"><LogOut className="h-5 w-5" />Sair</button></section></main>;
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400"><Home className="h-7 w-7" /></div>
        <p className="mb-2 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400"><ShieldCheck className="h-4 w-4" /> Sessão autenticada</p>
        <h1 className="text-xl font-bold">Bem-vindo ao Casa Finance</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Vamos configurar sua Casa para <strong className="text-slate-200">{user?.email}</strong>.</p>
        <form onSubmit={submit} className="mt-6 space-y-4 text-left">
          <label className="block text-sm font-medium text-slate-300">Nome da Casa<input required maxLength={80} value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="Nossa Casa" className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base outline-none focus:border-blue-500" /></label>
          <label className="block text-sm font-medium text-slate-300">Seu nome<input required maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Wallace" className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base outline-none focus:border-blue-500" /></label>
          <p className="rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-500">Seus dados financeiros em memória não serão vinculados a esta identidade.</p>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          {success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
          <button type="submit" disabled={isSubmitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">{isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Home className="h-5 w-5" />}{isSubmitting ? 'Criando sua Casa…' : 'Criar minha Casa'}</button>
        </form>
        {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
        <button type="button" onClick={signOut} disabled={isSubmitting} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60">
          {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
          Sair
        </button>
      </section>
    </main>
  );
}
