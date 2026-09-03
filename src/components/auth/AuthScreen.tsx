import { useState, type FormEvent } from 'react';
import { Home, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';

type Mode = 'signIn' | 'signUp';

export function AuthScreen() {
  const { signIn, signUp, isSubmitting, error, clearError } = useSupabaseAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const changeMode = (nextMode: Mode) => {
    setMode(nextMode);
    setNotice(null);
    clearError();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    const credentials = { email: email.trim(), password };
    const result = mode === 'signIn' ? await signIn(credentials) : await signUp(credentials);
    if (result.confirmationRequired) {
      setNotice('Conta criada. Confira sua caixa de entrada para confirmar o e-mail antes de entrar.');
    }
  };

  return (
    <main className="min-h-[100dvh] bg-slate-950 px-4 py-8 text-slate-100 sm:flex sm:items-center sm:justify-center">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 shadow-xl shadow-blue-950/50">
            <Home className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Casa Finance</h1>
          <p className="mt-2 text-sm text-slate-400">Sua casa, suas finanças, com acesso protegido.</p>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-7">
          <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-950 p-1" aria-label="Tipo de acesso">
            <button type="button" onClick={() => changeMode('signIn')} className={`min-h-11 rounded-xl text-sm font-semibold transition ${mode === 'signIn' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Entrar</button>
            <button type="button" onClick={() => changeMode('signUp')} className={`min-h-11 rounded-xl text-sm font-semibold transition ${mode === 'signUp' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Criar conta</button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium text-slate-300">
              E-mail
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 focus-within:border-blue-500">
                <Mail className="h-5 w-5 text-slate-500" aria-hidden="true" />
                <input className="min-h-12 w-full bg-transparent text-base outline-none placeholder:text-slate-600" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" />
              </span>
            </label>
            <label className="block text-sm font-medium text-slate-300">
              Senha
              <span className="mt-2 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 focus-within:border-blue-500">
                <LockKeyhole className="h-5 w-5 text-slate-500" aria-hidden="true" />
                <input className="min-h-12 w-full bg-transparent text-base outline-none placeholder:text-slate-600" type="password" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" />
              </span>
            </label>

            {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/60 p-3 text-sm text-rose-200">{error}</p>}
            {notice && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{notice}</p>}

            <button disabled={isSubmitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
              {isSubmitting && <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {isSubmitting ? 'Aguarde…' : mode === 'signIn' ? 'Entrar com segurança' : 'Criar minha conta'}
            </button>
          </form>
        </section>
        <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-slate-500"><ShieldCheck className="h-4 w-4" /> Autenticação protegida pelo Supabase.</p>
      </div>
    </main>
  );
}
