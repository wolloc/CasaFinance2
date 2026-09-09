import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, CreditCard, Landmark, LoaderCircle, UserRound, WalletCards, X } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount, type HouseholdCard } from '../../finance/householdFinancialAccounts.js';
import { listHouseholdCategories, type HouseholdCategory } from '../../finance/householdCategories.js';
import { allocateEqually } from '../../finance/economicAllocations.js';
import { createHouseholdTransaction, type InstrumentKind, type TransactionInput } from '../../finance/householdTransactions.js';
import { createAndSettleDirectExpense } from '../../finance/explicitExpenseCreation.js';
import { createSimpleCardPixExpense } from '../../finance/simpleCardPixExpense.js';
import { createExternallyPaidExpense } from '../../finance/externallyPaidExpense.js';
import { createFinancialParty, listFinancialParties, type FinancialParty } from '../../finance/financialParties.js';

type PaymentChoice = 'account' | 'cash' | 'benefit' | 'card' | 'card_pix' | 'external';
type PurchaseMode = 'single' | 'installments';
type Props = { openRequestId: number; onSaved: () => void };

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
  const [creatingParty, setCreatingParty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([]);
  const [cards, setCards] = useState<HouseholdCard[]>([]);
  const [categories, setCategories] = useState<HouseholdCategory[]>([]);
  const [parties, setParties] = useState<FinancialParty[]>([]);

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
  const [financialCharges, setFinancialCharges] = useState('0');
  const [sharedAccountFunderId, setSharedAccountFunderId] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [payerPartyId, setPayerPartyId] = useState('');
  const [needsRepayment, setNeedsRepayment] = useState(false);
  const [repaymentDueDate, setRepaymentDueDate] = useState('');

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
  const cardPayment = paymentChoice === 'card' || paymentChoice === 'card_pix';
  const externalPayment = paymentChoice === 'external';
  const financedTotal = Number(amount || 0) + (paymentChoice === 'card_pix' ? Number(financialCharges || 0) : 0);
  const partyMatches = useMemo(() => {
    const query = partySearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return parties.slice(0, 6);
    return parties.filter((party) => party.name.toLocaleLowerCase('pt-BR').includes(query)).slice(0, 6);
  }, [parties, partySearch]);
  const exactParty = parties.some((party) => party.name.trim().toLocaleLowerCase('pt-BR') === partySearch.trim().toLocaleLowerCase('pt-BR'));

  const reset = () => {
    const memberId = currentMemberId;
    setStep(1); setBuyerMemberId(memberId); setDate(today); setDescription(''); setWhereWithWhom(''); setCategoryId('');
    setAmount(''); setResponsibility(memberId); setPaymentChoice('account'); setAccountId(''); setCardId('');
    setPurchaseMode('single'); setInstallmentCount(2); setFinancialCharges('0'); setSharedAccountFunderId(memberId);
    setPartySearch(''); setPayerPartyId(''); setNeedsRepayment(false); setRepaymentDueDate(''); setError(null);
  };

  const loadContext = async () => {
    if (!supabase || !household) return;
    setLoading(true); setError(null);
    try {
      const [financial, categoryRows, partyRows] = await Promise.all([
        listHouseholdFinancialAccounts(supabase, household.id),
        listHouseholdCategories(supabase, household.id),
        listFinancialParties(supabase, household.id),
      ]);
      setAccounts(financial.accounts); setCards(financial.cards); setCategories(categoryRows); setParties(partyRows);
    } catch {
      setAccounts([]); setCards([]); setCategories([]); setParties([]);
      setError('Não foi possível conferir contas, cartões, categorias e pessoas da Casa. Tente novamente antes de registrar a despesa.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (openRequestId <= 0 || openRequestId === handledRequestId) return;
    setHandledRequestId(openRequestId); reset(); setOpen(true); void loadContext();
  }, [openRequestId, handledRequestId, household?.id, currentMemberId]);

  useEffect(() => { setAccountId(''); }, [paymentChoice]);

  const goToStep2 = () => {
    setError(null);
    if (!buyerMemberId) return setError('Informe quem fez esse gasto.');
    if (!description.trim()) return setError('Informe com o que você gastou.');
    if (!date) return setError('Informe quando o gasto aconteceu.');
    if (date > today) return setError('Nova Despesa registra algo que já aconteceu. Escolha hoje ou uma data passada.');
    setStep(2);
  };

  const responsibilityTargets = () => responsibility === 'split'
    ? householdMembers.map((member) => ({ memberId: member.id }))
    : [{ memberId: responsibility }];

  const registerPartyInline = async () => {
    if (!supabase || !household || !partySearch.trim()) return;
    setCreatingParty(true); setError(null);
    try {
      const id = await createFinancialParty(supabase, household.id, partySearch.trim());
      const created: FinancialParty = { id, name: partySearch.trim(), kind: 'person', tax_id: null, notes: null };
      setParties((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setPayerPartyId(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar essa pessoa agora.');
    } finally { setCreatingParty(false); }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household || !user) return;
    setError(null);
    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return setError('Informe um valor maior que zero.');
    if (!responsibility) return setError('Informe quem assume esse gasto.');
    if (date > today) return setError('A data do gasto não pode estar no futuro.');
    if (paymentChoice === 'card_pix' && (!Number.isFinite(Number(financialCharges)) || Number(financialCharges) < 0)) return setError('Informe um valor de encargos financeiros igual ou maior que zero.');
    if (cardPayment && !cardId) return setError('Selecione o cartão utilizado.');
    if (!cardPayment && !externalPayment && !accountId) return setError('Selecione o recurso utilizado.');
    if (purchaseMode === 'installments' && cardPayment && installmentCount < 2) return setError('Informe pelo menos 2 parcelas.');
    if (externalPayment && !payerPartyId) return setError('Informe quem pagou.');
    if (externalPayment && needsRepayment && !repaymentDueDate) return setError('Informe quando pretende devolver.');
    if (externalPayment && needsRepayment && repaymentDueDate < date) return setError('A devolução não pode ficar antes da data do gasto.');

    const targets = responsibilityTargets();
    const splits = allocateEqually(amount, targets);
    const appliedInstallmentCount = cardPayment && purchaseMode === 'installments' ? installmentCount : 1;
    const instrumentKind: InstrumentKind = cardPayment ? 'card' : 'account';
    const input: TransactionInput = {
      description: description.trim(), amount, transactionDate: date, categoryId: categoryId || (null as unknown as string),
      buyerMemberId, notes: whereWithWhom.trim(), instrumentKind,
      accountId: !cardPayment && !externalPayment ? accountId : undefined,
      cardId: cardPayment ? cardId : undefined, splits, installmentCount: appliedInstallmentCount,
    };

    setSaving(true);
    try {
      if (externalPayment) {
        await createExternallyPaidExpense(supabase, {
          householdId: household.id, description, amount, transactionDate: date, categoryId: categoryId || null,
          buyerMemberId, responsibility: splits, payerPartyId, needsRepayment,
          dueDate: needsRepayment ? repaymentDueDate : null, notes: whereWithWhom,
        });
      } else if (paymentChoice === 'card_pix') {
        const chargeSplits = Number(financialCharges) > 0 ? allocateEqually(financialCharges, targets) : [];
        await createSimpleCardPixExpense(supabase, {
          householdId: household.id, description, principalAmount: amount, financialChargeAmount: financialCharges || '0',
          transactionDate: date, categoryId: categoryId || null, buyerMemberId, cardId,
          principalResponsibility: splits, chargeResponsibility: chargeSplits,
          installmentCount: appliedInstallmentCount, notes: whereWithWhom,
        });
      } else if (instrumentKind === 'account') {
        const funderMemberId = selectedAccount?.owner_member_id || sharedAccountFunderId || currentMemberId;
        if (!funderMemberId) throw new Error('Não foi possível identificar quem bancou esta saída.');
        await createAndSettleDirectExpense(supabase, household.id, input, funderMemberId, paidAtForDate(date));
      } else {
        await createHouseholdTransaction(supabase, household.id, 'expense', input);
      }
      setOpen(false); onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a despesa.');
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 p-4 sm:items-center">
    <form onSubmit={save} className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-blue-300">Nova despesa</p><h2 className="mt-1 text-xl font-black">{step === 1 ? 'O que aconteceu?' : 'Sobre o valor'}</h2><p className="mt-1 text-xs text-slate-500">Etapa {step} de 2</p></div>
        <button type="button" aria-label="Fechar" onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button>
      </div>

      {loading && <div className="flex min-h-40 items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-blue-300" /></div>}

      {!loading && step === 1 && <div className="mt-5 space-y-4">
        <label className="block text-sm text-slate-300">Quem fez esse gasto? <span className="text-rose-300">*</span><select required value={buyerMemberId} onChange={(event) => setBuyerMemberId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3">{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Quem originou o gasto. Isso não define quem pagou nem quem deve assumir.</span></label>
        <label className="block text-sm text-slate-300">Quando? <span className="text-rose-300">*</span><input required type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /></label>
        <label className="block text-sm text-slate-300">Com o que gastou? <span className="text-rose-300">*</span><input required value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" placeholder="Ex.: mercado, aluguel, pneu do carro" /></label>
        <label className="block text-sm text-slate-300">Onde/com quem? <span className="text-slate-500">(opcional)</span><input value={whereWithWhom} onChange={(event) => setWhereWithWhom(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /></label>
        <label className="block text-sm text-slate-300">Categoria <span className="text-slate-500">(opcional)</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3"><option value="">Sem categoria por enquanto</option>{expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        {error && <ErrorBox text={error} />}<button type="button" onClick={goToStep2} className="min-h-12 w-full rounded-xl bg-blue-600 font-bold">Continuar</button>
      </div>}

      {!loading && step === 2 && <div className="mt-5 space-y-5">
        <label className="block text-sm text-slate-300">Quanto? <span className="text-rose-300">*</span><div className="mt-1 flex min-h-14 items-center rounded-xl bg-slate-800 px-3"><span className="mr-2 text-slate-500">R$</span><input required inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="min-h-12 w-full bg-transparent text-lg font-bold outline-none" placeholder="0,00" /></div></label>

        <fieldset><legend className="text-sm font-semibold text-slate-200">Quem assume esse gasto? <span className="text-rose-300">*</span></legend><div className="mt-2 grid grid-cols-2 gap-2">{householdMembers.map((member) => <ChoiceButton key={member.id} active={responsibility === member.id} onClick={() => setResponsibility(member.id)} label={member.display_name} />)}<ChoiceButton active={responsibility === 'split'} onClick={() => setResponsibility('split')} label="Dividir" /></div>{responsibility === 'split' && <p className="mt-2 text-xs text-slate-500">Nesta entrega, “Dividir” reparte igualmente entre os dois membros. A divisão personalizada entra na próxima evolução.</p>}</fieldset>

        <fieldset><legend className="text-sm font-semibold text-slate-200">Como foi pago? <span className="text-rose-300">*</span></legend><div className="mt-2 grid grid-cols-2 gap-2"><PaymentButton active={paymentChoice === 'account'} onClick={() => setPaymentChoice('account')} icon={<Landmark className="h-4 w-4" />} label="Conta / Pix" /><PaymentButton active={paymentChoice === 'cash'} onClick={() => setPaymentChoice('cash')} icon={<WalletCards className="h-4 w-4" />} label="Carteira / dinheiro" /><PaymentButton active={paymentChoice === 'benefit'} onClick={() => setPaymentChoice('benefit')} icon={<WalletCards className="h-4 w-4" />} label="VA/VR/benefício" /><PaymentButton active={paymentChoice === 'card'} onClick={() => setPaymentChoice('card')} icon={<CreditCard className="h-4 w-4" />} label="Cartão de crédito" /><PaymentButton active={paymentChoice === 'card_pix'} onClick={() => setPaymentChoice('card_pix')} icon={<CreditCard className="h-4 w-4" />} label="Pix por cartão" /><PaymentButton active={externalPayment} onClick={() => setPaymentChoice('external')} icon={<UserRound className="h-4 w-4" />} label="Outra pessoa pagou" /></div></fieldset>

        {!cardPayment && !externalPayment && <label className="block text-sm text-slate-300">Qual recurso foi usado?<select required value={accountId} onChange={(event) => { setAccountId(event.target.value); setSharedAccountFunderId(currentMemberId); }} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{accountChoices.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{accountChoices.length === 0 && <span className="mt-1 block text-xs text-amber-300">Nenhum recurso desse tipo está cadastrado na Casa.</span>}</label>}

        {!cardPayment && !externalPayment && selectedAccount && !selectedAccount.owner_member_id && <label className="block text-sm text-slate-300">Quem bancou esta saída?<span className="block text-xs text-slate-500">Essa pergunta aparece somente porque o recurso selecionado é compartilhado.</span><select required value={sharedAccountFunderId} onChange={(event) => setSharedAccountFunderId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3">{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>}

        {cardPayment && <div className="space-y-3 rounded-2xl border border-violet-900/60 bg-violet-950/20 p-4"><label className="block text-sm text-slate-300">Qual cartão?<select required value={cardId} onChange={(event) => setCardId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label><fieldset><legend className="text-sm text-slate-300">{paymentChoice === 'card_pix' ? 'Como ficou no cartão?' : 'Como foi a compra?'}</legend><div className="mt-2 grid grid-cols-2 gap-2"><ChoiceButton active={purchaseMode === 'single'} onClick={() => setPurchaseMode('single')} label="À vista" /><ChoiceButton active={purchaseMode === 'installments'} onClick={() => setPurchaseMode('installments')} label="Parcelado" /></div></fieldset>{purchaseMode === 'installments' && <label className="block text-sm text-slate-300">Quantas parcelas?<input type="number" min="2" max="120" value={installmentCount} onChange={(event) => setInstallmentCount(Number(event.target.value))} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /></label>}{paymentChoice === 'card_pix' && <><label className="block text-sm text-slate-300">Encargos financeiros<div className="mt-1 flex min-h-12 items-center rounded-xl bg-slate-800 px-3"><span className="mr-2 text-slate-500">R$</span><input required inputMode="decimal" type="number" min="0" step="0.01" value={financialCharges} onChange={(event) => setFinancialCharges(event.target.value)} className="min-h-11 w-full bg-transparent outline-none" /></div><span className="mt-1 block text-xs text-slate-500">Informe o total cobrado além do valor do Pix. Os encargos seguem a mesma responsabilidade econômica da despesa.</span></label><div className="rounded-xl bg-slate-950/60 p-3 text-xs"><MoneyRow label="Valor do Pix" value={Number(amount || 0)} /><MoneyRow label="Encargos" value={Number(financialCharges || 0)} /><div className="mt-2 border-t border-slate-800 pt-2"><MoneyRow label="Total no cartão" value={financedTotal} strong /></div></div></>}{paymentChoice === 'card' && <p className="text-xs text-violet-200">O gasto econômico é reconhecido uma vez. O cartão cria os compromissos da fatura; nenhuma conta bancária é reduzida agora.</p>}</div>}

        {externalPayment && <div className="space-y-4 rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-4"><div><p className="text-sm font-semibold text-slate-200">Quem pagou?</p><input value={partySearch} onChange={(event) => { setPartySearch(event.target.value); setPayerPartyId(''); }} placeholder="Busque pelo nome" className="mt-2 min-h-12 w-full rounded-xl bg-slate-800 p-3" /><div className="mt-2 space-y-2">{partyMatches.map((party) => <button key={party.id} type="button" onClick={() => { setPayerPartyId(party.id); setPartySearch(party.name); }} className={`w-full rounded-xl border p-3 text-left text-sm ${payerPartyId === party.id ? 'border-emerald-500 bg-emerald-950/50 text-emerald-100' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>{party.name}</button>)}{partySearch.trim() && !exactParty && <button type="button" disabled={creatingParty} onClick={() => void registerPartyInline()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-700 text-sm font-semibold text-emerald-200 disabled:opacity-50">{creatingParty && <LoaderCircle className="h-4 w-4 animate-spin" />}Cadastrar “{partySearch.trim()}”</button>}</div></div><fieldset><legend className="text-sm font-semibold text-slate-200">Você precisa devolver?</legend><div className="mt-2 grid grid-cols-2 gap-2"><ChoiceButton active={!needsRepayment} onClick={() => { setNeedsRepayment(false); setRepaymentDueDate(''); }} label="Não" /><ChoiceButton active={needsRepayment} onClick={() => setNeedsRepayment(true)} label="Sim" /></div><p className="mt-2 text-xs text-slate-500">Se não precisar devolver, o Casa registra apenas que outra pessoa bancou o gasto. Nenhuma entrada ou saída de caixa é inventada.</p></fieldset>{needsRepayment && <label className="block text-sm text-slate-300">Quando pretende devolver?<input required type="date" min={date} value={repaymentDueDate} onChange={(event) => setRepaymentDueDate(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /><span className="mt-1 block text-xs text-slate-500">Isso cria uma obrigação separada com essa pessoa, sem criar outra despesa. O parcelamento da devolução será conectado na próxima evolução da jornada.</span></label>}</div>}

        {error && <ErrorBox text={error} />}
        <div className="flex gap-3"><button type="button" onClick={() => { setError(null); setStep(1); }} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 font-semibold"><ArrowLeft className="h-4 w-4" />Voltar</button><button type="submit" disabled={saving} className="flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Registrar despesa</button></div>
        <p className="text-center text-[11px] text-slate-500">Terceiro como responsável econômico, divisão personalizada, parcelamento de devolução e recorrência serão conectados nas próximas entregas, sem criar formulários paralelos.</p>
      </div>}
    </form>
  </div>;
}

function PaymentButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold ${active ? 'border-blue-500 bg-blue-950/50 text-blue-100' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>{icon}<span>{label}</span></button>;
}
function ChoiceButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${active ? 'border-blue-500 bg-blue-950/50 text-blue-100' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>{label}</button>;
}
function ErrorBox({ text }: { text: string }) { return <p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-200">{text}</p>; }
function MoneyRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) { return <div className={`flex justify-between gap-3 ${strong ? 'font-bold text-slate-100' : 'text-slate-400'}`}><span>{label}</span><span>{value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>; }
