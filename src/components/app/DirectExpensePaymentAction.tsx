import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Banknote, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts } from '../../finance/householdFinancialAccounts.js';
import { listDirectExpensePaymentCandidates, settleDirectExpense, type DirectExpensePaymentCandidate } from '../../finance/directExpensePayments.js';

const transactionalTypes = new Set(['cash', 'checking', 'savings', 'digital_wallet']);
const money = (value: number | string) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const localDateTime = () => { const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); };

export function DirectExpensePaymentAction({ onCompleted, initialTransactionId }: { onCompleted?: () => void; initialTransactionId?: string }) {
  const { household } = useSupabaseAuth();
  const [expenses, setExpenses] = useState<DirectExpensePaymentCandidate[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [transactionId, setTransactionId] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [funderMemberId, setFunderMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(localDateTime());
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  const contextualTargetHandled = useRef(false);
  const selected = useMemo(() => expenses.find((expense) => expense.id === transactionId) ?? null, [expenses, transactionId]);
  const clearLoadedContext=()=>{setExpenses([]);setAccounts([]);setTransactionId('');setSourceAccountId('');setAmount('');};
  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setLoadError(null); setError(null);
    try {
      const [expenseRows, financial] = await Promise.all([listDirectExpensePaymentCandidates(supabase, household.id),listHouseholdFinancialAccounts(supabase, household.id)]);
      setExpenses(expenseRows); setAccounts(financial.accounts.filter((account) => transactionalTypes.has(account.type)));
      if (initialTransactionId && !contextualTargetHandled.current) { contextualTargetHandled.current = true; const target = expenseRows.find((expense) => expense.id === initialTransactionId); if (target) setTransactionId(target.id); else { setTransactionId(''); setError('Este gasto mudou ou já foi resolvido. A lista foi atualizada e nenhum pagamento foi registrado.'); } }
    } catch { clearLoadedContext(); setLoadError('Não foi possível conferir os gastos pendentes e as contas da Casa. Nenhum pagamento pode ser registrado até uma nova leitura válida.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { contextualTargetHandled.current = false; load(); }, [household?.id, initialTransactionId]);
  useEffect(() => { if (selected) setAmount(selected.remaining_amount.toFixed(2)); }, [selected?.id]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if(loadError){setError('Confira novamente os gastos e as contas antes de registrar o pagamento.');return;}
    if (!supabase || !household || !selected) return;
    const parsed = Number(amount.replace(',', '.'));
    if (!sourceAccountId) { setError('Informe de qual conta o dinheiro saiu.'); return; }
    const sourceAccount = accounts.find((account) => account.id === sourceAccountId); const funderMemberId = sourceAccount?.owner_member_ids?.slice().sort()[0] ?? sourceAccount?.owner_member_id ?? null; if (!funderMemberId) { setError('Não foi possível identificar o titular da conta utilizada. Confira a titularidade do recurso.'); return; }
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed - selected.remaining_amount > 0.005) { setError(`O pagamento deve ser maior que zero e não pode ultrapassar ${money(selected.remaining_amount)}.`); return; }
    setSaving(true); setError(null); setSuccess(null);
    try { await settleDirectExpense(supabase, { householdId: household.id, transactionId: selected.id, sourceAccountId, funderMemberId, amount: parsed.toFixed(2), paidAt: new Date(paidAt).toISOString() }); setSuccess('Pagamento registrado. O dinheiro saiu somente da conta informada e ficou ligado ao gasto original.'); setTransactionId(''); setAmount(''); await load(); onCompleted?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o pagamento.'); }
    finally { setSaving(false); }
  };
  return <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
    <div className="flex items-start gap-3"><Banknote className="mt-0.5 h-5 w-5 text-emerald-300"/><div><h2 className="font-bold">Registrar pagamento de gasto</h2><p className="mt-1 text-sm text-slate-400">Use quando o dinheiro realmente saiu de uma conta da Casa. Quem comprou, quem é responsável pelo gasto e quem pagou podem ser pessoas diferentes.</p></div></div>
    {initialTransactionId&&!loadError&&<p className="mt-3 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3 text-xs text-emerald-200">Você veio de um gasto vencido da Home. O Casa conferiu a situação atual antes de selecionar; nada foi pago automaticamente.</p>}
    <p className="mt-3 rounded-xl border border-blue-900/60 bg-blue-950/30 p-3 text-xs text-blue-200">Compra no cartão não aparece aqui: o dinheiro sai quando a fatura é paga. Este passo também não cria um novo gasto — só registra que um gasto já existente foi pago.</p>
    {loading ? <LoaderCircle className="mx-auto mt-4 h-5 w-5 animate-spin"/> : loadError ? <div className="mt-4 rounded-xl border border-rose-900 bg-rose-950/30 p-3"><p role="alert" className="text-sm text-rose-200">{loadError}</p><button type="button" onClick={()=>void load()} className="mt-3 min-h-11 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200">Tentar novamente</button></div> : expenses.length === 0 ? <p className="mt-4 text-sm text-slate-400">Nenhum gasto aguardando pagamento.</p> : <form onSubmit={submit} className="mt-4 grid gap-3">
      <label className="text-sm font-semibold">Qual gasto foi pago?<select value={transactionId} onChange={(e) => setTransactionId(e.target.value)} required className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">Selecione</option>{expenses.map((expense) => <option key={expense.id} value={expense.id}>{expense.description} · falta {money(expense.remaining_amount)}</option>)}</select></label>
      {selected && <p className="text-xs text-slate-400">Valor do gasto: {money(selected.amount)} · já pago: {money(selected.funded_amount + selected.external_paid_amount)} · falta: {money(selected.remaining_amount)}</p>}
      <label className="text-sm font-semibold">De qual conta o dinheiro saiu?<select value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)} required className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <p className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 text-xs text-emerald-200">O titular é identificado automaticamente pela conta escolhida. Não é necessário informar quem pagou novamente.</p>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Quanto foi pago?<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"/></label><label className="text-sm font-semibold">Quando foi pago?<input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"/></label></div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
      <button disabled={saving || !selected} className="min-h-11 rounded-xl bg-emerald-500 px-4 font-bold text-slate-950 disabled:opacity-50">{saving ? 'Registrando…' : 'Registrar pagamento'}</button>
    </form>}
    {!loading && !loadError && expenses.length === 0 && error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    {!loading && success && <p role="status" className="mt-3 text-sm text-emerald-300">{success}</p>}
  </section>;
}
