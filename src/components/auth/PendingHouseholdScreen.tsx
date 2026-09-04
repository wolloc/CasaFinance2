import { HouseholdFinancialCoreSetup } from './HouseholdFinancialCoreSetup.js';
import { Check, Copy, Home, Link, LoaderCircle, LogOut, Plus, ShieldCheck, Users, WalletCards } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { invitationTokenFromSearch, type HouseholdInvitationPreview } from '../../auth/householdInvitations.js';
import { HouseholdFinancialSetup } from './HouseholdFinancialSetup.js';
import { HouseholdCategoriesSetup } from './HouseholdCategoriesSetup.js';
import { HouseholdTransactionsSetup } from './HouseholdTransactionsSetup.js';

export function PendingHouseholdScreen() {
  const { user, household, householdMembers, signOut, isSubmitting, householdLoading, createHousehold, createInvitation, previewInvitation, acceptInvitation, error } = useSupabaseAuth();
  const [householdName, setHouseholdName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const [invitedEmail, setInvitedEmail] = useState('');
  const [invitation, setInvitation] = useState<{ token: string; expiresAt: string } | null>(null);
  const [inviteToken, setInviteToken] = useState(() => invitationTokenFromSearch(window.location.search));
  const [invitePreview, setInvitePreview] = useState<HouseholdInvitationPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(() => Boolean(invitationTokenFromSearch(window.location.search)));
  const [showManualInvitation, setShowManualInvitation] = useState(false);
  const [acceptedHouseholdName, setAcceptedHouseholdName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeArea, setActiveArea] = useState<'household' | 'financial' | 'categories' | 'transactions' | 'core'>('household');
  const submissionLock = useRef(false);

  useEffect(() => {
    const token = invitationTokenFromSearch(window.location.search);
    if (!token) return;
    let active = true;
    setPreviewLoading(true);
    previewInvitation(token).then((preview) => {
      if (active) setInvitePreview(preview);
    }).finally(() => {
      if (active) setPreviewLoading(false);
    });
    return () => { active = false; };
    // O token e lido uma unica vez; mudancas de estado do provider nao devem repetir o preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submissionLock.current) return;
    submissionLock.current = true;
    setSuccess(null);
    const result = await createHousehold(householdName, displayName);
    if (result) setSuccess(result.alreadyExisted ? `Você já pertence à Casa “${result.householdName}”.` : `Casa “${result.householdName}” criada com sucesso.`);
    submissionLock.current = false;
  };

  const generateInvitation = async (event: FormEvent) => {
    event.preventDefault();
    if (submissionLock.current) return;
    submissionLock.current = true;
    setSuccess(null);
    const result = await createInvitation(invitedEmail);
    if (result) setInvitation({ token: result.token, expiresAt: result.expiresAt });
    submissionLock.current = false;
  };

  const acceptInvitationCode = async (event: FormEvent) => {
    event.preventDefault();
    if (submissionLock.current) return;
    submissionLock.current = true;
    setSuccess(null);
    const result = await acceptInvitation(inviteToken);
    if (result) {
      setAcceptedHouseholdName(invitePreview?.householdName ?? null);
      setSuccess(result.status === 'already_member' ? 'Você já pertence a esta Casa.' : `Você agora faz parte da ${invitePreview?.householdName ?? 'Casa'}.`);
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    }
    submissionLock.current = false;
  };

  const copyInvitation = async () => {
    if (!invitation) return;
    const value = `${window.location.origin}/?invitation=${encodeURIComponent(invitation.token)}`;
    await navigator.clipboard.writeText(value);
    setCopied(true);
  };

  if (householdLoading) return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-slate-300">Verificando sua Casa…</main>;
  if (household && activeArea === 'core') return <HouseholdFinancialCoreSetup onBack={() => setActiveArea('household')} />;
  if (household && activeArea === 'transactions') return <HouseholdTransactionsSetup onBack={() => setActiveArea('household')} />;
  if (household && activeArea === 'categories') return <HouseholdCategoriesSetup onBack={() => setActiveArea('household')} />;
  if (household && activeArea === 'financial') return <div><button type="button" onClick={() => setActiveArea('household')} className="fixed left-4 top-4 z-20 min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-200">Casa e membros</button><HouseholdFinancialSetup /></div>;
  if (household) return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-emerald-800 bg-slate-900 p-6 shadow-2xl">
        <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-emerald-400" />
        <h1 className="text-center text-xl font-bold">{household.name}</h1>
        <button type="button" onClick={() => setActiveArea('financial')} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold hover:bg-blue-500"><WalletCards className="h-5 w-5" />Contas e cartões</button>
        <button type="button" onClick={() => setActiveArea('categories')} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 font-semibold hover:bg-slate-800"><WalletCards className="h-5 w-5" />Categorias</button>
        <button type="button" onClick={() => setActiveArea('transactions')} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 font-semibold hover:bg-slate-800"><WalletCards className="h-5 w-5" />Transações</button>
        <button type="button" onClick={() => setActiveArea('core')} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-800 font-semibold text-emerald-300 hover:bg-emerald-950/40"><WalletCards className="h-5 w-5" />Núcleo financeiro</button>
        {acceptedHouseholdName && <p role="status" className="mt-3 text-center text-sm font-semibold text-emerald-300">Você agora faz parte da {acceptedHouseholdName}.</p>}
        <p className="mt-2 text-center text-sm text-slate-300">Seu papel: <strong>{householdMembers.find((member) => member.profile_id === user?.id)?.role === 'owner' ? 'Proprietário' : 'Membro'}</strong>.</p>
        <div className="mt-6 border-t border-slate-800 pt-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Membros</h2><ul className="mt-3 space-y-2">{householdMembers.map((member) => <li key={member.id} className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-3 text-sm"><span>{member.display_name}</span><span className="text-xs text-slate-500">{member.role === 'owner' ? 'Proprietário' : 'Membro'}</span></li>)}</ul></div>
        {householdMembers.some((member) => member.profile_id === user?.id && member.role === 'owner') && <div className="mt-6 border-t border-slate-800 pt-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Convidar membro</h2><form onSubmit={generateInvitation} className="mt-3 space-y-3"><input type="email" value={invitedEmail} onChange={(event) => setInvitedEmail(event.target.value)} placeholder="E-mail (opcional)" className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base outline-none focus:border-blue-500" /><button disabled={isSubmitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold hover:bg-blue-500 disabled:opacity-60">{isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Link className="h-5 w-5" />}Gerar convite</button></form>{invitation && <div className="mt-3 rounded-xl border border-blue-800 bg-blue-950/40 p-3"><p className="text-sm text-blue-200">Link seguro pronto para compartilhar.</p><p className="mt-2 text-xs text-slate-400">Válido até {new Intl.DateTimeFormat('pt-BR').format(new Date(invitation.expiresAt))}.</p><button type="button" onClick={copyInvitation} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-700 font-semibold text-blue-200 hover:bg-blue-900/50">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Convite copiado' : 'Copiar link do convite'}</button></div>}</div>}
        {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}{success && <p role="status" className="mt-4 text-sm text-emerald-300">{success}</p>}
        <button type="button" onClick={signOut} disabled={isSubmitting} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"><LogOut className="h-5 w-5" />Sair</button>
      </section>
    </main>
  );

  if (invitePreview || previewLoading) return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-4 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-emerald-800 bg-slate-900 p-6 text-center shadow-2xl">
        <Users className="mx-auto mb-5 h-12 w-12 text-emerald-400" />
        <h1 className="text-2xl font-bold">Você recebeu um convite</h1>
        {previewLoading ? <p className="mt-3 text-sm text-slate-400">Verificando o convite…</p> : <>
          <p className="mt-3 text-sm text-slate-300">Você foi convidado para participar da <strong className="text-white">{invitePreview?.householdName}</strong>.</p>
          <form onSubmit={acceptInvitationCode} className="mt-6">
            <button type="submit" disabled={isSubmitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">{isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Users className="h-5 w-5" />}Entrar na {invitePreview?.householdName}</button>
          </form>
        </>}
        {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
        <button type="button" onClick={signOut} className="mt-6 text-sm text-slate-400 hover:text-white">Sair</button>
      </section>
    </main>
  );
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
        <div className="mt-5 border-t border-slate-800 pt-5 text-left">
          {!showManualInvitation ? <button type="button" onClick={() => setShowManualInvitation(true)} className="w-full text-center text-sm font-semibold text-emerald-300">Tenho um convite</button> : <form onSubmit={acceptInvitationCode} className="space-y-3"><label className="block text-sm font-medium text-slate-300">Código ou link do convite<input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} placeholder="Cole o código ou link" className="mt-2 min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-base outline-none focus:border-emerald-500" /></label><button type="submit" disabled={isSubmitting || !inviteToken.trim()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-700 font-semibold text-emerald-300 hover:bg-emerald-950/50 disabled:opacity-60"><Link className="h-5 w-5" />Entrar na Casa</button></form>}
        </div>
        <button type="button" onClick={signOut} disabled={isSubmitting} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60">
          {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
          Sair
        </button>
      </section>
    </main>
  );
}
