import { useEffect, useState, type FormEvent } from 'react';
import { CircleDollarSign, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdCategories, type HouseholdCategory } from '../../finance/householdCategories.js';
import { createIncomeFact, incomeNatureLabels, type IncomeConfidence, type IncomeNature } from '../../finance/incomeFacts.js';
import { isTransactionalResource, listInvestmentReserveResources, type InvestmentReserveResource } from '../../finance/investmentReserveAdjustments.js';

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const normalizeAmount = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');

export function IncomeCreationAction({ onCreated }: { onCreated?: () => void }) {
  const { household, householdMembers } = useSupabaseAuth();
  const [categories, setCategories] = useState<HouseholdCategory[]>([]);
  const [resources, setResources] = useState<InvestmentReserveResource[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expectedDate, setExpectedDate] = useState(localDate());
  const [categoryId, setCategoryId] = useState('');
  const [beneficiaryMemberId, setBeneficiaryMemberId] = useState('');
  const [plannedDestinationAccountId, setPlannedDestinationAccountId] = useState('');
  const [incomeNature, setIncomeNature] = useState<IncomeNature>('salary');
  const [economicState, setEconomicState] = useState<IncomeConfidence>('forecast');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setError(null);
    try {
      const [categoryRows, accountRows] = await Promise.all([
        listHouseholdCategories(supabase, household.id),
        listInvestmentReserveResources(supabase, household.id),
      ]);
      setCategories(categoryRows.filter((category) => category.type === 'income'));
      setResources(accountRows.filter(isTransactionalResource));
    } catch { setError('Não foi possível carregar categorias e recursos para a nova entrada.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [household?.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household) return;
    const normalized = normalizeAmount(amount);
    const numericAmount = Number(normalized);
    if (!description.trim()) { setError('Conte ao Casa de onde vem esta renda.'); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (!categoryId) { setError('Escolha uma categoria de entrada.'); return; }
    if (!beneficiaryMemberId) { setError('Informe de quem é esta renda.'); return; }
    if (!plannedDestinationAccountId) { setError('Informe onde espera receber este dinheiro.'); return; }

    setSaving(true); setError(null); setSuccess(null);
    try {
      await createIncomeFact(supabase, {
        householdId: household.id,
        description,
        amount: normalized,
        expectedDate,
        categoryId,
        beneficiaryMemberId,
        plannedDestinationAccountId,
        incomeNature,
        economicState,
        notes,
      });
      setSuccess(economicState === 'confirmed'
        ? 'Renda confirmada criada. Ela entra na projeção, mas ainda não no saldo atual.'
        : 'Previsão de renda criada. Ela só melhora a projeção principal quando for confirmada.');
      setDescription(''); setAmount(''); setNotes('');
      onCreated?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar a renda.'); }
    finally { setSaving(false); }
  };

  return <section className="rounded-2xl border border-emerald-900/70 bg-emerald-950/20 p-4">
    <div className="flex items-start gap-3"><CircleDollarSign className="mt-0.5 h-5 w-5 text-emerald-300"/><div><h2 className="font-bold">Nova renda</h2><p className="mt-1 text-sm text-slate-400">Registre somente renda verdadeira. Transferência, acerto, empréstimo tomado, recebível, refund e resgate de principal têm fluxos próprios e não entram aqui.</p></div></div>
    {loading ? <LoaderCircle className="mx-auto mt-4 h-5 w-5 animate-spin"/> : <form onSubmit={submit} className="mt-4 grid gap-3">
      <label className="text-sm font-semibold">Natureza da renda<select value={incomeNature} onChange={(e) => setIncomeNature(e.target.value as IncomeNature)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3">{Object.entries(incomeNatureLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-semibold">De onde vem?<input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3" placeholder="Ex.: Salário Itaú"/></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Valor<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3" placeholder="0,00"/></label><label className="text-sm font-semibold">Quando espera receber?<input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"/></label></div>
      <label className="text-sm font-semibold">De quem é esta renda?<select value={beneficiaryMemberId} onChange={(e) => setBeneficiaryMemberId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"><option value="">Selecione</option>{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
      <label className="text-sm font-semibold">Onde espera receber?<select value={plannedDestinationAccountId} onChange={(e) => setPlannedDestinationAccountId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"><option value="">Selecione</option>{resources.map((resource) => <option key={resource.account_id} value={resource.account_id}>{resource.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">É um destino previsto. O saldo só muda quando você confirmar o recebimento.</span></label>
      <label className="text-sm font-semibold">Quanto confia nesta entrada?<select value={economicState} onChange={(e) => setEconomicState(e.target.value as IncomeConfidence)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"><option value="forecast">Prevista — ainda pode mudar</option><option value="confirmed">Confirmada — posso contar com ela</option></select></label>
      <label className="text-sm font-semibold">Categoria<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"><option value="">Selecione</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Observação (opcional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-900 p-3"/></label>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
      <button disabled={saving || categories.length === 0 || resources.length === 0} className="min-h-11 rounded-xl bg-emerald-600 px-4 font-bold disabled:opacity-50">{saving ? 'Criando…' : 'Criar renda'}</button>
    </form>}
  </section>;
}
