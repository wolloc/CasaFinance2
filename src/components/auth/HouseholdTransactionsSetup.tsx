import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, CreditCard, Edit3, Landmark, LoaderCircle, Plus, Power, Receipt } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount, type HouseholdCard } from '../../finance/householdFinancialAccounts.js';
import { CATEGORY_TYPES, listHouseholdCategories, type HouseholdCategory } from '../../finance/householdCategories.js';
import { cancelHouseholdTransaction, createAndSettleSharedExpense, createHouseholdTransaction, listHouseholdTransactions, updateHouseholdTransaction, type HouseholdTransaction, type InstrumentKind, type TransactionKind } from '../../finance/householdTransactions.js';
import { listFinancialParties, type FinancialParty } from '../../finance/financialParties.js';
import { allocateCustomAmounts, allocateEqually, type AllocationTarget } from '../../finance/economicAllocations.js';

const typeLabels: Record<TransactionKind, string> = { expense: 'Despesa', income: 'Receita' };

export function HouseholdTransactionsSetup({ onBack, embedded = false }: { onBack?: () => void; embedded?: boolean }) {
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
  const [kind, setKind] = useState<TransactionKind>('expense');
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
        listHouseholdTransactions(supabase, household.id),
        listHouseholdCategories(supabase, household.id),
        listHouseholdFinancialAccounts(supabase, household.id),
        listFinancialParties(supabase, household.id),
      ]);
      setTransactions(transactionRows); setCategories(categoryRows); setAccounts(financialRows.accounts); setCards(financialRows.cards); setParties(partyRows);
    } catch { setError('Não foi possível carregar os lançamentos da Casa.'); } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, [household?.id]);


  const resetForm = (transaction?: HouseholdTransaction) => {
    const transactionKind = transaction?.type ?? 'expense';
    setEditing(transaction ?? null); setKind(transactionKind); setDescription(transaction?.description ?? ''); setAmount(transaction?.amount ?? ''); setDate(transaction?.transaction_date ?? new Date().toISOString().slice(0, 10)); setCategoryId(transaction?.category_id ?? ''); setBuyerMemberId(transaction?.buyer_member_id ?? householdMembers.find((member) => member.profile_id === user?.id)?.id ?? ''); setNotes(transaction?.notes ?? '');
    const instrument = transaction?.payment_instrument;
    setInstrumentKind(instrument?.kind ?? 'account'); setAccountId(instrument?.account_id ?? ''); setCardId(instrument?.card_id ?? ''); setResponsibility('buyer'); setInstallmentCount(1); setCustomAmounts({}); setHasThirdParty(false); setPartyId(''); setFunderMemberId(householdMembers.find((member) => member.profile_id === user?.id)?.id ?? ''); setReceivableDueDate(''); setFormOpen(true); setError(null);
  };
  const availableCategories = categories.filter((category) => category.type === kind);

  const allocationTargets = (): AllocationTarget[] => {
    const memberTargets = responsibility === 'equal' || responsibility === 'custom'
      ? householdMembers.map((member) => ({ memberId: member.id }))
      : [{ memberId: responsibility === 'buyer' ? buyerMemberId : responsibility }];
    return hasThirdParty && partyId ? [...memberTargets, { partyId }] : memberTargets;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household || !user) return;
    const creator = householdMembers.find((member) => member.profile_id === user.id);
    if (!creator) { setError('Seu membro da Casa não foi encontrado.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      const targets = allocationTargets();
      const splits = responsibility === 'custom' || hasThirdParty
        ? allocateCustomAmounts(amount, targets.map((target) => ({ ...target, value: customAmounts[target.memberId ?? target.partyId ?? ''] ?? '' })))
        : allocateEqually(amount, targets);
      const input = {
        description, amount, transactionDate: date, categoryId,
        buyerMemberId: kind === 'expense' ? buyerMemberId : null, notes,
        instrumentKind: kind === 'expense' ? instrumentKind : undefined,
        accountId: kind === 'expense' && instrumentKind === 'account' ? accountId : undefined,
        cardId: kind === 'expense' && instrumentKind === 'card' ? cardId : undefined,
        splits,
        installmentCount: instrumentKind === 'card' ? installmentCount : 1,
      };
      if (editing) {
        await updateHouseholdTransaction(supabase, household.id, editing.id, input);
      } else if (kind === 'expense' && hasThirdParty) {
        if (instrumentKind !== 'account') throw new Error('Participação de terceiro está disponível para pagamentos por conta.');
        await createAndSettleSharedExpense(supabase, household.id, input, funderMemberId, receivableDueDate || null);
      } else {
        await createHouseholdTransaction(supabase, household.id, kind, input);
      }
      setFormOpen(false); setSuccess(editing ? 'Lançamento atualizado.' : 'Lançamento criado.'); await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o lançamento.');
    } finally { setSaving(false); }
  };
  const cancel = async (transaction: HouseholdTransaction) => {
    if (!supabase || !household || !confirm(`Cancelar “${transaction.description}”? O histórico será preservado.`)) return;
    try { await cancelHouseholdTransaction(supabase, household.id, transaction.id); setSuccess('Lançamento cancelado e preservado.'); await refresh(); } catch { setError('Não foi possível cancelar o lançamento.'); }
  };
  const nameOfMember = (id: string | null) => householdMembers.find((member) => member.id === id)?.display_name ?? 'Não informado';
  const instrumentLabel = (transaction: HouseholdTransaction) => { const instrument = transaction.payment_instrument; if (!instrument) return 'Sem instrumento'; if (instrument.kind === 'account') return `Conta: ${accounts.find((account) => account.id === instrument.account_id)?.name ?? 'Conta'}`; return `Cartão: ${cards.find((card) => card.id === instrument.card_id)?.name ?? 'Cartão'}`; };

  return <main className={embedded ? "text-slate-100" : "min-h-[100dvh] bg-slate-950 px-4 py-6 text-slate-100 sm:flex sm:justify-center"}><div className="w-full max-w-3xl space-y-5">{onBack && <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-300"><ArrowLeft className="h-4 w-4" />Casa e membros</button>}<header className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">{household?.name}</p><h1 className="mt-1 text-2xl font-black">Lançamentos</h1><p className="mt-1 text-sm text-slate-400">Despesas e receitas da Casa.</p></div><button type="button" onClick={() => resetForm()} className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold"><Plus className="h-4 w-4" />Adicionar lançamento</button></header>{error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}{success && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{success}</p>}
    {loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-blue-400" /> : transactions.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-700 p-7 text-center text-sm text-slate-400">Nenhuma transação ativa cadastrada.</p> : <div className="space-y-3">{transactions.map((transaction) => <article key={transaction.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start gap-3"><Receipt className="mt-0.5 h-5 w-5 text-blue-400" /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><h2 className="font-bold">{transaction.description}</h2><strong className={transaction.type === 'income' ? 'text-emerald-300' : 'text-rose-300'}>{transaction.type === 'income' ? '+' : '-'} R$ {transaction.amount}</strong></div><p className="mt-1 text-sm text-slate-400">{typeLabels[transaction.type]} · {transaction.transaction_date} · {transaction.category?.name ?? 'Sem categoria'}</p>{transaction.type === 'expense' && <p className="text-xs text-slate-500">Comprador: {nameOfMember(transaction.buyer_member_id)} · {instrumentLabel(transaction)}</p>}<div className="mt-3 flex gap-2"><button type="button" onClick={() => resetForm(transaction)} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 px-3 text-xs font-semibold"><Edit3 className="h-4 w-4" />Editar</button><button type="button" onClick={() => cancel(transaction)} className="flex min-h-10 items-center gap-2 rounded-xl border border-rose-900 px-3 text-xs font-semibold text-rose-300"><Power className="h-4 w-4" />Cancelar</button></div></div></div></article>)}</div>}
    {formOpen && <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <form onSubmit={save} className="max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <h2 className="text-lg font-bold">{editing ? 'Editar lançamento' : 'Adicionar lançamento'}</h2>
        <label className="block text-sm text-slate-300">Tipo<select disabled={Boolean(editing)} value={kind} onChange={(event) => { setKind(event.target.value as TransactionKind); setCategoryId(''); }} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="expense">Despesa</option><option value="income">Receita</option></select></label>
        <label className="block text-sm text-slate-300">Descrição<input required value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label>
        <label className="block text-sm text-slate-300">Valor<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label>
        <label className="block text-sm text-slate-300">Data<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label>
        <label className="block text-sm text-slate-300">Categoria<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        {kind === 'expense' && <>
          <label className="block text-sm text-slate-300">Comprador<span className="block text-xs text-slate-500">Quem realizou esta compra?</span><select required value={buyerMemberId} onChange={(event) => setBuyerMemberId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3">{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
          <label className="block text-sm text-slate-300">Responsabilidade econômica<span className="block text-xs text-slate-500">Quem deve assumir este gasto?</span><select disabled={Boolean(editing)} value={responsibility} onChange={(event) => { setResponsibility(event.target.value); setCustomAmounts({}); }} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="buyer">100% comprador</option>{householdMembers.filter((member) => member.id !== buyerMemberId).map((member) => <option key={member.id} value={member.id}>100% {member.display_name}</option>)}{householdMembers.length > 1 && <option value="equal">Dividir igualmente</option>}<option value="custom">Personalizar divisão</option></select></label>
          {!editing && <label className="flex items-center gap-3 rounded-xl border border-slate-700 p-3 text-sm"><input type="checkbox" checked={hasThirdParty} onChange={(event) => { setHasThirdParty(event.target.checked); setCustomAmounts({}); if (event.target.checked) { setInstrumentKind('account'); setInstallmentCount(1); } }} />Há participação de terceiro</label>}
          {hasThirdParty && <label className="block text-sm text-slate-300">Terceiro<select required value={partyId} onChange={(event) => { setPartyId(event.target.value); setCustomAmounts({}); }} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>}
          {(responsibility === 'custom' || hasThirdParty) && <fieldset className="space-y-2 rounded-xl border border-slate-700 p-3"><legend className="px-1 text-sm font-semibold">Valor de cada participante</legend>{allocationTargets().map((target) => { const id = target.memberId ?? target.partyId ?? ''; const label = target.memberId ? nameOfMember(target.memberId) : parties.find((party) => party.id === target.partyId)?.name ?? 'Terceiro'; return <label key={id} className="flex items-center justify-between gap-3 text-sm"><span>{label}</span><span className="flex items-center gap-1 text-slate-400">R$<input required type="number" min="0" step="0.01" value={customAmounts[id] ?? ''} onChange={(event) => setCustomAmounts((values) => ({ ...values, [id]: event.target.value }))} className="w-28 rounded-lg bg-slate-800 p-2 text-right text-white" /></span></label>; })}<p className="text-xs text-slate-500">A soma deve ser exatamente igual ao valor do lançamento.</p></fieldset>}
          <label className="block text-sm text-slate-300">Como foi pago?<select value={instrumentKind} disabled={hasThirdParty} onChange={(event) => { const next = event.target.value as InstrumentKind; setInstrumentKind(next); if (next === 'account') setInstallmentCount(1); }} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="account">Conta</option><option value="card">Cartão</option></select></label>
          <label className="block text-sm text-slate-300">{instrumentKind === 'account' ? <><Landmark className="mr-1 inline h-4 w-4" />Conta<select required value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></> : <><CreditCard className="mr-1 inline h-4 w-4" />Cartão<select required value={cardId} onChange={(event) => setCardId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></>}</label>
          {instrumentKind === 'card' && <label className="block text-sm text-slate-300">Parcelas<input type="number" min="1" max="120" value={installmentCount} onChange={(event) => setInstallmentCount(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label>}
          {hasThirdParty && <><label className="block text-sm text-slate-300">Quem pagou?<select required value={funderMemberId} onChange={(event) => setFunderMemberId(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="">Selecione</option>{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label><label className="block text-sm text-slate-300">Receber até (opcional)<input type="date" min={date} value={receivableDueDate} onChange={(event) => setReceivableDueDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label></>}
        </>}
        <label className="block text-sm text-slate-300">Observação (opcional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl bg-slate-800 p-3" /></label>
        <div className="flex gap-3"><button type="button" onClick={() => setFormOpen(false)} className="min-h-11 flex-1 rounded-xl border border-slate-700 font-semibold">Cancelar</button><button type="submit" disabled={saving} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}Salvar</button></div>
      </form>
    </div>}
  </div></main>;
}
