import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CreditCard, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdCard } from '../../finance/householdFinancialAccounts.js';
import { listHouseholdTransactions, type HouseholdTransaction } from '../../finance/householdTransactions.js';
import { correctCardPaymentInstrument } from '../../finance/cardPaymentInstrumentCorrection.js';

export function CardPaymentInstrumentCorrectionAction({
  initialTransactionId,
  onCompleted,
}: {
  initialTransactionId: string;
  onCompleted?: () => void;
}) {
  const { household } = useSupabaseAuth();
  const [transaction, setTransaction] = useState<HouseholdTransaction | null>(null);
  const [cards, setCards] = useState<HouseholdCard[]>([]);
  const [targetCardId, setTargetCardId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const eligible = Boolean(
    transaction
    && transaction.type === 'expense'
    && transaction.payment_instrument?.kind === 'card'
    && transaction.invoice_id
    && !transaction.mutation_dependencies.has_funding_event
    && !transaction.mutation_dependencies.has_external_payment_event
    && !transaction.mutation_dependencies.has_financial_obligation
    && !transaction.mutation_dependencies.has_installment_plan
    && !transaction.mutation_dependencies.has_recurring_occurrence,
  );

  const currentCardId = transaction?.payment_instrument?.card_id ?? '';
  const targetCards = useMemo(() => cards.filter((card) => card.id !== currentCardId), [cards, currentCardId]);

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true);
    setLoadError(null);
    setError(null);
    try {
      const [transactions, financial] = await Promise.all([
        listHouseholdTransactions(supabase, household.id),
        listHouseholdFinancialAccounts(supabase, household.id),
      ]);
      const current = transactions.find((row) => row.id === initialTransactionId) ?? null;
      setTransaction(current);
      setCards(financial.cards);
      setTargetCardId('');
    } catch {
      setTransaction(null);
      setCards([]);
      setTargetCardId('');
      setLoadError('Não foi possível conferir o lançamento e os cartões disponíveis. Nenhuma correção foi aplicada.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [household?.id, initialTransactionId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loadError || loading) {
      setError('Recarregue os dados antes de corrigir o cartão.');
      return;
    }
    if (!supabase || !household || !transaction || !eligible) return;
    if (!targetCardId) {
      setError('Escolha o cartão correto.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await correctCardPaymentInstrument(supabase, {
        householdId: household.id,
        transactionId: transaction.id,
        targetCardId,
      });
      setSuccess('Cartão corrigido. A compra foi movida para a fatura correta sem criar um novo gasto.');
      await load();
      onCompleted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível corrigir o cartão.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoaderCircle className="mx-auto my-3 h-5 w-5 animate-spin text-violet-300" />;
  if (!eligible && !loadError) return null;

  return (
    <section className="rounded-2xl border border-violet-800/70 bg-violet-950/15 p-4">
      <div className="flex items-start gap-3">
        <CreditCard className="mt-0.5 h-5 w-5 text-violet-300" />
        <div>
          <h2 className="font-bold text-violet-100">Corrigir cartão</h2>
          <p className="mt-1 text-sm text-slate-400">A compra foi lançada no cartão errado? Escolha o cartão correto e o Casa ajustará a fatura sem duplicar a despesa.</p>
        </div>
      </div>
      {loadError ? (
        <div className="mt-3 rounded-xl border border-rose-900 bg-rose-950/30 p-3">
          <p role="alert" className="text-sm text-rose-200">{loadError}</p>
          <button type="button" onClick={() => void load()} className="mt-3 min-h-10 rounded-xl border border-rose-800 px-3 text-sm font-semibold text-rose-200">Tentar novamente</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <p className="rounded-xl bg-slate-950/60 p-3 text-xs text-slate-400">
            O valor, a data, a categoria e a responsabilidade permanecem iguais. Só o cartão e a fatura serão corrigidos.
          </p>
          <label className="text-sm font-semibold">
            Cartão correto
            <select value={targetCardId} onChange={(event) => setTargetCardId(event.target.value)} required className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3">
              <option value="">Selecione</option>
              {targetCards.map((card) => <option key={card.id} value={card.id}>{card.name}{card.last_four ? ` · final ${card.last_four}` : ''}</option>)}
            </select>
          </label>
          {targetCards.length === 0 && <p className="text-xs text-amber-300">Não há outro cartão ativo disponível para receber esta compra.</p>}
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          {success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
          <button disabled={saving || !targetCardId} className="min-h-11 rounded-xl bg-violet-600 px-4 font-bold text-white disabled:opacity-50">
            {saving ? 'Corrigindo…' : 'Corrigir cartão e fatura'}
          </button>
        </form>
      )}
    </section>
  );
}
