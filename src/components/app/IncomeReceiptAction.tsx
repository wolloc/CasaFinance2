import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CheckCircle2, LoaderCircle, WalletCards } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount } from '../../finance/householdFinancialAccounts.js';
import { listHouseholdTransactions, type HouseholdTransaction } from '../../finance/householdTransactions.js';
import { settleHouseholdIncome } from '../../finance/incomeReceipts.js';

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function IncomeReceiptAction({ onCompleted }: { onCompleted?: () => void }) {
  const { household, householdMembers } = useSupabaseAuth();
  const [incomes, setIncomes] = useState<HouseholdTransaction[]>([]);
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([]);
  const [transactionId, setTransactionId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [beneficiaryMemberId, setBeneficiaryMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [receivedDate, setReceivedDate] = useState(localDate());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true);
    try {
      const [transactions, resources] = await Promise.all([
        listHouseholdTransactions(supabase, household.id),
        listHouseholdFinancialAccounts(supabase, household.id),
      ]);
      setIncomes(transactions.filter((row) => row.type === 'income' && !['cancelled', 'reversed'].includes(row.economic_state) && Number(row.realized_amount) < Number(row.amount)));
      setAccounts(resources.accounts.filter((account) => ['cash', 'checking', 'savings', 'digital_wallet'].includes(account.type) && account.resource_restriction == null));
    } catch {
      setError('Não foi possível carregar as entradas pendentes e os recursos da Casa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [household?.id]);

  const selected = useMemo(() => incomes.find((income) => income.id === transactionId) ?? null, [incomes, transactionId]);
  const remaining = selected ? Math.max(0, Number(selected.amount) - Number(selected.realized_amount)) : 0;

  const chooseIncome = (id: string) => {
    setTransactionId(id);
    const income = incomes.find((row) => row.id === id);
    setAmount(income ? String(Math.max(0, Number(income.amount) - Number(income.realized_amount))) : '');
    setError(null); setSuccess(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household || !selected) { setError('Escolha qual renda entrou.'); return; }
    const numericAmount = Number(amount.replace(',', '.'));
    if (!destinationAccountId) { setError('Informe onde o dinheiro realmente entrou.'); return; }
    if (!beneficiaryMemberId) { setError('Informe de quem é esta renda.'); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Informe um valor recebido maior que zero.'); return; }
    if (numericAmount - remaining > 0.005) { setError(`O valor recebido não pode ultrapassar o saldo pendente de ${money(remaining)}.`); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      await settleHouseholdIncome(supabase, {
        householdId: household.id,
        transactionId: selected.id,
        destinationAccountId,
        beneficiaryMemberId,
        amount: String(numericAmount),
        receivedAt: new Date(`${receivedDate}T12:00:00`).toISOString(),
      });
      setSuccess('Recebimento registrado. Agora esta renda entrou no caixa real da Casa.');
      setTransactionId(''); setAmount('');
      await load();
      onCompleted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o recebimento.');
    } finally { setSaving(false); }
  };

  return <section className="rounded-2xl border border-emerald-900/70 bg-emerald-950/20 p-4">
    <div className="flex items-start gap-3"><WalletCards className="mt-0.5 h-5 w-5 text-emerald-300" /><div><h2 className="font-bold">Uma renda prevista realmente entrou?</h2><p className="mt-1 text-sm text-slate-400">Criar a entrada registra o fato econômico. Só esta confirmação movimenta o caixa e define explicitamente <strong>de quem é a renda</strong> e <strong>onde o dinheiro entrou</strong>.</p></div></div>
    {loading ? <LoaderCircle className="mx-auto mt-4 h-5 w-5 animate-spin" /> : incomes.length === 0 ? <p className="mt-4 text-sm text-slate-400">Não há renda pendente para confirmar.</p> : <form onSubmit={submit} className="mt-4 grid gap-3">
      <label className="text-sm font-semibold">Qual renda entrou?<select value={transactionId} onChange={(e) => chooseIncome(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"><option value="">Selecione</option>{incomes.map((income) => <option key={income.id} value={income.id}>{income.description} · falta {money(Number(income.amount) - Number(income.realized_amount))}</option>)}</select></label>
      <label className="text-sm font-semibold">De quem é esta renda?<select value={beneficiaryMemberId} onChange={(e) => setBeneficiaryMemberId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"><option value="">Selecione</option>{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
      <label className="text-sm font-semibold">Onde o dinheiro realmente entrou?<select value={destinationAccountId} onChange={(e) => setDestinationAccountId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Valor recebido<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3" /></label><label className="text-sm font-semibold">Data do caixa<input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3" /></label></div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{success && <p role="status" className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />{success}</p>}
      <button disabled={saving || !transactionId} className="min-h-11 rounded-xl bg-emerald-600 px-4 font-bold disabled:opacity-50">{saving ? 'Registrando…' : 'Confirmar recebimento'}</button>
    </form>}
  </section>;
}
