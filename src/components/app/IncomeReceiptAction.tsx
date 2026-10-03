import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, LoaderCircle, WalletCards } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount } from '../../finance/householdFinancialAccounts.js';
import { listHouseholdIncomeTransactions, type HouseholdTransaction } from '../../finance/householdTransactions.js';
import { settleHouseholdIncome } from '../../finance/incomeReceipts.js';

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function IncomeReceiptAction({ onCompleted, initialMoneyMovementId, initialTransactionId }: { onCompleted?: () => void; initialMoneyMovementId?: string; initialTransactionId?: string }) {
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const handledIntent = useRef(false);

  const clearLoadedContext = () => {
    setIncomes([]);
    setAccounts([]);
    setTransactionId('');
    setDestinationAccountId('');
    setAmount('');
  };

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setLoadError(null); setError(null);
    try {
      const [transactions, resources] = await Promise.all([
        listHouseholdIncomeTransactions(supabase, household.id),
        listHouseholdFinancialAccounts(supabase, household.id),
      ]);
      const pending = transactions.filter((row) => row.type === 'income' && !['cancelled', 'reversed'].includes(row.economic_state) && Number(row.realized_amount) < Number(row.amount));
      setIncomes(pending);
      setAccounts(resources.accounts.filter((account) => ['cash', 'checking', 'savings', 'digital_wallet', 'meal_benefit'].includes(account.type)));
      if ((initialMoneyMovementId || initialTransactionId) && !handledIntent.current) {
        handledIntent.current = true;
        let targetId = initialTransactionId ?? null;
        let movementData:{related_transaction_id:string|null;beneficiary_member_id:string|null;destination_account_id:string|null}|null=null;
        if (initialMoneyMovementId) {
          const movement = await supabase.from('money_movements').select('related_transaction_id,beneficiary_member_id,destination_account_id').eq('household_id', household.id).eq('id', initialMoneyMovementId).maybeSingle();
          if (movement.error) throw movement.error;
          movementData=movement.data as typeof movementData;
          targetId = movementData?.related_transaction_id ?? null;
        } else if (initialTransactionId) {
          const movement = await supabase.from('money_movements').select('related_transaction_id,beneficiary_member_id,destination_account_id').eq('household_id', household.id).eq('related_transaction_id', initialTransactionId).eq('kind','income').order('movement_date',{ascending:true}).limit(1).maybeSingle();
          if (movement.error) throw movement.error;
          movementData=movement.data as typeof movementData;
        }
        const target = pending.find((income) => income.id === targetId);
        if (target) {
          setTransactionId(target.id);
          setAmount(String(Math.max(0, Number(target.amount) - Number(target.realized_amount))));
          setBeneficiaryMemberId(movementData?.beneficiary_member_id??'');
          setDestinationAccountId(movementData?.destination_account_id??'');
          setEditingDetails(false);
        } else {
          setError('Essa entrada mudou ou já foi resolvida. O Casa atualizou os dados antes de permitir qualquer recebimento.');
        }
      }
    } catch {
      clearLoadedContext();
      setLoadError('Não foi possível conferir as entradas pendentes e os recursos da Casa. Nenhum recebimento pode ser registrado até uma nova leitura válida.');
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

  const confirmReceipt = async () => {
    if (loadError) { setError('Recarregue os dados antes de registrar um recebimento.'); return; }
    if (!supabase || !household || !selected) { setError('Escolha qual renda entrou.'); return; }
    const numericAmount = Number(amount.replace(',', '.'));
    if (!destinationAccountId) { setError('Informe onde o dinheiro realmente entrou.'); setEditingDetails(true); return; }
    if (!beneficiaryMemberId) { setError('Informe de quem é esta renda.'); setEditingDetails(true); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Informe um valor recebido maior que zero.'); setEditingDetails(true); return; }
    if (numericAmount - remaining > 0.005) { setError(`O valor recebido não pode ultrapassar o saldo pendente de ${money(remaining)}.`); setEditingDetails(true); return; }
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
      setSuccess('Entrada confirmada. O valor agora faz parte do caixa real da Casa.');
      setTransactionId(''); setAmount('');
      await load();
      onCompleted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o recebimento.');
    } finally { setSaving(false); }
  };
  const submit = async (event: FormEvent) => { event.preventDefault(); await confirmReceipt(); };

  const compactIntent=Boolean((initialMoneyMovementId||initialTransactionId)&&selected&&!editingDetails);
  const beneficiaryName=householdMembers.find(member=>member.id===beneficiaryMemberId)?.display_name??'Pessoa não identificada';
  const destinationName=accounts.find(account=>account.id===destinationAccountId)?.name??'Recurso não identificado';

  return <section className="rounded-2xl border border-emerald-900/50 bg-emerald-950/10 p-4">
    {loading ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin" /> : loadError ? <div className="rounded-xl border border-rose-900 bg-rose-950/30 p-3"><p role="alert" className="text-sm text-rose-200">{loadError}</p><button type="button" onClick={()=>void load()} className="mt-3 min-h-11 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200">Tentar novamente</button></div> : incomes.length === 0 ? <p className="text-sm text-slate-400">Não há entrada pendente para confirmar.</p> : compactIntent ? <div>
      <div className="flex items-start gap-3"><WalletCards className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-emerald-300">Essa entrada aconteceu?</p><h2 className="mt-0.5 truncate font-bold">{selected.description}</h2><strong className="mt-1 block text-lg text-emerald-200">{money(remaining)}</strong></div></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-950/55 p-3"><span className="text-slate-500">De quem</span><strong className="mt-1 block truncate text-slate-200">{beneficiaryName}</strong></div><div className="rounded-xl bg-slate-950/55 p-3"><span className="text-slate-500">Onde entra</span><strong className="mt-1 block truncate text-slate-200">{destinationName}</strong></div></div>
      {error&&<p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      <button type="button" disabled={saving} onClick={()=>void confirmReceipt()} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-600 px-4 font-bold disabled:opacity-50">{saving?'Confirmando…':'Sim, entrou como previsto'}</button>
      <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={()=>setSuccess('Mantida como prevista. Nenhum saldo foi alterado.')} className="min-h-10 rounded-xl text-xs font-semibold text-slate-400">Ainda não entrou</button><button type="button" onClick={()=>{setEditingDetails(true);setSuccess(null)}} className="min-h-10 rounded-xl text-xs font-semibold text-blue-300">Entrou diferente</button></div>
      {success&&<p role="status" className="mt-2 text-xs text-slate-400">{success}</p>}
    </div> : <div>
      <div className="flex items-start gap-3"><WalletCards className="mt-0.5 h-5 w-5 text-emerald-300"/><div><h2 className="font-bold">Confirmar entrada</h2><p className="mt-1 text-xs text-slate-500">Ajuste apenas o que aconteceu diferente do previsto.</p></div></div>
      <form onSubmit={submit} className="mt-4 grid gap-3">
      {!initialMoneyMovementId&&!initialTransactionId&&<label className="text-sm font-semibold">Qual entrada?<select value={transactionId} onChange={(e) => chooseIncome(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"><option value="">Selecione</option>{incomes.map((income) => <option key={income.id} value={income.id}>{income.description} · falta {money(Number(income.amount) - Number(income.realized_amount))}</option>)}</select></label>}
      <label className="text-sm font-semibold">De quem é?<select value={beneficiaryMemberId} onChange={(e) => setBeneficiaryMemberId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"><option value="">Selecione</option>{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
      <label className="text-sm font-semibold">Onde entrou?<select value={destinationAccountId} onChange={(e) => setDestinationAccountId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Valor<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3" /></label><label className="text-sm font-semibold">Data<input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3" /></label></div>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{success && <p role="status" className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />{success}</p>}
      <button disabled={saving || !transactionId} className="min-h-11 rounded-xl bg-emerald-600 px-4 font-bold disabled:opacity-50">{saving ? 'Registrando…' : 'Confirmar entrada'}</button>
      {(initialMoneyMovementId||initialTransactionId)&&<button type="button" onClick={()=>{setEditingDetails(false);setError(null)}} className="min-h-10 text-xs font-semibold text-slate-400">Voltar ao resumo</button>}
    </form></div>}
  </section>;
}
