import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { HandCoins, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount } from '../../finance/householdFinancialAccounts.js';
import { listOpenThirdPartyObligations, settleThirdPartyObligation, type ThirdPartyObligation } from '../../finance/thirdPartyObligations.js';

const formatMoney = (value: unknown) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const normalizeAmount = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');
const localDate = () => { const date = new Date(); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10); };

export function ThirdPartySettlementAdjustment({ onBack, initialObligationId }: { onBack: () => void; initialObligationId?: string }) {
  const { household, householdMembers } = useSupabaseAuth();
  const [obligations, setObligations] = useState<ThirdPartyObligation[]>([]);
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([]);
  const [obligationId, setObligationId] = useState(initialObligationId ?? '');
  const [accountId, setAccountId] = useState('');
  const [funderMemberId, setFunderMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [occurredDate, setOccurredDate] = useState(localDate());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setError(null);
    try {
      const [openObligations, financial] = await Promise.all([
        listOpenThirdPartyObligations(supabase, household.id),
        listHouseholdFinancialAccounts(supabase, household.id),
      ]);
      setObligations(openObligations);
      setAccounts(financial.accounts);
      if (initialObligationId) {
        const initial = openObligations.find((item) => item.id === initialObligationId);
        if (initial) { setObligationId(initial.id); setAmount(Number(initial.outstanding_amount).toFixed(2).replace('.', ',')); }
      }
    } catch { setError('Não foi possível carregar os acertos com outras pessoas.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [household?.id]);
  const selected = useMemo(() => obligations.find((item) => item.id === obligationId), [obligations, obligationId]);
  const outstanding = Number(selected?.outstanding_amount ?? 0);
  const needsFunder = selected?.kind === 'payable' && Boolean(selected.source_transaction_id);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household || !selected) return;
    const normalizedAmount = normalizeAmount(amount);
    const numericAmount = Number(normalizedAmount);
    if (!accountId) { setError(selected.kind === 'receivable' ? 'Informe em qual recurso o dinheiro entrou.' : 'Informe de qual recurso o dinheiro saiu.'); return; }
    if (needsFunder && !funderMemberId) { setError('Informe quem efetivamente financiou este pagamento.'); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (numericAmount > outstanding) { setError('O valor não pode superar o saldo em aberto desta obrigação.'); return; }
    const occurredAt = new Date(`${occurredDate}T12:00:00`).toISOString();
    setSaving(true); setError(null); setSuccess(null);
    try {
      await settleThirdPartyObligation(supabase, {
        householdId: household.id,
        obligationId: selected.id,
        accountId,
        amount: normalizedAmount,
        occurredAt,
        funderMemberId: needsFunder ? funderMemberId : undefined,
        notes,
      });
      setSuccess(selected.kind === 'receivable'
        ? 'Recebimento registrado: o caixa aumentou e o valor a receber diminuiu, sem criar renda nova.'
        : 'Pagamento registrado: o caixa diminuiu e o valor a pagar foi liquidado, sem criar nova despesa.');
      setObligationId(''); setAccountId(''); setFunderMemberId(''); setAmount(''); setNotes('');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar este acerto.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <button type="button" onClick={onBack} className="text-sm font-semibold text-blue-300">← Voltar às intenções</button>
    {loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin"/> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold">Acerto com outra pessoa</h2><p className="mt-1 text-sm text-slate-400">Aqui o Casa só liquida uma obrigação com terceiro que já existe. Receber um valor a receber não vira renda; pagar um valor a pagar não vira nova despesa.</p></div>
      {initialObligationId&&selected&&<p className="rounded-xl border border-cyan-900 bg-cyan-950/20 p-3 text-xs text-cyan-200">Este acerto veio da Home e já foi localizado. Confirme recurso, valor e data antes de registrar.</p>}
      <label className="block text-sm">Qual acerto aconteceu?<select value={obligationId} onChange={(event) => { setObligationId(event.target.value); const next=obligations.find(item=>item.id===event.target.value); setAmount(next?Number(next.outstanding_amount).toFixed(2).replace('.', ','):''); setAccountId(''); setFunderMemberId(''); }} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{obligations.map((item) => <option key={item.id} value={item.id}>{item.kind === 'receivable' ? 'A receber de' : 'A pagar para'} {item.counterparty_name} · {formatMoney(item.outstanding_amount)}</option>)}</select></label>
      {selected && <div className="rounded-xl bg-slate-950 p-3 text-sm"><p className="font-semibold">{selected.description}</p><p className="mt-1 text-slate-400">Origem: {selected.origin_kind} · saldo em aberto <strong className="text-amber-200">{formatMoney(outstanding)}</strong></p></div>}
      {selected && <label className="block text-sm">{selected.kind === 'receivable' ? 'Em qual recurso o dinheiro entrou?' : 'De qual recurso o dinheiro saiu?'}<select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}
      {needsFunder && <label className="block text-sm">Quem efetivamente financiou este pagamento?<select value={funderMemberId} onChange={(event) => setFunderMemberId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>}
      {selected && <><label className="block text-sm">Valor liquidado<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="0,00" /></label><label className="block text-sm">Data<input type="date" value={occurredDate} onChange={(event) => setOccurredDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label><label className="block text-sm">Observação (opcional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label></>}
      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{success}</p>}
      {obligations.length === 0 && <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">Não há obrigações abertas com terceiros para liquidar.</p>}
      <button type="submit" disabled={saving || !selected} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50"><HandCoins className="h-4 w-4"/>{saving ? 'Registrando…' : 'Registrar acerto'}</button>
    </form>}
  </div>;
}
