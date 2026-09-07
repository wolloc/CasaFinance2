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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearLoadedContext=()=>{setObligations([]);setAccounts([]);setObligationId('');setAccountId('');setFunderMemberId('');setAmount('');};
  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setLoadError(null); setError(null);
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
    } catch { clearLoadedContext(); setLoadError('Não foi possível conferir os valores com outras pessoas e as contas da Casa. Nenhum recebimento ou pagamento pode ser registrado até uma nova leitura válida.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [household?.id]);
  const selected = useMemo(() => obligations.find((item) => item.id === obligationId), [obligations, obligationId]);
  const outstanding = Number(selected?.outstanding_amount ?? 0);
  const needsFunder = selected?.kind === 'payable' && Boolean(selected.source_transaction_id);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if(loadError){setError('Confira novamente os valores e as contas antes de registrar o acerto.');return;}
    if (!supabase || !household || !selected) return;
    const normalizedAmount = normalizeAmount(amount);
    const numericAmount = Number(normalizedAmount);
    if (!accountId) { setError(selected.kind === 'receivable' ? 'Informe em qual conta o dinheiro entrou.' : 'Informe de qual conta o dinheiro saiu.'); return; }
    if (needsFunder && !funderMemberId) { setError('Informe quem pagou com o próprio dinheiro.'); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (numericAmount > outstanding) { setError('O valor não pode ser maior do que ainda está em aberto.'); return; }
    const occurredAt = new Date(`${occurredDate}T12:00:00`).toISOString();
    setSaving(true); setError(null); setSuccess(null);
    try {
      await settleThirdPartyObligation(supabase, { householdId: household.id, obligationId: selected.id, accountId, amount: normalizedAmount, occurredAt, funderMemberId: needsFunder ? funderMemberId : undefined, notes });
      setSuccess(selected.kind === 'receivable'
        ? 'Recebimento registrado. O dinheiro entrou na conta informada e o valor que essa pessoa devia diminuiu, sem criar uma nova renda.'
        : 'Pagamento registrado. O dinheiro saiu da conta informada e o valor devido diminuiu, sem criar um novo gasto.');
      setObligationId(''); setAccountId(''); setFunderMemberId(''); setAmount(''); setNotes('');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar este acerto.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <button type="button" onClick={onBack} className="text-sm font-semibold text-blue-300">← Voltar aos ajustes</button>
    {loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin"/> : loadError ? <div className="rounded-2xl border border-rose-900 bg-rose-950/30 p-4"><p role="alert" className="text-sm text-rose-200">{loadError}</p><button type="button" onClick={()=>void load()} className="mt-3 min-h-11 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200">Tentar novamente</button></div> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold">Acerto com outra pessoa</h2><p className="mt-1 text-sm text-slate-400">Use quando alguém pagar o que devia à Casa ou quando a Casa pagar um valor que já devia. O acerto não cria uma nova renda nem um novo gasto.</p></div>
      {initialObligationId&&selected&&<p className="rounded-xl border border-cyan-900 bg-cyan-950/20 p-3 text-xs text-cyan-200">Este valor veio da Home e foi conferido novamente. Nada será movimentado até você confirmar.</p>}
      <label className="block text-sm">O que aconteceu?<select value={obligationId} onChange={(event) => { setObligationId(event.target.value); const next=obligations.find(item=>item.id===event.target.value); setAmount(next?Number(next.outstanding_amount).toFixed(2).replace('.', ','):''); setAccountId(''); setFunderMemberId(''); }} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{obligations.map((item) => <option key={item.id} value={item.id}>{item.kind === 'receivable' ? `${item.counterparty_name} pagou / vai pagar` : `Pagar ${item.counterparty_name}`} · {formatMoney(item.outstanding_amount)}</option>)}</select></label>
      {selected && <div className="rounded-xl bg-slate-950 p-3 text-sm"><p className="font-semibold">{selected.description}</p><p className="mt-1 text-slate-400">Ainda falta <strong className="text-amber-200">{formatMoney(outstanding)}</strong></p></div>}
      {selected && <label className="block text-sm">{selected.kind === 'receivable' ? 'Em qual conta o dinheiro entrou?' : 'De qual conta o dinheiro saiu?'}<select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>}
      {needsFunder && <label className="block text-sm">Quem pagou com o próprio dinheiro?<select value={funderMemberId} onChange={(event) => setFunderMemberId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>}
      {selected && <><label className="block text-sm">Quanto foi pago?<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="0,00" /></label><label className="block text-sm">Quando aconteceu?<input type="date" value={occurredDate} onChange={(event) => setOccurredDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label><label className="block text-sm">Observação (opcional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label></>}
      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{success}</p>}
      {obligations.length === 0 && <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">Não há valores em aberto com outras pessoas.</p>}
      <button type="submit" disabled={saving || !selected} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50"><HandCoins className="h-4 w-4"/>{saving ? 'Registrando…' : 'Registrar acerto'}</button>
    </form>}
  </div>;
}
