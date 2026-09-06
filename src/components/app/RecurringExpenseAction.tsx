import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarClock, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdTransactions, type HouseholdTransaction } from '../../finance/householdTransactions.js';
import { createRecurringExpenseFromTransaction, ensureRecurringExpenseHorizon, type RecurringExpenseFrequency } from '../../finance/recurringExpenses.js';

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const horizonDate = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const money = (value: string) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function RecurringExpenseAction({ onCreated }: { onCreated?: () => void }) {
  const { household } = useSupabaseAuth();
  const [expenses, setExpenses] = useState<HouseholdTransaction[]>([]);
  const [transactionId, setTransactionId] = useState('');
  const [frequency, setFrequency] = useState<RecurringExpenseFrequency>('monthly');
  const [intervalCount, setIntervalCount] = useState(1);
  const [startDate, setStartDate] = useState(localDate());
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setError(null);
    try {
      await ensureRecurringExpenseHorizon(supabase, household.id, horizonDate());
      const rows = await listHouseholdTransactions(supabase, household.id);
      setExpenses(rows.filter((row) => row.type === 'expense'
        && row.economic_state !== 'cancelled' && row.economic_state !== 'reversed'
        && !row.mutation_dependencies.has_recurring_occurrence
        && !row.mutation_dependencies.has_installment_plan
        && !row.mutation_dependencies.has_financial_obligation
        && !row.mutation_dependencies.has_external_payment_event));
    } catch { setError('Não foi possível carregar os gastos disponíveis para recorrência.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [household?.id]);
  const selected = useMemo(() => expenses.find((expense) => expense.id === transactionId) ?? null, [expenses, transactionId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household || !selected) return;
    if (startDate <= selected.transaction_date) { setError('O primeiro próximo gasto precisa ser depois do gasto usado como referência.'); return; }
    if (endDate && endDate < startDate) { setError('A data final não pode ser anterior ao primeiro próximo gasto.'); return; }
    if (!Number.isInteger(intervalCount) || intervalCount < 1) { setError('O intervalo precisa ser de pelo menos 1 período.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      await createRecurringExpenseFromTransaction(supabase, {
        householdId: household.id, transactionId: selected.id, frequency, intervalCount, startDate, endDate,
      });
      await ensureRecurringExpenseHorizon(supabase, household.id, horizonDate());
      setSuccess('Recorrência criada. Comprador, responsabilidade e forma de pagamento foram preservados; o pagador real continua sendo confirmado somente quando houver funding/caixa.');
      setTransactionId(''); setEndDate(''); setIntervalCount(1);
      await load(); onCreated?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar a recorrência.'); }
    finally { setSaving(false); }
  };

  return <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
    <div className="flex items-start gap-3"><CalendarClock className="mt-0.5 h-5 w-5 text-amber-300"/><div><h2 className="font-bold">Gasto recorrente</h2><p className="mt-1 text-sm text-slate-400">Use um gasto já cadastrado como referência. O Casa preserva quem comprou, quem assume economicamente e o instrumento; nunca presume quem vai efetivamente pagar.</p></div></div>
    {loading ? <LoaderCircle className="mx-auto mt-4 h-5 w-5 animate-spin"/> : <form onSubmit={submit} className="mt-4 grid gap-3">
      <label className="text-sm font-semibold">Qual gasto vai se repetir?<select value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">Selecione</option>{expenses.map((expense) => <option key={expense.id} value={expense.id}>{expense.description} · {money(expense.amount)} · {expense.transaction_date}</option>)}</select></label>
      {selected && <p className="rounded-xl bg-slate-950 p-3 text-xs text-slate-400">Referência: comprador {selected.buyer?.display_name ?? 'não informado'} · instrumento {selected.payment_instrument?.kind === 'card' ? 'cartão' : selected.payment_instrument?.kind === 'account' ? 'conta/dinheiro' : 'não informado'}. A responsabilidade econômica é copiada do ledger, não do titular do instrumento.</p>}
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Frequência<select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringExpenseFrequency)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></label><label className="text-sm font-semibold">A cada<input type="number" min={1} value={intervalCount} onChange={(e) => setIntervalCount(Number(e.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"/></label></div>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Próxima ocorrência<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"/></label><label className="text-sm font-semibold">Termina em (opcional)<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"/></label></div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
      <button disabled={saving || !transactionId || expenses.length === 0} className="min-h-11 rounded-xl bg-amber-500 px-4 font-bold text-slate-950 disabled:opacity-50">{saving ? 'Criando…' : 'Criar recorrência'}</button>
    </form>}
  </section>;
}
