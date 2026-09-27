import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Banknote, CalendarClock, CreditCard, Landmark, LoaderCircle, PiggyBank, Receipt, UserRound, Utensils, WalletCards } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount, type HouseholdCard } from '../../finance/householdFinancialAccounts.js';
import { listHouseholdCategories, type HouseholdCategory } from '../../finance/householdCategories.js';
import { allocateCustomAmounts, allocateEqually, allocateProportionally, type EconomicAllocation } from '../../finance/economicAllocations.js';
import { createAndSettleSharedExpense, createHouseholdTransaction, type InstrumentKind, type TransactionInput } from '../../finance/householdTransactions.js';
import { createAndSettleDirectExpense } from '../../finance/explicitExpenseCreation.js';
import { createSimpleCardPixExpense } from '../../finance/simpleCardPixExpense.js';
import { createExternallyPaidExpense, createExternallyPaidExpenseWithRepaymentPlan } from '../../finance/externallyPaidExpense.js';
import { createFinancialParty, listFinancialParties, type FinancialParty } from '../../finance/financialParties.js';
import { closeRecurringExpenseRule, createRecurringExpenseFromTransaction, ensureRecurringExpenseHorizon, findRecurringExpenseRuleForTransaction } from '../../finance/recurringExpenses.js';
import { recurringExpenseBlockReason, recurringExpenseEndDate, recurringExpenseHorizonDate } from '../../finance/newExpenseRecurrence.js';
import { FinancialActionDialogHeader } from './FinancialActionDialogHeader.js';
import { clearPendingExpenseRecurrence, loadPendingExpenseRecurrence, savePendingExpenseRecurrence, type PendingExpenseRecurrence } from '../../finance/newExpenseRecurrenceRecovery.js';
import { dateInTimeZone, DEFAULT_HOUSEHOLD_TIMEZONE } from '../../finance/householdClock.js';
import { consumeResourceExpenseIntent } from '../../finance/resourceExpenseIntent.js';
import { suggestRecurringStartDate } from './newExpenseRecurrenceUx.js';

type PaymentChoice = 'account' | 'cash' | 'benefit' | 'card' | 'card_pix' | 'external';
type PurchaseMode = 'single' | 'installments';
type RepaymentMode = 'one_time' | 'installments';
type Props = { openRequestId: number; onSaved: () => void };

const paidAtForDate = (value: string) => new Date(`${value}T12:00:00`).toISOString();
const errorMessage = (cause: unknown, fallback: string) => {
  if (cause instanceof Error && cause.message) return cause.message;
  if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') return cause.message;
  return fallback;
};
const casaResponsibilityAmount = (allocations: EconomicAllocation[]) => allocations.reduce(
  (sum, allocation) => sum + (allocation.memberId ? Number(allocation.amount) : 0),
  0,
);

export function NewExpenseWizard({ openRequestId, onSaved }: Props) {
  const { user, household, householdMembers } = useSupabaseAuth();
  const [resourceIntent,setResourceIntent]=useState(()=>consumeResourceExpenseIntent());
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
  const [date, setDate] = useState(()=>dateInTimeZone(household?.timezone ?? DEFAULT_HOUSEHOLD_TIMEZONE));
  const [description, setDescription] = useState('');
  const [whereWithWhom, setWhereWithWhom] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [responsibility, setResponsibility] = useState('');
  const [responsiblePartyId, setResponsiblePartyId] = useState('');
  const [responsiblePartySearch, setResponsiblePartySearch] = useState('');
  const [customResponsibility, setCustomResponsibility] = useState<Record<string, string>>({});
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('account');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [purchaseMode, setPurchaseMode] = useState<PurchaseMode>('single');
  const [installmentCount, setInstallmentCount] = useState(2);
  const [financialCharges, setFinancialCharges] = useState('0');
  const [partySearch, setPartySearch] = useState('');
  const [payerPartyId, setPayerPartyId] = useState('');
  const [needsRepayment, setNeedsRepayment] = useState(false);
  const [repaymentMode, setRepaymentMode] = useState<RepaymentMode>('one_time');
  const [repaymentInstallmentCount, setRepaymentInstallmentCount] = useState(2);
  const [repaymentDueDate, setRepaymentDueDate] = useState('');
  const [repaymentSourceAccountId, setRepaymentSourceAccountId] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringStartDate, setRecurringStartDate] = useState('');
  const [recurringStartDateTouched, setRecurringStartDateTouched] = useState(false);
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [recurringDuration, setRecurringDuration] = useState<'3'|'6'|'12'|'ongoing'|'custom'>('12');
  const [customRecurringMonths, setCustomRecurringMonths] = useState(5);
  const [createdTransactionId, setCreatedTransactionId] = useState<string | null>(null);
  const [createdRecurringRuleId, setCreatedRecurringRuleId] = useState<string | null>(null);
  const [recurrenceRecovery, setRecurrenceRecovery] = useState<PendingExpenseRecurrence | null>(null);

  const currentMemberId = householdMembers.find((member) => member.profile_id === user?.id)?.id ?? '';
  const today = dateInTimeZone(household?.timezone ?? DEFAULT_HOUSEHOLD_TIMEZONE);
  const expenseCategories = useMemo(() => categories.filter((category) => category.type === 'expense'), [categories]);
  const spendableAccounts = useMemo(() => accounts.filter((account) => account.type !== 'investment'), [accounts]);
  const repaymentAccountChoices = useMemo(() => spendableAccounts.filter((account) => account.type !== 'meal_benefit'), [spendableAccounts]);
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null;
  const cardPayment = paymentChoice === 'card' || paymentChoice === 'card_pix';
  const externalPayment = paymentChoice === 'external';
  const financedTotal = Number(amount || 0) + (paymentChoice === 'card_pix' ? Number(financialCharges || 0) : 0);
  const partyMatches = useMemo(() => {
    const query = partySearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return parties.slice(0, 6);
    return parties.filter((party) => party.name.toLocaleLowerCase('pt-BR').includes(query)).slice(0, 6);
  }, [parties, partySearch]);
  const responsiblePartyMatches = useMemo(() => {
    const query = responsiblePartySearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return parties.slice(0, 6);
    return parties.filter((party) => party.name.toLocaleLowerCase('pt-BR').includes(query)).slice(0, 6);
  }, [parties, responsiblePartySearch]);
  const exactParty = parties.some((party) => party.name.trim().toLocaleLowerCase('pt-BR') === partySearch.trim().toLocaleLowerCase('pt-BR'));
  const exactResponsibleParty = parties.some((party) => party.name.trim().toLocaleLowerCase('pt-BR') === responsiblePartySearch.trim().toLocaleLowerCase('pt-BR'));
  const hasPartyResponsibility = responsibility === 'party' || (
    responsibility === 'split-custom' && parties.some((party) => Number(customResponsibility[`party:${party.id}`] ?? 0) > 0)
  );
  const recurringBlockedReason = recurringExpenseBlockReason({ paymentChoice, purchaseMode, hasPartyResponsibility });
  const accountResourceMeta=(account:HouseholdAccount)=>{
    const ownerIds=account.owner_member_ids?.length?account.owner_member_ids:account.owner_member_id?[account.owner_member_id]:[];
    const owners=ownerIds.map(id=>householdMembers.find(member=>member.id===id)?.display_name).filter((name):name is string=>Boolean(name));
    return {subtitle:account.institution?.trim()||'Recurso da Casa',detail:owners.length?owners.join(' + '):null};
  };
  const cardResourceMeta=(card:HouseholdCard)=>{
    const owner=householdMembers.find(member=>member.id===card.owner_member_id)?.display_name;
    return {subtitle:card.institution?.trim()||'Cartão',detail:[owner,card.last_four?'final '+card.last_four:null].filter(Boolean).join(' · ')||null};
  };

  const reset = () => {
    const memberId = currentMemberId;
    setStep(1); setBuyerMemberId(memberId); setDate(today); setDescription(''); setWhereWithWhom(''); setCategoryId('');
    setAmount(''); setResponsibility(memberId); setResponsiblePartyId(''); setResponsiblePartySearch(''); setCustomResponsibility({}); setPaymentChoice('account'); setAccountId(''); setCardId('');
    setPurchaseMode('single'); setInstallmentCount(2); setFinancialCharges('0');
    setPartySearch(''); setPayerPartyId(''); setNeedsRepayment(false); setRepaymentMode('one_time');
    setRepaymentInstallmentCount(2); setRepaymentDueDate(''); setRepaymentSourceAccountId('');
    setRecurring(false); setRecurringStartDate(''); setRecurringStartDateTouched(false); setRecurringEndDate(''); setRecurringDuration('12'); setCustomRecurringMonths(5);
    setCreatedTransactionId(null); setCreatedRecurringRuleId(null); setRecurrenceRecovery(null); setError(null);
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
    } catch (cause) {
      setAccounts([]); setCards([]); setCategories([]); setParties([]);
      setError(errorMessage(cause, 'Não foi possível conferir contas, cartões, categorias e pessoas da Casa.'));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (openRequestId <= 0 || openRequestId === handledRequestId) return;
    const pending = household ? loadPendingExpenseRecurrence(household.id) : null;
    setHandledRequestId(openRequestId); reset();
    if (pending) {
      setStep(2); setRecurring(true);
      setRecurringStartDate(pending.startDate); setRecurringStartDateTouched(true); setRecurringEndDate(pending.endDate);
      setCreatedTransactionId(pending.transactionId); setCreatedRecurringRuleId(pending.recurringRuleId); setRecurrenceRecovery(pending);
    }
    setOpen(true); void loadContext();
  }, [openRequestId, handledRequestId, household?.id, currentMemberId]);

  const chooseAccountResource = (account: HouseholdAccount) => {
    const nextChoice: PaymentChoice = account.type === 'cash' ? 'cash' : account.type === 'meal_benefit' ? 'benefit' : 'account';
    setPaymentChoice(nextChoice); setAccountId(account.id); setCardId(''); setPurchaseMode('single'); setFinancialCharges('0');
  };
  const chooseCardResource = (card: HouseholdCard) => {
    setPaymentChoice('card'); setCardId(card.id); setAccountId(''); setPurchaseMode('single'); setFinancialCharges('0');
  };
  const chooseExternalPayment = () => {
    setPaymentChoice('external'); setAccountId(''); setCardId(''); setPurchaseMode('single'); setFinancialCharges('0');
  };
  const chooseCardRoute = (route:'single'|'installments'|'pix') => {
    if(route==='pix'){setPaymentChoice('card_pix');setPurchaseMode('single');return;}
    setPaymentChoice('card');setPurchaseMode(route);
  };

  useEffect(() => {
    if (!open || !resourceIntent || accounts.length === 0) return;
    const account = accounts.find((item) => item.id === resourceIntent.accountId);
    if (!account) { setResourceIntent(null); return; }
    chooseAccountResource(account);
    setResourceIntent(null);
  }, [open, resourceIntent, accounts]);

  useEffect(() => {
    if (!recurring || recurringBlockedReason || recurringStartDateTouched) return;
    try {
      setRecurringStartDate(suggestRecurringStartDate(date, today));
    } catch {
      setRecurringStartDate('');
    }
  }, [recurring, recurringBlockedReason, recurringStartDateTouched, date, today]);

  useEffect(() => {
    if (!recurring || !recurringBlockedReason) return;
    setRecurring(false); setRecurringStartDate(''); setRecurringStartDateTouched(false); setRecurringEndDate(''); setRecurringDuration('12'); setCustomRecurringMonths(5);
  }, [recurring, recurringBlockedReason]);

  useEffect(() => {
    if (!recurring || !recurringStartDate) return;
    if (recurringDuration === 'ongoing') { setRecurringEndDate(''); return; }
    const count = recurringDuration === 'custom' ? customRecurringMonths : Number(recurringDuration);
    if (!Number.isInteger(count) || count < 1) { setRecurringEndDate(''); return; }
    try { setRecurringEndDate(recurringExpenseEndDate(recurringStartDate, count)); }
    catch { setRecurringEndDate(''); }
  }, [recurring, recurringStartDate, recurringDuration, customRecurringMonths]);

  const enableRecurrence = () => {
    if (recurringBlockedReason) return;
    setRecurring(true); setRecurringStartDateTouched(false); setRecurringEndDate(''); setRecurringDuration('12'); setCustomRecurringMonths(5);
    try { setRecurringStartDate(suggestRecurringStartDate(date, today)); }
    catch { setRecurringStartDate(''); }
  };

  const disableRecurrence = () => {
    setRecurring(false); setRecurringStartDate(''); setRecurringStartDateTouched(false); setRecurringEndDate(''); setRecurringDuration('12'); setCustomRecurringMonths(5);
  };

  const goToStep2 = () => {
    setError(null);
    if (!buyerMemberId) return setError('Informe quem fez esse gasto.');
    if (!description.trim()) return setError('Informe com o que você gastou.');
    if (!date) return setError('Informe quando o gasto aconteceu.');
    if (date > today) return setDate(today);
    setStep(2);
  };

  const responsibilityTargets = () => responsibility === 'split'
    ? householdMembers.map((member) => ({ memberId: member.id }))
    : responsibility === 'party' ? [{ partyId: responsiblePartyId }] : [{ memberId: responsibility }];

  const responsibilityAllocations = (): EconomicAllocation[] => responsibility === 'split-custom'
    ? allocateCustomAmounts(amount, [
      ...householdMembers.map((member) => ({ memberId: member.id, value: customResponsibility[`member:${member.id}`] ?? '0' })),
      ...parties.map((party) => ({ partyId: party.id, value: customResponsibility[`party:${party.id}`] ?? '0' })),
    ])
    : allocateEqually(amount, responsibilityTargets());

  let previewCasaRepayableAmount = 0;
  try { previewCasaRepayableAmount = casaResponsibilityAmount(responsibilityAllocations()); } catch { previewCasaRepayableAmount = 0; }
  const repaymentInstallmentValue = repaymentInstallmentCount > 0 ? previewCasaRepayableAmount / repaymentInstallmentCount : 0;

  const registerPartyInline = async (role: 'payer' | 'responsible') => {
    const name = role === 'payer' ? partySearch.trim() : responsiblePartySearch.trim();
    if (!supabase || !household || !name) return;
    setCreatingParty(true); setError(null);
    try {
      const id = await createFinancialParty(supabase, household.id, name);
      const created: FinancialParty = { id, name, kind: 'person', tax_id: null, notes: null };
      setParties((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      if (role === 'payer') setPayerPartyId(id);
      else setResponsiblePartyId(id);
    } catch (cause) {
      setError(errorMessage(cause, 'Não foi possível cadastrar essa pessoa agora.'));
    } finally { setCreatingParty(false); }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household || !user) return;
    setError(null);

    if (recurrenceRecovery) {
      setSaving(true);
      let recovery = recurrenceRecovery;
      try {
        if (recovery.legacyIntent && recovery.recurringRuleId) {
          await closeRecurringExpenseRule(supabase, {
            householdId: recovery.householdId,
            ruleId: recovery.recurringRuleId,
            effectiveFrom: recovery.startDate,
            reason: 'Migrada para recorrência mensal da Release 1',
          });
          recovery = { ...recovery, recurringRuleId: null };
          savePendingExpenseRecurrence(recovery);
          setCreatedRecurringRuleId(null);
          setRecurrenceRecovery(recovery);
        }

        let ruleId = recovery.legacyIntent ? null : recovery.recurringRuleId;
        ruleId ??= await findRecurringExpenseRuleForTransaction(supabase, {
          householdId: recovery.householdId,
          transactionId: recovery.transactionId,
          startDate: recovery.startDate,
          endDate: recovery.endDate,
        });
        if (!ruleId) {
          ruleId = String(await createRecurringExpenseFromTransaction(supabase, {
            householdId: recovery.householdId,
            transactionId: recovery.transactionId,
            startDate: recovery.startDate,
            endDate: recovery.endDate,
          }));
        }
        recovery = { ...recovery, recurringRuleId: ruleId };
        savePendingExpenseRecurrence(recovery); setCreatedRecurringRuleId(ruleId); setRecurrenceRecovery(recovery);
        await ensureRecurringExpenseHorizon(supabase, recovery.householdId, recurringExpenseHorizonDate(recovery.startDate));
        clearPendingExpenseRecurrence(recovery.householdId); setRecurrenceRecovery(null); setOpen(false); onSaved();
      } catch (cause) {
        setError(`A despesa já foi registrada. A recorrência ainda não foi concluída e o gasto não será cadastrado novamente. ${errorMessage(cause, 'Tente concluir a recorrência novamente.')}`);
      } finally { setSaving(false); }
      return;
    }

    if (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return setError('Informe um valor maior que zero.');
    if (!responsibility) return setError('Informe quem assume esse gasto.');
    if (responsibility === 'party' && !responsiblePartyId) return setError('Selecione a outra pessoa responsável.');
    if (date > today) return setError('A data do gasto não pode estar no futuro.');
    if (paymentChoice === 'card_pix' && (!Number.isFinite(Number(financialCharges)) || Number(financialCharges) < 0)) return setError('Informe um valor de encargos financeiros igual ou maior que zero.');
    if (cardPayment && !cardId) return setError('Selecione o cartão utilizado.');
    if (!cardPayment && !externalPayment && !accountId) return setError('Selecione o recurso utilizado.');
    if (purchaseMode === 'installments' && cardPayment && installmentCount < 2) return setError('Informe pelo menos 2 parcelas.');
    if (externalPayment && !payerPartyId) return setError('Informe quem pagou.');
    if (externalPayment && needsRepayment && !repaymentDueDate) return setError(repaymentMode === 'installments' ? 'Informe a data da primeira devolução.' : 'Informe quando pretende devolver.');
    if (externalPayment && needsRepayment && repaymentDueDate < date) return setError('A devolução não pode ficar antes da data do gasto.');
    if (externalPayment && needsRepayment && repaymentMode === 'installments' && (repaymentInstallmentCount < 2 || repaymentInstallmentCount > 120)) return setError('Informe entre 2 e 120 parcelas para a devolução.');
    if (externalPayment && needsRepayment && !repaymentSourceAccountId) return setError('Informe de qual recurso pretende fazer a devolução.');
    if (recurring && recurringBlockedReason) return setError(recurringBlockedReason);
    if (recurring && (!recurringStartDate || recurringStartDate <= today || recurringStartDate <= date)) return setError('Informe a primeira repetição em uma data futura.');
    if (recurring && recurringEndDate && recurringEndDate < recurringStartDate) return setError('A data final da recorrência não pode ser anterior à primeira repetição.');

    let splits: EconomicAllocation[];
    try { splits = responsibilityAllocations(); }
    catch (cause) { return setError(errorMessage(cause, 'Confira a divisão de responsabilidade.')); }
    const casaRepayableAmount = casaResponsibilityAmount(splits);
    if (externalPayment && needsRepayment && casaRepayableAmount <= 0) return setError('Não há valor de responsabilidade da Casa para devolver.');
    if (externalPayment && needsRepayment && repaymentMode === 'installments' && repaymentInstallmentCount > Math.round(casaRepayableAmount * 100)) {
      return setError('Reduza a quantidade de parcelas: cada devolução precisa ter pelo menos R$ 0,01.');
    }
    const appliedInstallmentCount = cardPayment && purchaseMode === 'installments' ? installmentCount : 1;
    const instrumentKind: InstrumentKind = cardPayment ? 'card' : 'account';
    const input: TransactionInput = {
      description: description.trim(), amount, transactionDate: date, categoryId: categoryId || (null as unknown as string),
      buyerMemberId, notes: whereWithWhom.trim(), instrumentKind,
      accountId: !cardPayment && !externalPayment ? accountId : undefined,
      cardId: cardPayment ? cardId : undefined, splits, installmentCount: appliedInstallmentCount,
    };

    setSaving(true);
    let savedTransactionId = createdTransactionId;
    let savedRecurringRuleId = createdRecurringRuleId;
    try {
      if (!savedTransactionId && externalPayment) {
        if (needsRepayment) {
          savedTransactionId = String(await createExternallyPaidExpenseWithRepaymentPlan(supabase, {
            householdId: household.id, description, amount, transactionDate: date, categoryId: categoryId || null,
            buyerMemberId, responsibility: splits, payerPartyId, repaymentMode,
            installmentCount: repaymentMode === 'one_time' ? 1 : repaymentInstallmentCount,
            firstDueDate: repaymentDueDate, plannedSourceAccountId: repaymentSourceAccountId, notes: whereWithWhom,
          }));
        } else {
          savedTransactionId = String(await createExternallyPaidExpense(supabase, {
            householdId: household.id, description, amount, transactionDate: date, categoryId: categoryId || null,
            buyerMemberId, responsibility: splits, payerPartyId, needsRepayment: false, dueDate: null, notes: whereWithWhom,
          }));
        }
      } else if (!savedTransactionId && paymentChoice === 'card_pix') {
        const chargeSplits = allocateProportionally(financialCharges || '0', splits);
        savedTransactionId = String(await createSimpleCardPixExpense(supabase, {
          householdId: household.id, description, principalAmount: amount, financialChargeAmount: financialCharges || '0',
          transactionDate: date, categoryId: categoryId || null, buyerMemberId, cardId,
          principalResponsibility: splits, chargeResponsibility: chargeSplits,
          installmentCount: appliedInstallmentCount, notes: whereWithWhom,
        }));
      } else if (!savedTransactionId && instrumentKind === 'account') {
        const owners = selectedAccount?.owner_member_ids ?? [];
        if (owners.length < 1 || owners.length > 2) throw new Error('Não foi possível identificar com segurança de quem é este recurso. Confira a titularidade em Ajustes.');
        // The settlement engine already attributes exactly-two-owner joint liquidity 50/50.
        // The RPC still requires one valid funder id, so use the sole owner or a deterministic owner for joint resources.
        const funderMemberId = owners.length === 1 ? owners[0] : [...owners].sort()[0];
        savedTransactionId = String(splits.some((split) => split.partyId)
          ? await createAndSettleSharedExpense(supabase, household.id, input, funderMemberId, null)
          : await createAndSettleDirectExpense(supabase, household.id, input, funderMemberId, paidAtForDate(date)));
      } else if (!savedTransactionId) {
        savedTransactionId = String(await createHouseholdTransaction(supabase, household.id, 'expense', input));
      }
      if (!savedTransactionId || savedTransactionId === 'null' || savedTransactionId === 'undefined') throw new Error('A despesa foi processada sem retornar uma referência válida.');
      setCreatedTransactionId(savedTransactionId);

      if (recurring) {
        let recovery: PendingExpenseRecurrence = {
          householdId: household.id,
          transactionId: savedTransactionId,
          recurringRuleId: savedRecurringRuleId,
          startDate: recurringStartDate,
          endDate: recurringEndDate,
        };
        savePendingExpenseRecurrence(recovery); setRecurrenceRecovery(recovery);
        if (!savedRecurringRuleId) {
          savedRecurringRuleId = String(await createRecurringExpenseFromTransaction(supabase, {
            householdId: household.id,
            transactionId: savedTransactionId,
            startDate: recurringStartDate,
            endDate: recurringEndDate,
          }));
          setCreatedRecurringRuleId(savedRecurringRuleId);
          recovery = { ...recovery, recurringRuleId: savedRecurringRuleId };
          savePendingExpenseRecurrence(recovery); setRecurrenceRecovery(recovery);
        }
        await ensureRecurringExpenseHorizon(supabase, household.id, recurringExpenseHorizonDate(recurringStartDate));
        clearPendingExpenseRecurrence(household.id); setRecurrenceRecovery(null);
      }
      setOpen(false); onSaved();
    } catch (cause) {
      if (savedTransactionId && recurring) {
        setError(`A despesa já foi registrada. A recorrência ainda não foi concluída e o gasto não será cadastrado novamente. ${errorMessage(cause, 'Tente concluir a recorrência novamente.')}`);
      } else {
        setError(errorMessage(cause, 'Não foi possível registrar a despesa.'));
      }
    } finally { setSaving(false); }
  };

  if (!open) return null;

  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 p-4 sm:items-center">
    <form onSubmit={save} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
      <FinancialActionDialogHeader tone="expense" eyebrow="Gasto" title="Nova despesa" icon={<Receipt className="h-5 w-5"/>} onClose={()=>setOpen(false)} closeLabel="Fechar nova despesa"/>
      <div className="p-4">
      {loading && <div className="flex min-h-40 items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-blue-300" /></div>}

      {!loading && recurrenceRecovery && <div className="mt-5 space-y-4">
        <div className="rounded-2xl border border-amber-800/70 bg-amber-950/30 p-4">
          <h2 className="font-bold text-amber-100">Despesa já registrada</h2>
          <p className="mt-2 text-sm text-amber-200">{recurrenceRecovery.legacyIntent ? 'A despesa já está salva. A intenção de recorrência antiga será convertida para o padrão mensal atual sem cadastrar o gasto novamente.' : 'Falta apenas concluir a recorrência. O Casa preservou a referência do gasto e não vai cadastrá-lo novamente.'}</p>
          <p className="mt-2 text-xs text-slate-400">Primeira repetição: {recurrenceRecovery.startDate} · depois, uma vez por mês.</p>
        </div>
        {error && <ErrorBox text={error} />}
        <button type="submit" disabled={saving} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 font-bold text-slate-950 disabled:opacity-50">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Concluir recorrência</button>
      </div>}

      {!loading && !recurrenceRecovery && step === 1 && <div className="mt-5 space-y-4">
        <label className="block text-sm text-slate-300">Quem fez esse gasto? <span className="text-rose-300">*</span><select required value={buyerMemberId} onChange={(event) => setBuyerMemberId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3">{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
        <label className="block text-sm text-slate-300">Quando? <span className="text-rose-300">*</span><input required type="date" max={today} value={date} onChange={(event) => setDate(event.target.value > today ? today : event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /></label>
        <label className="block text-sm text-slate-300">Com o que gastou? <span className="text-rose-300">*</span><input required value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" placeholder="Ex.: mercado, aluguel, pneu do carro" /></label>
        <label className="block text-sm text-slate-300">Onde/com quem? <span className="text-slate-500">(opcional)</span><input value={whereWithWhom} onChange={(event) => setWhereWithWhom(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /></label>
        <label className="block text-sm text-slate-300">Categoria <span className="text-slate-500">(opcional)</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3"><option value="">Sem categoria por enquanto</option>{expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        {error && <ErrorBox text={error} />}
        <button type="button" onClick={goToStep2} className="min-h-12 w-full rounded-2xl bg-rose-600 font-bold">Continuar</button>
      </div>}

      {!loading && !recurrenceRecovery && step === 2 && <div className="mt-5 space-y-5">
        <label className="block text-sm font-semibold text-slate-200">Quanto? <span className="text-rose-300">*</span><div className="mt-2 flex min-h-16 items-center rounded-2xl border border-blue-500/40 bg-slate-800 px-4 shadow-sm"><span className="mr-2 text-lg text-slate-400">R$</span><input required inputMode="decimal" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} onBlur={() => { if (amount && Number.isFinite(Number(amount))) setAmount(Number(amount).toFixed(2)); }} className="min-h-14 w-full bg-transparent text-2xl font-black outline-none" placeholder="0,00" /></div></label>

        <fieldset><legend className="text-sm font-semibold text-slate-200">Quem assume esse gasto? <span className="text-rose-300">*</span></legend><div className="mt-2 grid grid-cols-2 gap-2">{householdMembers.map((member) => <ChoiceButton key={member.id} active={responsibility === member.id} onClick={() => setResponsibility(member.id)} label={member.display_name} />)}<ChoiceButton active={responsibility === 'split'} onClick={() => setResponsibility('split')} label="Dividir igualmente" /><ChoiceButton active={responsibility === 'split-custom'} onClick={() => setResponsibility('split-custom')} label="Divisão personalizada" /><ChoiceButton active={responsibility === 'party'} onClick={() => setResponsibility('party')} label="Outra pessoa envolvida" /></div>
          {responsibility === 'party' && <div className="mt-3 rounded-xl border border-slate-700 p-3"><label className="block text-sm text-slate-300">Pessoa responsável<input value={responsiblePartySearch} onChange={(event) => { setResponsiblePartySearch(event.target.value); setResponsiblePartyId(''); }} placeholder="Busque pelo nome" className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /></label><div className="mt-2 space-y-2">{responsiblePartyMatches.map((party) => <button key={party.id} type="button" onClick={() => { setResponsiblePartyId(party.id); setResponsiblePartySearch(party.name); }} className={`w-full rounded-xl border p-3 text-left text-sm ${responsiblePartyId === party.id ? 'border-blue-500 bg-blue-950/50 text-blue-100' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>{party.name}</button>)}{responsiblePartySearch.trim() && !exactResponsibleParty && <button type="button" disabled={creatingParty} onClick={() => void registerPartyInline('responsible')} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-700 text-sm font-semibold text-blue-200 disabled:opacity-50">{creatingParty && <LoaderCircle className="h-4 w-4 animate-spin" />}Cadastrar “{responsiblePartySearch.trim()}”</button>}</div><span className="mt-2 block text-xs text-slate-500">Isso define responsabilidade econômica, não quem pagou.</span></div>}
          {responsibility === 'split-custom' && <div className="mt-3 space-y-2 rounded-xl border border-slate-700 p-3"><p className="text-xs text-slate-400">Informe apenas quem participa. A soma deve fechar exatamente o total.</p>{householdMembers.map((member) => <AllocationField key={`member:${member.id}`} label={member.display_name} value={customResponsibility[`member:${member.id}`] ?? ''} onChange={(value) => setCustomResponsibility((current) => ({ ...current, [`member:${member.id}`]: value }))} />)}{parties.map((party) => <AllocationField key={`party:${party.id}`} label={party.name} value={customResponsibility[`party:${party.id}`] ?? ''} onChange={(value) => setCustomResponsibility((current) => ({ ...current, [`party:${party.id}`]: value }))} />)}</div>}
        </fieldset>

        <fieldset><legend className="text-sm font-semibold text-slate-200">De onde saiu ou será cobrado? <span className="text-rose-300">*</span></legend><div className="mt-2 grid grid-cols-2 gap-2">{spendableAccounts.map(account=>{const meta=accountResourceMeta(account);return <ResourceChoice key={account.id} active={!cardPayment&&!externalPayment&&accountId===account.id} onClick={()=>chooseAccountResource(account)} icon={<AccountTypeIcon type={account.type}/>} title={account.name} subtitle={meta.subtitle} detail={meta.detail}/>})}{cards.map(card=>{const meta=cardResourceMeta(card);return <ResourceChoice key={card.id} active={cardPayment&&cardId===card.id} onClick={()=>chooseCardResource(card)} icon={<CreditCard className="h-5 w-5"/>} title={card.name} subtitle={meta.subtitle} detail={meta.detail}/>})}<ResourceChoice active={externalPayment} onClick={chooseExternalPayment} icon={<UserRound className="h-5 w-5"/>} title="Outra pessoa pagou" subtitle="Pagamento fora dos recursos da Casa"/></div>{spendableAccounts.length===0&&cards.length===0&&<p className="mt-2 text-xs text-amber-300">Nenhum recurso financeiro está cadastrado. Cadastre uma conta, carteira ou cartão em Ajustes.</p>}</fieldset>

        {!cardPayment && !externalPayment && selectedAccount && <p className="rounded-xl bg-emerald-950/30 p-3 text-xs text-emerald-200">{(selectedAccount.owner_member_ids?.length ?? 0) === 1 ? `O dinheiro sai de ${selectedAccount.name}. O Casa identifica automaticamente quem bancou pela titularidade confirmada desse recurso.` : `O dinheiro sai de ${selectedAccount.name}. Como o recurso é compartilhado, o Casa usa a participação dos titulares para calcular os acertos.`}</p>}

        {cardPayment && <div className="space-y-3 rounded-2xl border border-violet-900/60 bg-violet-950/20 p-4"><div><p className="text-sm font-semibold text-violet-100">{cards.find(card=>card.id===cardId)?.name??'Cartão selecionado'}</p><p className="mt-1 text-xs text-slate-400">Como esta operação ficou no cartão?</p></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-3"><ChoiceButton active={paymentChoice==='card'&&purchaseMode==='single'} onClick={()=>chooseCardRoute('single')} label="Compra à vista"/><ChoiceButton active={paymentChoice==='card'&&purchaseMode==='installments'} onClick={()=>chooseCardRoute('installments')} label="Compra parcelada"/><ChoiceButton active={paymentChoice==='card_pix'} onClick={()=>chooseCardRoute('pix')} label="Pix com este cartão"/></div>{paymentChoice==='card_pix'&&<fieldset><legend className="text-sm text-slate-300">O Pix foi parcelado?</legend><div className="mt-2 grid grid-cols-2 gap-2"><ChoiceButton active={purchaseMode==='single'} onClick={()=>setPurchaseMode('single')} label="Não"/><ChoiceButton active={purchaseMode==='installments'} onClick={()=>setPurchaseMode('installments')} label="Sim"/></div></fieldset>}{purchaseMode === 'installments' && <label className="block text-sm text-slate-300">Quantas parcelas?<input type="number" min="2" max="120" value={installmentCount} onChange={(event) => setInstallmentCount(Number(event.target.value))} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /></label>}{paymentChoice === 'card_pix' && <><label className="block text-sm text-slate-300">Encargos financeiros<div className="mt-1 flex min-h-12 items-center rounded-xl bg-slate-800 px-3"><span className="mr-2 text-slate-500">R$</span><input required inputMode="decimal" type="number" min="0" step="0.01" value={financialCharges} onChange={(event) => setFinancialCharges(event.target.value)} onBlur={() => { if (financialCharges && Number.isFinite(Number(financialCharges))) setFinancialCharges(Number(financialCharges).toFixed(2)); }} className="min-h-11 w-full bg-transparent outline-none" /></div></label><div className="rounded-xl bg-slate-950/60 p-3 text-xs"><MoneyRow label="Valor do Pix" value={Number(amount || 0)} /><MoneyRow label="Encargos" value={Number(financialCharges || 0)} /><div className="mt-2 border-t border-slate-800 pt-2"><MoneyRow label="Total no cartão" value={financedTotal} strong /></div></div></>}</div>}

        {externalPayment && <div className="space-y-4 rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-4">
          <div><p className="text-sm font-semibold text-slate-200">Quem pagou?</p><input value={partySearch} onChange={(event) => { setPartySearch(event.target.value); setPayerPartyId(''); }} placeholder="Busque pelo nome" className="mt-2 min-h-12 w-full rounded-xl bg-slate-800 p-3" /><div className="mt-2 space-y-2">{partyMatches.map((party) => <button key={party.id} type="button" onClick={() => { setPayerPartyId(party.id); setPartySearch(party.name); }} className={`w-full rounded-xl border p-3 text-left text-sm ${payerPartyId === party.id ? 'border-emerald-500 bg-emerald-950/50 text-emerald-100' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>{party.name}</button>)}{partySearch.trim() && !exactParty && <button type="button" disabled={creatingParty} onClick={() => void registerPartyInline('payer')} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-700 text-sm font-semibold text-emerald-200 disabled:opacity-50">{creatingParty && <LoaderCircle className="h-4 w-4 animate-spin" />}Cadastrar “{partySearch.trim()}”</button>}</div></div>
          <fieldset><legend className="text-sm font-semibold text-slate-200">Você precisa devolver?</legend><div className="mt-2 grid grid-cols-2 gap-2"><ChoiceButton active={!needsRepayment} onClick={() => { setNeedsRepayment(false); setRepaymentDueDate(''); setRepaymentSourceAccountId(''); }} label="Não" /><ChoiceButton active={needsRepayment} onClick={() => setNeedsRepayment(true)} label="Sim" /></div></fieldset>
          {needsRepayment && <div className="space-y-4 border-t border-emerald-900/50 pt-4">
            {previewCasaRepayableAmount <= 0 && <p className="rounded-xl border border-amber-800/70 bg-amber-950/30 p-3 text-xs text-amber-200">Não há valor de responsabilidade da Casa para devolver neste rateio.</p>}
            {previewCasaRepayableAmount > 0 && <p className="text-xs text-slate-400">Valor de responsabilidade da Casa a devolver: {previewCasaRepayableAmount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>}
            <fieldset><legend className="text-sm font-semibold text-slate-200">Como pretende devolver?</legend><div className="mt-2 grid grid-cols-2 gap-2"><ChoiceButton active={repaymentMode === 'one_time'} onClick={() => setRepaymentMode('one_time')} label="Uma vez" /><ChoiceButton active={repaymentMode === 'installments'} onClick={() => setRepaymentMode('installments')} label="Parcelado" /></div></fieldset>
            {repaymentMode === 'installments' && <label className="block text-sm text-slate-300">Quantas parcelas?<input required type="number" min="2" max="120" value={repaymentInstallmentCount} onChange={(event) => setRepaymentInstallmentCount(Number(event.target.value))} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /><span className="mt-1 block text-xs text-slate-500">Aprox. {repaymentInstallmentValue.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} por parcela</span></label>}
            <label className="block text-sm text-slate-300">{repaymentMode === 'installments' ? 'Primeira devolução' : 'Quando pretende devolver?'}<input required type="date" min={date} value={repaymentDueDate} onChange={(event) => setRepaymentDueDate(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3" /></label>
            <label className="block text-sm text-slate-300">De qual recurso pretende pagar?<select required value={repaymentSourceAccountId} onChange={(event) => setRepaymentSourceAccountId(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{repaymentAccountChoices.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{repaymentAccountChoices.length === 0 && <span className="mt-1 block text-xs text-amber-300">Cadastre uma conta ou carteira antes de planejar a devolução.</span>}</label>
          </div>}
        </div>}

        <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4" aria-label="Recorrência opcional">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300"><CalendarClock className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><p className="font-semibold text-slate-200">Repetir este gasto</p><p className="mt-0.5 text-xs text-slate-500">Opcional · próximas ocorrências entram como projeção.</p></div>
            {!recurringBlockedReason && <button type="button" aria-pressed={recurring} onClick={recurring ? disableRecurrence : enableRecurrence} className={`min-h-10 shrink-0 rounded-xl px-3 text-sm font-bold ${recurring ? 'bg-slate-800 text-slate-200' : 'bg-blue-500/10 text-blue-300'}`}>{recurring ? 'Remover' : 'Adicionar'}</button>}
          </div>
          {recurringBlockedReason && <p className="mt-3 rounded-xl bg-slate-900/70 p-3 text-xs leading-5 text-slate-400"><strong className="text-slate-300">Não disponível neste caso.</strong> {recurringBlockedReason}</p>}
          {recurring && !recurringBlockedReason && <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
            <p className="text-xs leading-5 text-slate-400">O gasto atual é registrado uma vez. Depois, o Casa prevê <strong className="text-slate-300">uma nova ocorrência por mês</strong>, no mesmo dia-base. Em conta, fim de semana ou feriado nacional ajusta somente a data financeira prevista.</p>
            <div className="space-y-3"><div className="rounded-xl bg-slate-900/70 p-3 text-xs text-slate-400"><span className="block font-semibold text-slate-300">Primeira repetição</span><span>{recurringStartDate ? new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${recurringStartDate}T12:00:00Z`)).replace('.','') : 'Calculando…'}</span><span className="mt-1 block">O Casa calcula automaticamente o próximo mês preservando o dia-base.</span></div><fieldset><legend className="text-sm font-semibold text-slate-200">Por quanto tempo quer repetir?</legend><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><ChoiceButton active={recurringDuration==='3'} onClick={()=>setRecurringDuration('3')} label="3 meses"/><ChoiceButton active={recurringDuration==='6'} onClick={()=>setRecurringDuration('6')} label="6 meses"/><ChoiceButton active={recurringDuration==='12'} onClick={()=>setRecurringDuration('12')} label="12 meses"/><ChoiceButton active={recurringDuration==='ongoing'} onClick={()=>setRecurringDuration('ongoing')} label="Até eu parar"/></div><button type="button" onClick={()=>setRecurringDuration('custom')} className={`mt-2 min-h-10 rounded-xl border px-3 text-xs font-semibold ${recurringDuration==='custom'?'border-blue-500 bg-blue-950/40 text-blue-200':'border-slate-700 text-slate-400'}`}>Outro período</button>{recurringDuration==='custom'&&<label className="mt-2 block text-sm text-slate-300">Quantas próximas ocorrências?<input type="number" min="1" max="120" value={customRecurringMonths} onChange={event=>setCustomRecurringMonths(Math.max(1,Math.min(120,Number(event.target.value)||1)))} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"/><span className="mt-1 block text-[11px] text-slate-500">Ex.: 5 significa as próximas 5 ocorrências mensais.</span></label>}<p className="mt-2 text-[11px] text-slate-500">{recurringDuration==='ongoing'?'Continua mensalmente até você encerrar.':`${recurringDuration==='custom'?customRecurringMonths:Number(recurringDuration)} próximas ocorrências · término calculado automaticamente.`}</p></fieldset></div>
          </div>}
        </section>

        {error && <ErrorBox text={error} />}
        <div className="space-y-2"><button type="submit" disabled={saving} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 text-base font-black disabled:opacity-50">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Registrar despesa</button><button type="button" onClick={() => { setError(null); setStep(1); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800"><ArrowLeft className="h-4 w-4" />Voltar</button></div>
      </div>}
      </div>
    </form>
  </div>;
}

function AccountTypeIcon({type}:{type:HouseholdAccount['type']}){const Icon=type==='cash'?Banknote:type==='savings'?PiggyBank:type==='meal_benefit'?Utensils:type==='checking'?Landmark:WalletCards;return <Icon className="h-4 w-4"/>;}
function ResourceChoice({active,onClick,icon,title,subtitle,detail}:{key?:string;active:boolean;onClick:()=>void;icon:ReactNode;title:string;subtitle:string;detail?:string|null}){return <button type="button" onClick={onClick} aria-pressed={active} className={`flex min-h-[58px] min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2 text-left ${active?'border-blue-500 bg-blue-950/40':'border-slate-700 bg-slate-800'}`}><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4 ${active?'bg-blue-500/15 text-blue-200':'bg-slate-900 text-slate-400'}`}>{icon}</span><span className="min-w-0 flex-1"><strong className="block truncate text-xs font-semibold">{title}</strong><span className="mt-0.5 block truncate text-[10px] leading-3.5 text-slate-500">{subtitle}</span>{detail&&<span className="block truncate text-[10px] leading-3.5 text-slate-400">{detail}</span>}</span></button>;}
function ChoiceButton({ active, onClick, label }: { key?: string; active: boolean; onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${active ? 'border-blue-500 bg-blue-950/50 text-blue-100' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>{label}</button>;
}
function AllocationField({ label, value, onChange }: { key?: string; label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex items-center justify-between gap-3 text-sm text-slate-300"><span className="min-w-0 truncate">{label}</span><span className="flex min-h-10 w-32 items-center rounded-lg bg-slate-800 px-3"><span className="mr-1 text-xs text-slate-500">R$</span><input aria-label={`Responsabilidade de ${label}`} inputMode="decimal" type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent text-right outline-none" placeholder="0,00" /></span></label>;
}
function ErrorBox({ text }: { text: string }) { return <p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/30 p-3 text-sm text-rose-200">{text}</p>; }
function MoneyRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) { return <div className={`flex justify-between gap-3 ${strong ? 'font-bold text-slate-100' : 'text-slate-400'}`}><span>{label}</span><span>{value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>; }
