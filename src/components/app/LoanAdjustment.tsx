import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Banknote, Landmark, LoaderCircle, UserPlus } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount } from '../../finance/householdFinancialAccounts.js';
import { createFinancialParty, createLoanPrincipal, listFinancialParties, type FinancialParty } from '../../finance/loanPrincipals.js';
import { LoanChargesAdjustment } from './LoanChargesAdjustment.js';

const normalizeAmount = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');
const localDate = () => { const now = new Date(); const offset = now.getTimezoneOffset(); return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10); };

export function LoanAdjustment({ onBack, backLabel = 'Voltar', initialDirection, initialAccountId, showBack = true }: { onBack: () => void; backLabel?: string; initialDirection?: 'granted' | 'taken'; initialAccountId?: string; showBack?: boolean }) {
  const { household } = useSupabaseAuth();
  const [direction, setDirection] = useState<'granted' | 'taken'>(initialDirection ?? 'granted');
  const [parties, setParties] = useState<FinancialParty[]>([]);
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([]);
  const [counterpartyId, setCounterpartyId] = useState('');
  const [newPartyName, setNewPartyName] = useState('');
  const [accountId, setAccountId] = useState(initialAccountId ?? '');
  const [amount, setAmount] = useState('');
  const [occurredAt, setOccurredAt] = useState(localDate());
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdLoanId, setCreatedLoanId] = useState<string | null>(null);

  const clearLoadedContext = () => { setParties([]); setAccounts([]); setCounterpartyId(''); setAccountId(''); };
  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setLoadError(null); setError(null);
    try { const [people, financial] = await Promise.all([listFinancialParties(supabase, household.id), listHouseholdFinancialAccounts(supabase, household.id)]); const transactional=financial.accounts.filter(account=>!account.resource_restriction&&['cash','checking','savings','digital_wallet'].includes(account.type)); setParties(people); setAccounts(transactional); setAccountId(current=>current&&transactional.some(account=>account.id===current)?current:initialAccountId&&transactional.some(account=>account.id===initialAccountId)?initialAccountId:''); }
    catch { clearLoadedContext(); setLoadError('Não foi possível conferir pessoas e contas da Casa. O empréstimo não pode ser registrado até uma nova leitura válida.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [household?.id]);
  useEffect(() => { if (initialDirection) setDirection(initialDirection); }, [initialDirection]);
  useEffect(() => { if (initialAccountId) setAccountId(initialAccountId); }, [initialAccountId]);
  const selectedParty = useMemo(() => parties.find((party) => party.id === counterpartyId), [parties, counterpartyId]);
  const selectedAccount = useMemo(() => accounts.find((account) => account.id === accountId), [accounts, accountId]);
  const contextualBank = direction === 'taken' && initialAccountId && selectedAccount?.institution?.trim() ? selectedAccount.institution.trim() : null;
  const lockedDirection = Boolean(initialDirection);
  const lockedAccount = Boolean(initialAccountId && selectedAccount);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase || !household) return;
    if (loadError || loading) { setError('Confira novamente as pessoas e contas antes de registrar o empréstimo.'); return; }
    const normalizedAmount = normalizeAmount(amount); const numericAmount = Number(normalizedAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (!accountId) { setError(direction === 'granted' ? 'Informe de qual recurso o dinheiro saiu.' : 'Informe em qual recurso o dinheiro entrou.'); return; }
    const partyName = contextualBank ?? selectedParty?.name ?? newPartyName.trim();
    if (!counterpartyId && !partyName) { setError('Escolha com quem foi o empréstimo.'); return; }
    if (dueDate && dueDate < occurredAt) { setError('A data prevista de devolução não pode ser anterior à data do empréstimo.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      let partyId = counterpartyId; if (!partyId) { const existing = parties.find((party) => party.name.trim().toLocaleLowerCase('pt-BR') === partyName.toLocaleLowerCase('pt-BR')); partyId = existing?.id ?? await createFinancialParty(supabase, household.id, partyName); }
      const description = direction === 'taken' ? `Empréstimo de ${partyName}` : `Empréstimo para ${partyName}`;
      const created = await createLoanPrincipal(supabase, { householdId: household.id, direction, counterpartyId: partyId, accountId, amount: normalizedAmount, occurredAt, dueDate, description });
      setCreatedLoanId(direction==='taken'?String(created):null);
      setSuccess(direction === 'granted' ? 'Pronto. O dinheiro saiu da conta escolhida e o Casa guardou que essa pessoa precisa devolver esse valor. Isso não virou uma despesa.' : 'Pronto. O dinheiro entrou na conta escolhida e o Casa guardou que esse valor precisa ser devolvido. Isso não virou uma renda.');
      setAmount(''); setDueDate(''); setNewPartyName(''); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o empréstimo.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    {showBack&&<button type="button" onClick={onBack} className="text-sm font-semibold text-blue-300">← {backLabel}</button>}
    {loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin"/> : loadError ? <div className="rounded-2xl border border-rose-900 bg-rose-950/30 p-4"><p role="alert" className="text-sm text-rose-200">{loadError}</p><button type="button" onClick={()=>void load()} className="mt-3 min-h-11 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200">Tentar novamente</button></div> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold">{direction === 'taken' ? 'Peguei dinheiro emprestado' : 'Emprestei dinheiro'}</h2><p className="mt-1 text-sm text-slate-400">{direction === 'taken' ? 'O dinheiro entra em um recurso da Casa e nasce uma dívida. Isso não é renda.' : 'O dinheiro sai de um recurso da Casa e nasce um valor a receber. Isso não é despesa.'}</p></div>
      {!lockedDirection&&<div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setDirection('granted')} className={`rounded-xl border p-3 text-sm font-semibold ${direction === 'granted' ? 'border-blue-500 bg-blue-950/50 text-blue-200' : 'border-slate-700 text-slate-400'}`}>Emprestei</button><button type="button" onClick={() => setDirection('taken')} className={`rounded-xl border p-3 text-sm font-semibold ${direction === 'taken' ? 'border-blue-500 bg-blue-950/50 text-blue-200' : 'border-slate-700 text-slate-400'}`}>Peguei emprestado</button></div>}
      {contextualBank?<div className="rounded-2xl border border-blue-900/60 bg-blue-950/20 p-3"><div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-blue-300"/><strong className="text-sm text-blue-100">{contextualBank}</strong></div><p className="mt-1 text-xs text-slate-400">Iniciado a partir de {selectedAccount?.name}. O Casa usa {contextualBank} como credor e esta conta como destino do dinheiro.</p></div>:<>
        <label className="block text-sm">Com quem foi o empréstimo?<select value={counterpartyId} onChange={(event) => { setCounterpartyId(event.target.value); if (event.target.value) setNewPartyName(''); }} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Adicionar outra pessoa</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
        {!counterpartyId && <label className="block text-sm">Nome da pessoa<input value={newPartyName} onChange={(event) => setNewPartyName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Ex.: Robson" /></label>}
      </>}
      {lockedAccount&&selectedAccount?<div className="rounded-xl bg-slate-950/70 p-3"><p className="text-xs text-slate-500">{direction === 'granted' ? 'Saiu de' : 'Entrou em'}</p><strong className="mt-1 block text-sm">{selectedAccount.name}</strong>{selectedAccount.institution&&<span className="mt-1 block text-xs text-slate-500">{selectedAccount.institution}</span>}</div>:<label className="block text-sm">{direction === 'granted' ? 'De qual conta saiu o dinheiro?' : 'Em qual conta entrou o dinheiro?'}<select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.institution?`${account.name} · ${account.institution}`:account.name}</option>)}</select></label>}
      <label className="block text-sm">Quanto foi emprestado?<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="0,00" /></label>
      <label className="block text-sm">Quando aconteceu?<input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      <label className="block text-sm">Quando pretende devolver/receber? <span className="text-slate-500">(opcional)</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      <p className="rounded-xl bg-slate-950/70 p-3 text-xs text-slate-500">Juros e tarifas contratuais são registrados separadamente. Multa só nasce se houver atraso real. O principal parcelado ainda depende do cronograma canônico e não é simulado por este formulário.</p>
      {selectedParty && <p className="text-xs text-slate-500">Pessoa escolhida: {selectedParty.name}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{success}</p>}
      <button type="submit" disabled={saving || accounts.length === 0} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50"><Banknote className="h-4 w-4"/>{saving ? 'Registrando…' : direction === 'taken' ? 'Registrar empréstimo recebido' : 'Registrar dinheiro emprestado'}</button>
      {accounts.length === 0 && <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400"><UserPlus className="mr-1 inline h-4 w-4"/>Cadastre uma conta que movimenta dinheiro antes de registrar um empréstimo.</p>}
    </form>}
    {direction==='taken'&&createdLoanId&&<LoanChargesAdjustment initialLoanId={createdLoanId} contractMode/>}
  </div>;
}
