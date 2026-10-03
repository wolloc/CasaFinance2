import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { listHouseholdCategories, type HouseholdCategory } from '../../finance/householdCategories.js';
import { allocateCustomAmounts, allocateEqually, type EconomicAllocation } from '../../finance/economicAllocations.js';
import { recordOpeningCardBalance, recordOpeningCardPurchasesBatch, type HouseholdCard, type OpeningCardPurchaseInput } from '../../finance/householdFinancialAccounts.js';
import { supabase } from '../../lib/supabase.js';

type Member = { id: string; display_name: string };
type ResponsibilityMode = 'single' | 'equal' | 'custom';

type Draft = {
  description: string;
  originalPurchaseDate: string;
  amount: string;
  buyerMemberId: string;
  categoryId: string;
  responsibilityMode: ResponsibilityMode;
  responsibleMemberId: string;
  customAmounts: Record<string, string>;
  installmentCount: string;
  paidInstallmentCount: string;
};

type QueuedPurchase = OpeningCardPurchaseInput & {
  id: string;
  responsibilityLabel: string;
};

const money = (value: string | number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function OpeningCardCommitmentsModal({
  householdId, card, members, trackingStartedOn, defaultMemberId, onClose, onSaved,
}: {
  householdId: string;
  card: HouseholdCard;
  members: Member[];
  trackingStartedOn: string | null;
  defaultMemberId: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'detailed' | 'aggregate'>('detailed');
  const [categories, setCategories] = useState<HouseholdCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [queued, setQueued] = useState<QueuedPurchase[]>([]);
  const [aggregate, setAggregate] = useState({ description: 'Compromissos anteriores ao início do controle', amount: '' });
  const [draft, setDraft] = useState<Draft>({
    description: '',
    originalPurchaseDate: '',
    amount: '',
    buyerMemberId: defaultMemberId,
    categoryId: '',
    responsibilityMode: 'single',
    responsibleMemberId: defaultMemberId,
    customAmounts: {},
    installmentCount: '1',
    paidInstallmentCount: '0',
  });

  const latestHistoricalDate = useMemo(() => {
    if (!trackingStartedOn) return undefined;
    const date = new Date(`${trackingStartedOn}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }, [trackingStartedOn]);

  const expenseCategories = useMemo(() => categories.filter((category) => category.type === 'expense'), [categories]);
  const categoryName = (id: string) => expenseCategories.find((category) => category.id === id)?.name ?? 'Sem categoria';

  useEffect(() => {
    let active = true;
    const loadCategories = async () => {
      if (!supabase) return;
      setLoadingCategories(true);
      setCategoryError(null);
      try {
        const rows = await listHouseholdCategories(supabase, householdId);
        if (active) setCategories(rows);
      } catch {
        if (active) setCategoryError('Não foi possível carregar as categorias. Nenhum lançamento será salvo sem uma categoria válida.');
      } finally {
        if (active) setLoadingCategories(false);
      }
    };
    void loadCategories();
    return () => { active = false; };
  }, [householdId]);

  const resetDraftForNext = () => setDraft((current) => ({
    ...current,
    description: '',
    amount: '',
    categoryId: '',
    responsibilityMode: 'single',
    responsibleMemberId: current.buyerMemberId,
    customAmounts: {},
    installmentCount: '1',
    paidInstallmentCount: '0',
  }));

  const buildAllocations = (): EconomicAllocation[] => {
    if (!draft.amount || Number(draft.amount) <= 0) throw new Error('Informe um valor maior que zero.');
    if (draft.responsibilityMode === 'custom') {
      return allocateCustomAmounts(draft.amount, members.map((member) => ({
        memberId: member.id,
        value: draft.customAmounts[member.id] ?? '0',
      })));
    }
    const memberId = draft.responsibilityMode === 'equal' ? null : draft.responsibleMemberId;
    return allocateEqually(draft.amount, memberId ? [{ memberId }] : members.map((member) => ({ memberId: member.id })));
  };

  const addDraft = () => {
    setError(null);
    if (!trackingStartedOn) return setError('Primeiro informe a data de início do controle financeiro da Casa.');
    if (!draft.description.trim()) return setError('Informe a descrição da compra.');
    if (!draft.originalPurchaseDate || draft.originalPurchaseDate >= trackingStartedOn) return setError('A data da compra precisa ser anterior ao início do controle financeiro.');
    if (!draft.amount || !Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0) return setError('Informe um valor maior que zero.');
    if (!draft.categoryId) return setError('Selecione uma categoria para este lançamento.');
    const installmentCount = Number(draft.installmentCount);
    const paidInstallmentCount = Number(draft.paidInstallmentCount);
    if (!Number.isInteger(installmentCount) || installmentCount < 1) return setError('Informe quantas parcelas existem no total.');
    if (!Number.isInteger(paidInstallmentCount) || paidInstallmentCount < 0 || paidInstallmentCount > installmentCount) return setError('Informe quantas parcelas já foram pagas, sem ultrapassar o total de parcelas.');
    let allocations: EconomicAllocation[];
    try { allocations = buildAllocations(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revise a divisão da responsabilidade.');
      return;
    }
    const responsibilityLabel = allocations.map((allocation) => {
      const member = members.find((item) => item.id === allocation.memberId);
      return member ? `${member.display_name} ${Number(allocation.percentage).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '';
    }).filter(Boolean).join(' · ');
    const item: QueuedPurchase = {
      id: crypto.randomUUID(),
      cardId: card.id,
      description: draft.description.trim(),
      originalPurchaseDate: draft.originalPurchaseDate,
      amount: Number(draft.amount).toFixed(2),
      categoryId: draft.categoryId,
      buyerMemberId: draft.buyerMemberId,
      splits: allocations.map((allocation) => ({
        member_id: allocation.memberId!,
        amount: allocation.amount,
        percentage: allocation.percentage,
      })),
      installmentCount,
      paidInstallmentCount,
      responsibilityLabel,
    };
    setQueued((current) => [...current, item]);
    resetDraftForNext();
    setError(null);
  };

  const removeQueued = (id: string) => setQueued((current) => current.filter((item) => item.id !== id));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (!trackingStartedOn) return setError('Primeiro informe a data de início do controle financeiro da Casa.');
    setSaving(true);
    setError(null);
    try {
      if (mode === 'aggregate') {
        await recordOpeningCardBalance(supabase, householdId, {
          cardId: card.id,
          amount: aggregate.amount,
          description: aggregate.description,
          requestKey: crypto.randomUUID(),
        });
        await onSaved('O valor em aberto foi registrado como posição inicial do cartão. Ele não virou uma nova despesa.');
        return;
      }
      if (queued.length === 0) return setError('Adicione pelo menos uma compra anterior antes de salvar.');
      await recordOpeningCardPurchasesBatch(supabase, householdId, { cardId: card.id, purchases: queued });
      await onSaved(`${queued.length} ${queued.length === 1 ? 'lançamento anterior foi registrado' : 'lançamentos anteriores foram registrados'} no cartão, com categoria e responsabilidade preservadas. Só as parcelas ainda abertas entram nas faturas.`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível registrar os lançamentos anteriores. Confira os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const currentDraftSplit = (() => {
    try { return buildAllocations(); } catch { return []; }
  })();

  return <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 p-4 sm:items-center">
    <form onSubmit={save} className="max-h-[94dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100">
      <div>
        <h2 className="text-lg font-bold">Compras que já existiam no {card.name}</h2>
        <p className="mt-1 text-sm text-slate-400">Monte aqui o histórico que já existia quando você começou a usar o Casa. Você pode adicionar vários lançamentos e salvar tudo de uma vez.</p>
      </div>

      <fieldset className="grid grid-cols-2 gap-2" disabled={queued.length > 0}>
        <label className={`rounded-xl border p-3 text-sm ${mode === 'detailed' ? 'border-blue-500 bg-blue-950/30' : 'border-slate-700'}`}>
          <input className="mr-2" type="radio" checked={mode === 'detailed'} onChange={() => setMode('detailed')} />Cadastrar compras
        </label>
        <label className={`rounded-xl border p-3 text-sm ${mode === 'aggregate' ? 'border-blue-500 bg-blue-950/30' : 'border-slate-700'}`}>
          <input className="mr-2" type="radio" checked={mode === 'aggregate'} onChange={() => setMode('aggregate')} />Só valor em aberto
        </label>
      </fieldset>

      {mode === 'aggregate' ? <>
        <Field label="Descrição" value={aggregate.description} onChange={(value) => setAggregate({ ...aggregate, description: value })} required />
        <Field label="Quanto está em aberto neste cartão?" value={aggregate.amount} onChange={(value) => setAggregate({ ...aggregate, amount: value })} type="number" min="0.01" step="0.01" required />
        <p className="rounded-xl bg-slate-950 p-3 text-xs text-slate-400">Use esta opção somente quando você não conseguir recuperar as compras. Ela não inventa comprador, categoria ou responsabilidade.</p>
      </> : <>
        <section className="space-y-3 rounded-2xl border border-slate-700 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-blue-200">Novo lançamento</h3>
            {queued.length > 0 && <span className="text-[11px] text-slate-500">{queued.length} na lista</span>}
          </div>
          <Field label="Descrição da compra" value={draft.description} onChange={(value) => setDraft({ ...draft, description: value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data original da compra" value={draft.originalPurchaseDate} onChange={(value) => setDraft({ ...draft, originalPurchaseDate: value })} type="date" max={latestHistoricalDate} required />
            <Field label="Valor original" value={draft.amount} onChange={(value) => setDraft({ ...draft, amount: value })} type="number" min="0.01" step="0.01" required />
          </div>
          <label className="block text-sm text-slate-300">Categoria<select required value={draft.categoryId} disabled={loadingCategories || expenseCategories.length === 0} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3"><option value="">{loadingCategories ? 'Carregando categorias…' : 'Selecione'}</option>{expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>

          <div className="grid grid-cols-2 gap-3">
            <MemberSelect label="Quem fez a compra?" value={draft.buyerMemberId} members={members} onChange={(value) => setDraft({ ...draft, buyerMemberId: value, responsibleMemberId: draft.responsibilityMode === 'single' ? value : draft.responsibleMemberId })} />
            <label className="block text-sm text-slate-300">Responsabilidade<select value={draft.responsibilityMode === 'single' ? draft.responsibleMemberId : draft.responsibilityMode} onChange={(event) => {
              const value = event.target.value;
              if (value === 'equal' || value === 'custom') setDraft({ ...draft, responsibilityMode: value, customAmounts: {} });
              else setDraft({ ...draft, responsibilityMode: 'single', responsibleMemberId: value, customAmounts: {} });
            }} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3">
              {members.map((member) => <option key={member.id} value={member.id}>100% {member.display_name}</option>)}
              {members.length > 1 && <option value="equal">Dividir igualmente</option>}
              {members.length > 1 && <option value="custom">Personalizar divisão</option>}
            </select></label>
          </div>

          {draft.responsibilityMode === 'custom' && <div className="space-y-2 rounded-xl border border-slate-700 p-3"><p className="text-xs text-slate-500">Informe quanto cabe a cada pessoa. A soma precisa fechar exatamente o valor.</p>{members.map((member) => <label key={member.id} className="flex items-center justify-between gap-3 text-sm text-slate-300"><span>{member.display_name}</span><span className="flex items-center gap-1 text-slate-400">R$<input type="number" min="0" step="0.01" value={draft.customAmounts[member.id] ?? ''} onChange={(event) => setDraft({ ...draft, customAmounts: { ...draft.customAmounts, [member.id]: event.target.value } })} className="w-28 rounded-lg bg-slate-800 p-2 text-right text-white" /></span></label>)}</div>}

          {currentDraftSplit.length > 0 && <div className="rounded-xl bg-slate-950 p-3 text-xs text-slate-400"><p className="font-semibold text-slate-300">Responsabilidade deste lançamento</p><div className="mt-1 space-y-0.5">{currentDraftSplit.map((allocation) => <p key={allocation.memberId}>{members.find((member) => member.id === allocation.memberId)?.display_name}: {money(allocation.amount)} · {Number(allocation.percentage).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</p>)}</div></div>}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Parcelas no total" value={draft.installmentCount} onChange={(value) => setDraft({ ...draft, installmentCount: value })} type="number" min="1" step="1" required />
            <Field label="Já pagas antes" value={draft.paidInstallmentCount} onChange={(value) => setDraft({ ...draft, paidInstallmentCount: value })} type="number" min="0" step="1" required />
          </div>
          <button type="button" onClick={addDraft} disabled={saving || loadingCategories || expenseCategories.length === 0} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue-700 bg-blue-950/20 text-sm font-semibold text-blue-200 disabled:opacity-50"><Plus className="h-4 w-4" />Adicionar lançamento</button>
        </section>

        {queued.length > 0 && <section className="space-y-2">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">Lançamentos prontos para salvar</h3><span className="text-xs text-slate-500">{queued.length} {queued.length === 1 ? 'item' : 'itens'}</span></div>
          {queued.map((item, index) => <article key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="font-semibold text-slate-200">{index + 1}. {item.description}</p><p className="mt-0.5 text-[11px] text-slate-500">{new Date(`${item.originalPurchaseDate}T12:00:00Z`).toLocaleDateString('pt-BR')} · {categoryName(item.categoryId)} · {item.installmentCount}x · {item.paidInstallmentCount} já paga(s)</p><p className="mt-1 text-xs text-slate-400">{money(item.amount)} · {item.responsibilityLabel}</p></div>
              <button type="button" onClick={() => removeQueued(item.id)} disabled={saving} aria-label={`Remover ${item.description}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-rose-300"><Trash2 className="h-4 w-4" /></button>
            </div>
          </article>)}
        </section>}
      </>}

      {categoryError && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{categoryError}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} disabled={saving} className="min-h-11 flex-1 rounded-xl border border-slate-700 font-semibold">Cancelar</button>
        <button type="submit" disabled={saving || !trackingStartedOn || (mode === 'detailed' ? queued.length === 0 : false)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold disabled:opacity-60">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{mode === 'aggregate' ? 'Salvar posição inicial' : `Salvar ${queued.length} ${queued.length === 1 ? 'lançamento' : 'lançamentos'}`}</button>
      </div>
    </form>
  </div>;
}

function Field({ label, value, onChange, ...props }: { label: string; value: string; onChange: (value: string) => void; [key: string]: unknown }) {
  return <label className="block text-sm text-slate-300">{label}<input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3" /></label>;
}

function MemberSelect({ label, value, members, onChange }: { label: string; value: string; members: Member[]; onChange: (value: string) => void }) {
  return <label className="block text-sm text-slate-300">{label}<select required value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl bg-slate-800 p-3">{members.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>;
}
