import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CreditCard, Edit3, History, Landmark, LoaderCircle, Plus, Power, Receipt, RotateCcw, X } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount, type HouseholdCard } from '../../finance/householdFinancialAccounts.js';
import { listHouseholdCategories, type HouseholdCategory } from '../../finance/householdCategories.js';
import { cancelHouseholdTransaction, createAndSettleSharedExpense, createHouseholdTransaction, listHouseholdTransactions, listTransactionAdjustmentEvents, refundHouseholdDirectExpense, transactionAvailableActions, updateHouseholdTransaction, type HouseholdTransaction, type InstrumentKind, type TransactionAdjustmentEvent, type TransactionKind } from '../../finance/householdTransactions.js';
import { listFinancialParties, type FinancialParty } from '../../finance/financialParties.js';
import { allocateCustomAmounts, allocateEqually, type AllocationTarget } from '../../finance/economicAllocations.js';
import { ExpenseFinancialStory } from '../app/ExpenseFinancialStory.js';

const typeLabels: Record<TransactionKind, string> = { expense: 'Despesa', income: 'Receita' };
const stateLabels: Record<string, string> = { forecast: 'Previsto', confirmed: 'Confirmado', realized: 'Realizado', cancelled: 'Cancelado', reversed: 'Estornado' };
const historyLabels: Record<TransactionAdjustmentEvent['kind'], string> = { correction: 'Correção', cancellation: 'Cancelamento', refund: 'Estorno' };

const formatMoney = (value: unknown) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatWhen = (value: string) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function HouseholdTransactionsSetup({ onBack, embedded = false, mode }: { onBack?: () => void; embedded?: boolean; mode?: TransactionKind }) {
  const { user, household, householdMembers } = useSupabaseAuth();
  const [transactions, setTransactions] = useState<HouseholdTransaction[]>([]);
  const [categories, setCategories] = useState<HouseholdCategory[]>([]);
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([]);
  const [cards, setCards] = useState<HouseholdCard[]>([]);
  const [parties, setParties] = useState<FinancialParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editing, setEditing] = useState<HouseholdTransaction | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [historyTransaction, setHistoryTransaction] = useState<HouseholdTransaction | null>(null);
  const [historyEvents, setHistoryEvents] = useState<TransactionAdjustmentEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [kind, setKind] = useState<TransactionKind>(mode ?? 'expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState('');
  const [buyerMemberId, setBuyerMemberId] = useState('');
  const [instrumentKind, setInstrumentKind] = useState<InstrumentKind>('account');
  const [accountId, setAccountId] = useState('');
  const [cardId, setCardId] = useState('');
  const [notes, setNotes] = useState('');
  const [responsibility, setResponsibility] = useState('buyer');
  const [installmentCount, setInstallmentCount] = useState(1);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [hasThirdParty, setHasThirdParty] = useState(false);
  const [partyId, setPartyId] = useState('');
  const [funderMemberId, setFunderMemberId] = useState('');
  const [receivableDueDate, setReceivableDueDate] = useState('');

  const refresh = async () => {
    if (!supabase || !household) return;
    setLoading(true);
    try {
      const [transactionRows, categoryRows, financialRows, partyRows] = await Promise.all([
        listHouseholdTransactions(supabase, household.id), listHouseholdCategories(supabase, household.id),
        listHouseholdFinancialAccounts(supabase, household.id), listFinancialParties(supabase, household.id),
      ]);
      setTransactions(transactionRows); setCategories(categoryRows); setAccounts(financialRows.accounts); setCards(financialRows.cards); setParties(partyRows);
    } catch { setError(`Não foi possível carregar ${mode === 'expense' ? 'os gastos' : mode === 'income' ? 'as entradas' : 'os lançamentos'} da Casa.`); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [household?.id]);
  useEffect(() => { if (mode) setKind(mode); }, [mode]);

  const resetForm = (transaction?: HouseholdTransaction) => {
    const transactionKind = transaction?.type ?? mode ?? 'expense';
    setEditing(transaction ?? null); setKind(transactionKind); setDescription(transaction?.description ?? ''); setAmount(transaction?.amount ?? ''); setDate(transaction?.transaction_date ?? new Date().toISOString().slice(0, 10)); setCategoryId(transaction?.category_id ?? ''); setBuyerMemberId(transaction?.buyer_member_id ?? householdMembers.find((member) => member.profile_id === user?.id)?.id ?? ''); setNotes(transaction?.notes ?? '');
    const instrument = transaction?.payment_instrument;
    setInstrumentKind(instrument?.kind ?? 'account'); setAccountId(instrument?.account_id ?? ''); setCardId(instrument?.card_id ?? ''); setResponsibility('buyer'); setInstallmentCount(1); setCustomAmounts({}); setHasThirdParty(false); setPartyId(''); setFunderMemberId(householdMembers.find((member) => member.profile_id === user?.id)?.id ?? ''); setReceivableDueDate(''); setFormOpen(true); setError(null);
  };
  const availableCategories = categories.filter((category) => category.type === kind);
  const visibleTransactions = mode ? transactions.filter((transaction) => transaction.type === mode) : transactions;
  const sectionTitle = mode === 'expense' ? 'Gastos' : mode === 'income' ? 'Entradas' : 'Lançamentos';
  const addLabel = mode === 'expense' ? 'Novo gasto' : mode === 'income' ? 'Nova entrada' : 'Adicionar';
  const emptyLabel = mode === 'expense' ? 'Nenhum gasto cadastrado.' : mode === 'income' ? 'Nenhuma entrada cadastrada.' : 'Nenhum lançamento cadastrado.';
  const sectionDescription = mode === 'expense'
    ? 'Compras e compromissos da Casa, preservando comprador, responsabilidade e forma de financiamento como papéis independentes.'
    : mode === 'income'
      ? 'Renda verdadeira e entradas previstas ou realizadas, sem misturar transferências, acertos ou empréstimos com renda.'
      : 'O Casa preserva a história do dinheiro: previsto, realizado, corrigido, cancelado ou estornado.';
  const allocationTargets = (): AllocationTarget[] => {
    const memberTargets = responsibility === 'equal' || responsibility === 'custom' ? householdMembers.map((member) => ({ memberId: member.id })) : [{ memberId: responsibility === 'buyer' ? buyerMemberId : responsibility }];
    return hasThirdParty && partyId ? [...memberTargets, { partyId }] : memberTargets;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase || !household || !user) return;
    const creator = householdMembers.find((member) => member.profile_id === user.id); if (!creator) { setError('Seu membro da Casa não foi encontrado.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      const targets = allocationTargets();
      const splits = responsibility === 'custom' || hasThirdParty ? allocateCustomAmounts(amount, targets.map((target) => ({ ...target, value: customAmounts[target.memberId ?? target.partyId ?? ''] ?? '' }))) : allocateEqually(amount, targets);
      const input = { description, amount, transactionDate: date, categoryId, buyerMemberId: kind === 'expense' ? buyerMemberId : null, notes, instrumentKind: kind === 'expense' ? instrumentKind : undefined, accountId: kind === 'expense' && instrumentKind === 'account' ? accountId : undefined, cardId: kind === 'expense' && instrumentKind === 'card' ? cardId : undefined, splits, installmentCount: instrumentKind === 'card' ? installmentCount : 1 };
      if (editing) await updateHouseholdTransaction(supabase, household.id, editing.id, input);
      else if (kind === 'expense' && hasThirdParty) { if (instrumentKind !== 'account') throw new Error('Participação de terceiro está disponível para pagamentos por conta.'); await createAndSettleSharedExpense(supabase, household.id, input, funderMemberId, receivableDueDate || null); }
      else await createHouseholdTransaction(supabase, household.id, kind, input);
      setFormOpen(false); setSuccess(editing ? 'Correção registrada no histórico.' : kind === 'expense' ? 'Gasto criado.' : 'Entrada criada.'); await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.'); } finally { setSaving(false); }
  };
  const cancel = async (transaction: HouseholdTransaction) => {
    if (!supabase || !household || !confirm(`Cancelar “${transaction.description}”? O lançamento será preservado no histórico.`)) return;
    try { await cancelHouseholdTransaction(supabase, household.id, transaction.id); setSuccess('Cancelamento registrado no histórico.'); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Este lançamento exige um fluxo específico para ser cancelado.'); }
  };
  const refund = async (transaction: HouseholdTransaction) => {
    if (!supabase || !household || !confirm(`Registrar estorno integral de “${transaction.description}”?`)) return;
    try { await refundHouseholdDirectExpense(supabase, household.id, transaction); setSuccess('Estorno registrado e vinculado à despesa original.'); await refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Este lançamento exige um fluxo específico de estorno.'); }
  };
  const openHistory = async (transaction: HouseholdTransaction) => {
    if (!supabase || !household) return;
    setHistoryTransaction(transaction); setHistoryEvents([]); setHistoryLoading(true); setError(null);
    try { setHistoryEvents(await listTransactionAdjustmentEvents(supabase, household.id, transaction.id)); }
    catch { setError('Não foi possível carregar o histórico deste lançamento.'); setHistoryTransaction(null); }
    finally { setHistoryLoading(false); }
  };
  const nameOfMember = (id: string | null) => householdMembers.find((member) => member.id === id)?.display_name ?? 'Não informado';
  const instrumentLabel = (transaction: HouseholdTransaction) => { const instrument = transaction.payment_instrument; if (!instrument) return 'Sem instrumento'; if (instrument.kind === 'account') return `Conta: ${accounts.find((account) => account.id === instrument.account_id)?.name ?? 'Conta'}`; return `Cartão: ${cards.find((card) => card.id === instrument.card_id)?.name ?? 'Cartão'}`; };
  const adjustmentDetails = (event: TransactionAdjustmentEvent) => {
    if (event.kind === 'cancellation') return ['O lançamento foi cancelado sem apagar o registro original.'];
    if (event.kind === 'refund') return [`Estorno integral de ${formatMoney(event.amount)} vinculado à despesa original.`];
    const before = event.before_payload ?? {}; const after = event.after_payload ?? {};
    const fields: Array<[string, string]> = [['description', 'Descrição'], ['amount', 'Valor'], ['transaction_date', 'Data'], ['due_date', 'Vencimento']];
    return fields.flatMap(([key, label]) => {
      if (before[key] === after[key]) return [];
      const display = (value: unknown) => key === 'amount' ? formatMoney(value) : value == null || value === '' ? 'Não informado' : String(value);
      return [`${label}: ${display(before[key])} → ${display(after[key])}`];
    });
  };

  return <main className={embedded ? 'text-slate-100' : 'min-h-[100dvh] bg-slate-950 px-4 py-6 text-slate-100 sm:flex sm:justify-center'}><div className="w-full max-w-3xl space-y-5">
    {onBack && <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-300"><ArrowLeft className="h-4 w-4" />Casa e membros</button>}
    <header className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{household?.name}</p><h1 className="mt-1 text-2xl font-black">{sectionTitle}</h1><p className="mt-1 text-sm text-slate-400">{sectionDescription}</p></div><button type="button" onClick={() => resetForm()} className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold"><Plus className="h-4 w-4" />{addLabel}</button></header>
    {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}{success && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{success}</p>}
    {loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-blue-400" /> : visibleTransactions.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">{emptyLabel}</p> : <div className="space-y-3">{visibleTransactions.map((transaction) => { const actions = transactionAvailableActions(transaction); return <article key={transaction.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start gap-3"><Receipt className="mt-0.5 h-5 w-5 text-blue-400" /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><h2 className="font-bold">{transaction.description}</h2><strong className={transaction.type === 'income' ? 'text-emerald-300' : 'text-rose-300'}>{transaction.type === 'income' ? '+' : '-'} R$ {transaction.amount}</strong></div><p className="mt-1 text-sm text-slate-400">{typeLabels[transaction.type]} · {transaction.transaction_date} · {transaction.category?.name ?? 'Sem categoria'}</p><p className="mt-1 text-xs font-semibold text-blue-300">{stateLabels[transaction.economic_state] ?? transaction.economic_state}</p>{transaction.type === 'expense' && <><p className="mt-1 text-xs text-slate-500">Comprador: {nameOfMember(transaction.buyer_member_id)} · {instrumentLabel(transaction)}</p>{household && <ExpenseFinancialStory householdId={household.id} transactionId={transaction.id} memberName={nameOfMember} partyName={(id) => parties.find((party) => party.id === id)?.name ?? 'Terceiro'} accountName={(id) => accounts.find((account) => account.id === id)?.name ?? 'Conta'} />}</>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => openHistory(transaction)} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-xs font-semibold text-slate-200"><History className="h-4 w-4" />Histórico</button>{actions.canEdit && <button type="button" onClick={() => resetForm(transaction)} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-xs font-semibold"><Edit3 className="h-4 w-4" />Editar</button>}{actions.canCancel && <button type="button" onClick={() => cancel(transaction)} className="flex min-h-10 items-center gap-2 rounded-xl border border-rose-900 px-3 text-xs font-semibold text-rose-300"><Power className="h-4 w-4" />Cancelar</button>}{actions.canRefund && <button type="button" onClick={() => refund(transaction)} className="flex min-h-10 items-center gap-2 rounded-xl border border-amber-800 px-3 text-xs font-semibold text-amber-300"><RotateCcw className="h-4 w-4" />Registrar estorno</button>}{!actions.canEdit && !actions.canCancel && !actions.canRefund && !actions.closed && <span className="self-center text-xs text-slate-500">Este lançamento já possui fatos financeiros vinculados.</span>}{actions.closed && <span className="self-center text-xs text-slate-500">Histórico preservado · nenhuma alteração direta disponível.</span>}</div></div></div></article>; })}</div>}

    {historyTransaction && <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-4 sm:items-center"><section role="dialog" aria-modal="true" aria-label="Histórico do lançamento" className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Histórico auditável</p><h2 className="mt-1 text-lg font-bold">{historyTransaction.description}</h2><p className="mt-1 text-xs text-slate-500">Correções e reversões ficam registradas; o histórico financeiro não é apagado.</p></div><button type="button" aria-label="Fechar histórico" onClick={() => setHistoryTransaction(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button></div>{historyLoading ? <LoaderCircle className="mx-auto my-8 h-6 w-6 animate-spin text-blue-400" /> : historyEvents.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">Este lançamento ainda não possui correções, cancelamentos ou estornos.</p> : <div className="mt-5 space-y-3">{historyEvents.map((event) => <article key={event.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-100">{historyLabels[event.kind]}</h3><p className="mt-1 text-xs text-slate-500">{formatWhen(event.occurred_at)} · por {nameOfMember(event.created_by_member_id)}</p></div>{event.amount && <strong className="text-sm text-amber-300">{formatMoney(event.amount)}</strong>}</div><p className="mt-3 text-sm text-slate-300">{event.reason}</p>{adjustmentDetails(event).length > 0 && <ul className="mt-3 space-y-1 rounded-lg bg-slate-900 p-3 text-xs text-slate-400">{adjustmentDetails(event).map((detail) => <li key={detail}>{detail}</li>)}</ul>}</article>)}</div>}</section></div>}

    {formOpen && <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/70 p-4 sm:items-center"><form onSubmit={save} className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5"><h2 className="text-lg font-bold">{editing ? 'Corrigir lançamento' : mode === 'expense' ? 'Novo gasto' : mode === 'income' ? 'Nova entrada' : 'Adicionar lançamento'}</h2>{editing && <p className="rounded-xl bg-slate-800 p-3 text-xs text-slate-400">A correção será registrada no histórico. Comprador, responsabilidade e forma de pagamento permanecem como estavam.</p>}{!mode && <label className="block text-sm text-slate-300">Tipo<select disabled={Boolean(editing)} value={kind} onChange={(event) => { setKind(event.target.value as TransactionKind); setCategoryId(''); }} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="expense">Despesa</option><option value="income">Receita</option></select></label>}<label className="block text-sm text-slate-300">Descrição<input required value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label><label className="block text-sm text-slate-300">Valor<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label><label className="block text-sm text-slate-300">Data<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label><label className="block text-sm text-slate-300">Categoria<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>{kind === 'expense' && <><label className="block text-sm text-slate-300">Comprador<span className="block text-xs text-slate-500">Quem realizou esta compra?</span><select required disabled={Boolean(editing)} value={buyerMemberId} onChange={(event) => setBuyerMemberId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3">{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label><label className="block text-sm text-slate-300">Responsabilidade econômica<select disabled={Boolean(editing)} value={responsibility} onChange={(event) => { setResponsibility(event.target.value); setCustomAmounts({}); }} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="buyer">100% comprador</option>{householdMembers.filter((member) => member.id !== buyerMemberId).map((member) => <option key={member.id} value={member.id}>100% {member.display_name}</option>)}{householdMembers.length > 1 && <option value="equal">Dividir igualmente</option>}<option value="custom">Personalizar divisão</option></select></label>{!editing && <label className="flex items-center gap-3 rounded-xl border border-slate-700 p-3 text-sm"><input type="checkbox" checked={hasThirdParty} onChange={(event) => { setHasThirdParty(event.target.checked); setCustomAmounts({}); if (event.target.checked) { setInstrumentKind('account'); setInstallmentCount(1); } }} />Há participação de terceiro</label>}{hasThirdParty && <label className="block text-sm text-slate-300">Terceiro<select required value={partyId} onChange={(event) => { setPartyId(event.target.value); setCustomAmounts({}); }} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>}{(responsibility === 'custom' || hasThirdParty) && <fieldset className="space-y-2 rounded-xl border border-slate-700 p-3"><legend className="px-1 text-sm font-semibold">Valor de cada participante</legend>{allocationTargets().map((target) => { const id = target.memberId ?? target.partyId ?? ''; const label = target.memberId ? nameOfMember(target.memberId) : parties.find((party) => party.id === target.partyId)?.name ?? 'Terceiro'; return <label key={id} className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><span className="flex items-center gap-1 text-slate-400">R$<input required type="number" min="0" step="0.01" value={customAmounts[id] ?? ''} onChange={(event) => setCustomAmounts((values) => ({ ...values, [id]: event.target.value }))} className="w-28 rounded-lg bg-slate-800 p-2 text-right text-white" /></span></label>; })}</fieldset>}<label className="block text-sm text-slate-300">Como foi pago?<select value={instrumentKind} disabled={Boolean(editing) || hasThirdParty} onChange={(event) => { const next = event.target.value as InstrumentKind; setInstrumentKind(next); if (next === 'account') setInstallmentCount(1); }} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="account">Conta</option><option value="card">Cartão</option></select></label><label className="block text-sm text-slate-300">{instrumentKind === 'account' ? <><Landmark className="mr-1 inline h-4 w-4" />Conta<select required disabled={Boolean(editing)} value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></> : <><CreditCard className="mr-1 inline h-4 w-4" />Cartão<select required disabled={Boolean(editing)} value={cardId} onChange={(event) => setCardId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></>}</label>{instrumentKind === 'card' && <label className="block text-sm text-slate-300">Parcelas<input disabled={Boolean(editing)} type="number" min="1" max="120" value={installmentCount} onChange={(event) => setInstallmentCount(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label>}{hasThirdParty && <><label className="block text-sm text-slate-300">Quem pagou?<select required value={funderMemberId} onChange={(event) => setFunderMemberId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3">{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label><label className="block text-sm text-slate-300">Receber até (opcional)<input type="date" min={date} value={receivableDueDate} onChange={(event) => setReceivableDueDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label></>}</>}<label className="block text-sm text-slate-300">Observação (opcional)<textarea disabled={Boolean(editing)} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl bg-slate-800 p-3" /></label><div className="flex gap-3"><button type="button" onClick={() => setFormOpen(false)} className="min-h-11 flex-1 rounded-xl border border-slate-700 font-semibold">Voltar</button><button type="submit" disabled={saving} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{editing ? 'Registrar correção' : 'Salvar'}</button></div></form></div>}
  </div></main>;
}
