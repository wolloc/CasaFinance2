import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Banknote, LoaderCircle, UserPlus } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { isTransactionalResource, listInvestmentReserveResources, type InvestmentReserveResource } from '../../finance/investmentReserveAdjustments.js';
import { createFinancialParty, createLoanPrincipal, listFinancialParties, type FinancialParty } from '../../finance/loanPrincipals.js';
import { LoanChargesAdjustment } from './LoanChargesAdjustment.js';

const normalizeAmount = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');
const localDate = () => { const now = new Date(); const offset = now.getTimezoneOffset(); return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10); };

export function LoanAdjustment({ onBack }: { onBack: () => void }) {
  const { household } = useSupabaseAuth();
  const [direction, setDirection] = useState<'granted' | 'taken'>('granted');
  const [parties, setParties] = useState<FinancialParty[]>([]);
  const [accounts, setAccounts] = useState<InvestmentReserveResource[]>([]);
  const [counterpartyId, setCounterpartyId] = useState('');
  const [newPartyName, setNewPartyName] = useState('');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [occurredAt, setOccurredAt] = useState(localDate());
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('Empréstimo');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setError(null);
    try { const [people, resources] = await Promise.all([listFinancialParties(supabase, household.id), listInvestmentReserveResources(supabase, household.id)]); setParties(people); setAccounts(resources.filter(isTransactionalResource)); }
    catch { setError('Não foi possível carregar pessoas e recursos da Casa.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [household?.id]);
  const selectedParty = useMemo(() => parties.find((party) => party.id === counterpartyId), [parties, counterpartyId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase || !household) return;
    const normalizedAmount = normalizeAmount(amount); const numericAmount = Number(normalizedAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (!accountId) { setError(direction === 'granted' ? 'Informe de qual recurso o dinheiro saiu.' : 'Informe em qual recurso o dinheiro entrou.'); return; }
    if (!counterpartyId && !newPartyName.trim()) { setError('Escolha uma pessoa ou informe um novo nome.'); return; }
    if (dueDate && dueDate < occurredAt) { setError('A data prevista de devolução não pode ser anterior à data do empréstimo.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      let partyId = counterpartyId; if (!partyId) partyId = await createFinancialParty(supabase, household.id, newPartyName);
      await createLoanPrincipal(supabase, { householdId: household.id, direction, counterpartyId: partyId, accountId, amount: normalizedAmount, occurredAt, dueDate, description, notes });
      setSuccess(direction === 'granted' ? 'Empréstimo registrado: o caixa diminuiu e nasceu um valor a receber. Nenhuma despesa foi criada.' : 'Empréstimo registrado: o caixa aumentou e nasceu um valor a pagar. Nenhuma renda foi criada.');
      setAmount(''); setNotes(''); setDueDate(''); setNewPartyName(''); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o empréstimo.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <button type="button" onClick={onBack} className="text-sm font-semibold text-blue-300">← Voltar às intenções</button>
    {loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin"/> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold">Empréstimos</h2><p className="mt-1 text-sm text-slate-400">Aqui o Casa registra somente o principal. Emprestar dinheiro não é despesa; pegar dinheiro emprestado não é renda. Juros, tarifas e multas são fatos econômicos separados.</p></div>
      <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setDirection('granted')} className={`rounded-xl border p-3 text-sm font-semibold ${direction === 'granted' ? 'border-blue-500 bg-blue-950/50 text-blue-200' : 'border-slate-700 text-slate-400'}`}>Emprestei dinheiro</button><button type="button" onClick={() => setDirection('taken')} className={`rounded-xl border p-3 text-sm font-semibold ${direction === 'taken' ? 'border-blue-500 bg-blue-950/50 text-blue-200' : 'border-slate-700 text-slate-400'}`}>Peguei emprestado</button></div>
      <div className="rounded-xl bg-slate-950 p-3 text-xs text-slate-400">{direction === 'granted' ? 'O dinheiro sai da Casa e nasce um recebível contra a outra pessoa.' : 'O dinheiro entra na Casa e nasce um pagável para a outra pessoa.'} O principal permanece neutro no resultado econômico.</div>
      <label className="block text-sm">Pessoa<select value={counterpartyId} onChange={(event) => { setCounterpartyId(event.target.value); if (event.target.value) setNewPartyName(''); }} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Nova pessoa</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
      {!counterpartyId && <label className="block text-sm">Nome da pessoa<input value={newPartyName} onChange={(event) => setNewPartyName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Ex.: Letícia" /></label>}
      <label className="block text-sm">{direction === 'granted' ? 'De qual recurso o dinheiro saiu?' : 'Em qual recurso o dinheiro entrou?'}<select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.account_id} value={account.account_id}>{account.name}</option>)}</select></label>
      <label className="block text-sm">Valor do principal<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="0,00" /></label>
      <label className="block text-sm">Data do empréstimo<input type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      <label className="block text-sm">Data prevista de devolução (opcional)<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      <label className="block text-sm">Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      <label className="block text-sm">Observação (opcional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      {selectedParty && <p className="text-xs text-slate-500">Contraparte: {selectedParty.name}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{success}</p>}
      <button type="submit" disabled={saving || accounts.length === 0} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50"><Banknote className="h-4 w-4"/>{saving ? 'Registrando…' : 'Registrar empréstimo'}</button>
      {accounts.length === 0 && <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400"><UserPlus className="mr-1 inline h-4 w-4"/>Cadastre um recurso transacional antes de registrar o principal.</p>}
    </form>}
    <LoanChargesAdjustment/>
  </div>;
}
