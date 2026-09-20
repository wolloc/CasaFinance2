import { useMemo, useState, type FormEvent } from 'react';
import { LoaderCircle, Users } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';

export function MemberIdentityOnboarding() {
  const { user, household, householdMembers, confirmDisplayName, isSubmitting, error, signOut } = useSupabaseAuth();
  const currentMember = useMemo(() => householdMembers.find((member) => member.profile_id === user?.id) ?? null, [householdMembers, user?.id]);
  const [name, setName] = useState(currentMember?.display_name ?? '');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || isSubmitting) return;
    await confirmDisplayName(name);
  };

  return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
    <section className="w-full max-w-md rounded-3xl border border-emerald-900/70 bg-slate-900 p-6 shadow-2xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950 text-emerald-300"><Users className="h-6 w-6"/></div>
      <p className="mt-5 text-center text-xs font-bold uppercase tracking-widest text-emerald-400">Você entrou na {household?.name ?? 'Casa'}</p>
      <h1 className="mt-2 text-center text-2xl font-black">Como você quer aparecer no Casa?</h1>
      <p className="mt-2 text-center text-sm leading-6 text-slate-400">Seu nome será usado nos gastos, divisões e acertos. Seu e-mail continua sendo apenas sua forma de acesso.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-slate-300">Seu nome
          <input autoFocus required maxLength={80} value={name} onChange={(event)=>setName(event.target.value)} placeholder="Ex.: Guilherme" className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-base outline-none focus:border-emerald-500"/>
        </label>
        {error&&<p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
        <button type="submit" disabled={isSubmitting||!name.trim()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white disabled:opacity-60">{isSubmitting&&<LoaderCircle className="h-4 w-4 animate-spin"/>Continuar</button>
      </form>
      <button type="button" onClick={signOut} disabled={isSubmitting} className="mt-3 min-h-11 w-full text-sm font-semibold text-slate-500">Sair</button>
    </section>
  </main>;
}
