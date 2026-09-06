import { useEffect, useState, type FormEvent } from 'react';
import { CalendarRange, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdCategories, type HouseholdCategory } from '../../finance/householdCategories.js';
import { incomeNatureLabels, type IncomeConfidence, type IncomeNature } from '../../finance/incomeFacts.js';
import { isTransactionalResource, listInvestmentReserveResources, type InvestmentReserveResource } from '../../finance/investmentReserveAdjustments.js';
import { createRecurringIncomeRule, type RecurringIncomeFrequency } from '../../finance/recurringIncome.js';

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const normalizeAmount = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');

export function RecurringIncomeAction({ onCreated }: { onCreated?: () => void }) {
  const { household, householdMembers } = useSupabaseAuth();
  const [categories, setCategories] = useState<HouseholdCategory[]>([]);
  const [resources, setResources] = useState<InvestmentReserveResource[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(localDate());
  const [endDate, setEndDate] = useState('');
  const [frequency, setFrequency] = useState<RecurringIncomeFrequency>('monthly');
  const [categoryId, setCategoryId] = useState('');
  const [beneficiaryMemberId, setBeneficiaryMemberId] = useState('');
  const [plannedDestinationAccountId, setPlannedDestinationAccountId] = useState('');
  const [incomeNature, setIncomeNature] = useState<IncomeNature>('salary');
  const [economicState, setEconomicState] = useState<IncomeConfidence>('confirmed');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !household) return;
    let active = true;
    setLoading(true);
    Promise.all([
      listHouseholdCategories(supabase, household.id),
      listInvestmentReserveResources(supabase, household.id),
    ]).then(([categoryRows, accountRows]) => {
      if (!active) return;
      setCategories(categoryRows.filter((category) => category.type === 'income'));
      setResources(accountRows.filter(isTransactionalResource));
    }).catch(() => { if (active) setError('Não foi possível carregar os dados da recorrência.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [household?.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household) return;
    const normalized = normalizeAmount(amount);
    if (!description.trim()) { setError('Informe de onde vem esta renda recorrente.'); return; }
    if (!Number.isFinite(Number(normalized)) || Number(normalized) <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (!categoryId || !beneficiaryMemberId || !plannedDestinationAccountId) { setError('Categoria, beneficiário e destino previsto são obrigatórios.'); return; }
    if (endDate && endDate < startDate) { setError('A data final não pode ser anterior ao início.'); return; }

    setSaving(true); setError(null); setSuccess(null);
    try {
      await createRecurringIncomeRule(supabase, {
        householdId: household.id,
        description,
        amount: normalized,
        startDate,
        endDate,
        frequency,
        categoryId,
        beneficiaryMemberId,
        plannedDestinationAccountId,
        incomeNature,
        economicState,
        notes,
      });
      setSuccess('Série criada. Cada competência vira uma renda separada e nenhuma delas altera o saldo até o recebimento real.');
      setDescription(''); setAmount(''); setEndDate(''); setNotes('');
      onCreated?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar a série de renda.'); }
    finally { setSaving(false); }
  };

  return <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
    <div className="flex items-start gap-3"><CalendarRange className="mt-0.5 h-5 w-5 text-emerald-300"/><div><h2 className="font-bold">Renda recorrente</h2><p className="mt-1 text-sm text-slate-400">Para salário, aluguel e outras rendas que se repetem. A regra cria ocorrências independentes; receber um mês não altera os próximos.</p></div></div>
    {loading ? <LoaderCircle className="mx-auto mt-4 h-5 w-5 animate-spin"/> : <form onSubmit={submit} className="mt-4 grid gap-3">
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Frequência<select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringIncomeFrequency)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="monthly">Mensal</option><option value="yearly">Anual</option></select></label><label className="text-sm font-semibold">Natureza<select value={incomeNature} onChange={(e) => setIncomeNature(e.target.value as IncomeNature)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3">{Object.entries(incomeNatureLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <label className="text-sm font-semibold">De onde vem?<input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3" placeholder="Ex.: Salário Itaú"/></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Valor por ocorrência<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3" placeholder="0,00"/></label><label className="text-sm font-semibold">Confiança<select value={economicState} onChange={(e) => setEconomicState(e.target.value as IncomeConfidence)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="confirmed">Confirmada — posso contar com ela</option><option value="forecast">Prevista — ainda pode mudar</option></select></label></div>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Primeiro recebimento<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"/></label><label className="text-sm font-semibold">Termina em (opcional)<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"/></label></div>
      <label className="text-sm font-semibold">De quem é esta renda?<select value={beneficiaryMemberId} onChange={(e) => setBeneficiaryMemberId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">Selecione</option>{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
      <label className="text-sm font-semibold">Onde espera receber?<select value={plannedDestinationAccountId} onChange={(e) => setPlannedDestinationAccountId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">Selecione</option>{resources.map((resource) => <option key={resource.account_id} value={resource.account_id}>{resource.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Categoria<select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3"><option value="">Selecione</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="text-sm font-semibold">Observação (opcional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/></label>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
      <button disabled={saving || categories.length === 0 || resources.length === 0} className="min-h-11 rounded-xl bg-emerald-600 px-4 font-bold disabled:opacity-50">{saving ? 'Criando série…' : 'Criar renda recorrente'}</button>
    </form>}
  </section>;
}
