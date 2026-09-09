import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, CreditCard, Landmark, LoaderCircle, WalletCards, X } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount, type HouseholdCard } from '../../finance/householdFinancialAccounts.js';
import { listHouseholdCategories, type HouseholdCategory } from '../../finance/householdCategories.js';
import { allocateEqually } from '../../finance/economicAllocations.js';
import { createHouseholdTransaction, type InstrumentKind, type TransactionInput } from '../../finance/householdTransactions.js';
import { createAndSettleDirectExpense } from '../../finance/explicitExpenseCreation.js';

type PaymentChoice = 'account' | 'cash' | 'benefit' | 'card';
type PurchaseMode = 'single' | 'installments';

type Props = {
  openRequestId: number;
  onSaved: () => void;
};

const localDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const paidAtForDate = (value: string) => new Date(`${value}T12:00:00`).toISOString();

export function NewExpenseWizard({ openRequestId, onSaved }: Props) {
  const { user, household, householdMembers } = useSupabaseAuth();
  const [open, setOpen] = useState(false);
  const [handledRequestId, setHandledRequestId] = useState(0);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([]);
  const [cards, setCards] = useState<HouseholdCard[]>([]);
  const [categories, setCategories] = useState<HouseholdCategory[]>([]);

  const [buyerMemberId, setBuyerMemberId] = useState('');
  const [date, setDate] = useState(localDate());
  const [description, setDescription] = useState('');
  const [whereWithWhom, setWhereWithWhom] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const [amount, setAmount] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('account');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>('single');
  const [installmentCount, setInstallmentCount] = useState(2);
  const [sharedAccountFunderId, setSharedAccountFunderId] = useState('');

  const currentMemberId = householdMembers.find((member) => member.profile_id === user?.id)?.id ?? '';
  const today = localDate();

  const expenseCategories = useMemo(() => categories.filter((category) => category.type === 'expense'), [categories]);
  const spendableAccounts = useMemo(() => accounts.filter((account) => account.type !== 'investment'), [accounts]);
  const accountChoices = useMemo(() => {
    if (paymentChoice === 'cash') return spendableAccounts.filter((account) => account.type === 'cash');
    if (paymentChoice === 'benefit') return spendableAccounts.filter((account) => account.type === 'meal_benefit');
    return spendableAccounts.filter((account) => account.type !== 'cash' && account.type !== 'meal_benefit');
  }, [paymentChoice, spendableAccounts]);
  const selectedAccount = accountChoices.find((account) => account.id === accountId) ?? accounts.find((account) => account.id === accountId) ?? null;

  const reset = () => {
    const memberId = currentMemberId;
    setStep(1);
    setBuyerMemberId(memberId);
    setDate(today);
    setDescription('');
    setWhereWithWhom('');
    setCategoryId('');
    setAmount('');
    setResponsibility(memberId);
    setPaymentChoice('account');
    setAccountId('');
    setCardId('');
    setPurchaseMode('single');
    setInstallmentCount(2);
    setSharedAccountFunderId(memberId);
    setError(null);
  };

  const loadContext = async () => {
    if (!supabase || !household) return;
    setLoading(true);
    setError(null);
    try {
      const [financial, categoryRows] = await Promise.all([
        listHouseholdFinancialAccounts(supabase, household.id),
        listHouseholdCategories(supabase, household.id),
      ]);
      setAccounts(financial.accounts);
      setCards(financial.cards);
      setCategories(categoryRows);
    } catch {
      setAccounts([]);
      setCards([]);
      setCategories([]);
      setError('Não foi possível conferir contas, cartões e categorias da Casa. Tente novamente antes de registrar a despesa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (openRequestId <= 0 || openRequestId === handledRequestId) return;
    setHandledRequestId(openRequestId);
    reset();
    setOpen(true);
    void loadContext();
  }, [openRequestId, handledRequestId, household?.id, currentMemberId]);

  useEffect(() => {
    setAccountId('');
  }, [paymentChoice]);

  const goToStep2 = () => {
    setError(null);
    if (!buyerMemberId) return setError('Informe quem fez esse gasto.');
    if (!description.trim()) return setError('Informe com o que você gastou.');
    if (!date) return setError('Informe quando o gasto aconteceu.');
    if (date > today) return setError('Nova Despesa registra algo que já aconteceu. Escolha hoje ou uma data passada.');
    setStep(2);
  };

  const responsibilityTargets = () => {
    if (responsibility === 'split') return householdMembers.map((member) => ({ memberId: member.id }));
    return [{ memberId: responsibility }];
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household || !user) return;
    setError(null);
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return setError('Informe um valor maior que zero.');
    if (!responsibility) return setError('Informe quem assume esse gasto.');
    if (date > today) return setError('A data do gasto não pode estar no futuro.');

    const instrumentKind: InstrumentKind = paymentChoice === 'card' ? 'card' : 'account';
    if (instrumentKind === 'card' && !cardId) return setError('Selecione o cartão utilizado.');
    if (instrumentKind === 'account' && !accountId) return setError('Selecione o recurso utilizado.');
    if (purchaseMode === 'installments' && instrumentKind === 'card' && installmentCount < 2) return setError('Informe pelo menos 2 parcelas.');

    const splits = allocateEqually(amount, responsibilityTargets());
    const input: TransactionInput = {
      description: description.trim(),
      amount,
      transactionDate: date,
      categoryId: categoryId || (null as unknown as string),
      buyerMemberId,
      notes: whereWithWhom.trim(),
      instrumentKind,
      accountId: instrumentKind === 'account' ? accountId : undefined,
      cardId: instrumentKind === 'card' ? cardId : undefined,
      splits,
      installmentCount: instrumentKind === 'card' && purchaseMode === 'installments' ? installmentCount : 1,
    };

    setSaving(true);
    try {
      if (instrumentKind === 'account') {
        const funderMemberId = selectedAccount?.owner_member_id || sharedAccountFunderId || currentMemberId;
        if (!funderMemberId) throw new Error('Não foi possível identificar quem bancou esta saída.');
        await createAndSettleDirectExpense(supabase, household.id, input, funderMemberId, paidAtForDate(date));
      } else {
        await createHouseholdTransaction(supabase, household.id, 'expense', input);
      }
      setOpen(false);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a despesa.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 p-4 sm:items-center">
    <form onSubmit={save} className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-300">Nova despesa</p>
          <h2 className="mt-1 text-xl font-black">{step === 1 ? 'O que aconteceu?' : 'Sobre o valor'}</h2>
          <p className="mt-1 text-xs text-slate-500">Etapa {step} de 2</p>
        </div>
        <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button>
      </div>

      {loading && <div className="flex min-h-40 items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-blue-300" /></div>}

      {!loading && step === 1 && <div className="mt-5 space-y-4">
        <label className="block text-sm text-slate-300">Quem fez esse gasto? <span className="text-rose-300">*</span>
          <select required value={buyerMemberId} onChange={(event) => setBuyerMemberId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3">
            {householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}
          </select>
          <span className="mt-1 block text-xs text-slate-500">Quem originou o gasto. Isso não define quem pagou nem quem deve assumir.</span>
        </label>

        <label className="block text-sm text-slate-300">Quando? <span className="text-rose-300">*</span>
          <input required type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" />
        </label>

        <label className="block text-sm text-slate-300">Com o que gastou? <span className="text-rose-300">*</span>
          <input required value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" placeholder="Ex.: mercado, aluguel, pneu do carro" />
        </label>

        <label className="block text-sm text-slate-300">Onde/com quem? <span className="text-slate-500">(opcional)</span>
          <input value={whereWithWhom} onChange={(event) => setWhereWithWhom(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" />
        </label>

        <label className="block text-sm text-slate-300">Categoria <span className="text-slate-500">(opcional)</span>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3">
            <option value="">Sem categoria por enquanto</option>
            {expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>

        {error && <p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}
        <button type="button" onClick={goToStep2} className="min-h-12 w-full rounded-xl bg-blue-600 font-bold">Continuar</button>
      </div>}

      {!loading && step === 2 && <div className="mt-5 space-y-5">
        <label className="block text-sm text-slate-300">Quanto? <span className="text-rose-300">*</span>
          <div className="mt-1 flex min-h-14 items-center rounded-xl bg-slate-800 px-3"><span className="mr-2 text-slate-500">R$</span><input required inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="min-h-12 w-full bg-transparent text-lg font-bold outline-none" placeholder="0,00" /></div>
        </label>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-200">Quem assume esse gasto? <span className="text-rose-300">*</span></legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {householdMembers.map((member) => <button key={member.id} type="button" onClick={() => setResponsibility(member.id)} aria-pressed={responsibility === member.id} className={`min-h-12 rounded-xl border px-3 text-sm font-semibold ${responsibility === member.id ? 'border-blue-500 bg-blue-950/50 text-blue-100' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>{member.display_name}</button>)}
            <button type="button" onClick={() => setResponsibility('split')} aria-pressed={responsibility === 'split'} className={`min-h-12 rounded-xl border px-3 text-sm font-semibold ${responsibility === 'split' ? 'border-blue-500 bg-blue-950/50 text-blue-100' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>Dividir</button>
          </div>
          {responsibility === 'split' && <p className="mt-2 text-xs text-slate-500">Nesta primeira entrega, “Dividir” reparte igualmente entre os dois membros. A divisão personalizada entra na próxima evolução da jornada.</p>}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-200">Como foi pago? <span className="text-rose-300">*</span></legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PaymentButton active={paymentChoice === 'account'} onClick={() => setPaymentChoice('account')} icon={<Landmark className="h-4 w-4" />} label="Conta / Pix" />
            <PaymentButton active={paymentChoice === 'cash'} onClick={() => setPaymentChoice('cash')} icon={<WalletCards className="h-4 w-4" />} label="Carteira / dinheiro" />
            <PaymentButton active={paymentChoice === 'benefit'} onClick={() => setPaymentChoice('benefit')} icon={<WalletCards className="h-4 w-4" />} label="VA/VR/benefício" />
            <PaymentButton active={paymentChoice === 'card'} onClick={() => setPaymentChoice('card')} icon={<CreditCard className="h-4 w-4" />} label="Cartão de crédito" />
          </div>
        </fieldset>

        {paymentChoice !== 'card' && <label className="block text-sm text-slate-300">Qual recurso foi usado?
          <select required value={accountId} onChange={(event) => { setAccountId(event.target.value); setSharedAccountFunderId(currentMemberId); }} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3">
            <option value="">Selecione</option>
            {accountChoices.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          {accountChoices.length === 0 && <span className="mt-1 block text-xs text-amber-300">Nenhum recurso desse tipo está cadastrado na Casa.</span>}
        </label>}

        {paymentChoice !== 'card' && selectedAccount && !selectedAccount.owner_member_id && <label className="block text-sm text-slate-300">Quem bancou esta saída?
          <span className="block text-xs text-slate-500">Essa pergunta aparece somente porque o recurso selecionado é compartilhado e o Casa ainda precisa registrar o funding por membro.</span>
          <select required value={sharedAccountFunderId} onChange={(event) => setSharedAccountFunderId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3">
            {householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}
          </select>
        </label>}

        {paymentChoice === 'card' && <div className="space-y-3 rounded-2xl border border-violet-900/60 bg-violet-950/20 p-4">
          <label className="block text-sm text-slate-300">Qual cartão?
            <select required value={cardId} onChange={(event) => setCardId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select>
          </label>
          <fieldset><legend className="text-sm text-slate-300">Como foi a compra?</legend><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setPurchaseMode('single')} className={`min-h-11 rounded-xl border text-sm font-semibold ${purchaseMode === 'single' ? 'border-violet-500 bg-violet-950/50' : 'border-slate-700 bg-slate-800'}`}>À vista</button><button type="button" onClick={() => setPurchaseMode('installments')} className={`min-h-11 rounded-xl border text-sm font-semibold ${purchaseMode === 'installments' ? 'border-violet-500 bg-violet-950/50' : 'border-slate-700 bg-slate-800'}`}>Parcelada</button></div></fieldset>
          {purchaseMode === 'installments' && <label className="block text-sm text-slate-300">Quantas parcelas?<input type="number" min="2" max="120" value={installmentCount} onChange={(event) => setInstallmentCount(Number(event.target.value))} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /></label>}
          <p className="text-xs text-violet-200">O gasto econômico é reconhecido uma vez. O cartão cria os compromissos da fatura; nenhuma conta bancária é reduzida agora.</p>
        </div>}

        {error && <p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</p>}

        <div className="flex gap-3"><button type="button" onClick={() => { setError(null); setStep(1); }} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 font-semibold"><ArrowLeft className="h-4 w-4" />Voltar</button><button type="submit" disabled={saving} className="flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Registrar despesa</button></div>
        <p className="text-center text-[11px] text-slate-500">Pix por cartão, outra pessoa pagou, terceiro envolvido e recorrência serão conectados nesta mesma jornada nas próximas entregas, sem criar formulários paralelos.</p>
      </div>}
    </form>
  </div>;
}

function PaymentButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold ${active ? 'border-blue-500 bg-blue-950/50 text-blue-100' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>{icon}<span>{label}</span></button>;
}
