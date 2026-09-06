import { useEffect, useState, type FormEvent } from 'react';
import { HandCoins, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { createManualThirdPartyObligation, listFinancialPartyOptions, type FinancialPartyOption } from '../../finance/thirdPartyObligations.js';

const normalizeAmount = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');
const localDate = () => { const date = new Date(); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10); };

export function ThirdPartyObligationCreation({ onBack }: { onBack: () => void }) {
  const { household } = useSupabaseAuth();
  const [parties, setParties] = useState<FinancialPartyOption[]>([]);
  const [kind, setKind] = useState<'receivable' | 'payable'>('receivable');
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [obligationDate, setObligationDate] = useState(localDate());
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !household) return;
    setLoading(true);
    listFinancialPartyOptions(supabase, household.id)
      .then(setParties)
      .catch(() => setError('Não foi possível carregar as pessoas cadastradas.'))
      .finally(() => setLoading(false));
  }, [household?.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household) return;
    const normalized = normalizeAmount(amount);
    if (!partyId || !description.trim() || !Number.isFinite(Number(normalized)) || Number(normalized) <= 0) {
      setError('Informe pessoa, descrição e um valor maior que zero.'); return;
    }
    if (dueDate && dueDate < obligationDate) { setError('O vencimento não pode ser anterior à data da obrigação.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      await createManualThirdPartyObligation(supabase, { householdId: household.id, kind, counterpartyId: partyId, amount: normalized, obligationDate, dueDate, description, notes });
      setSuccess(kind === 'receivable'
        ? 'Valor a receber criado. Nenhuma renda entrou e nenhum saldo aumentou; o caixa só muda quando o dinheiro realmente for recebido.'
        : 'Valor a pagar criado. Nenhuma despesa nova nem saída de caixa foi inventada; o caixa só muda quando o pagamento realmente acontecer.');
      setAmount(''); setDescription(''); setNotes(''); setDueDate('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível criar esta obrigação.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <button type="button" onClick={onBack} className="text-sm font-semibold text-blue-300">← Voltar às intenções</button>
    {loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin"/> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold">Criar valor com outra pessoa</h2><p className="mt-1 text-sm text-slate-400">Use quando já existe um valor a receber ou a pagar, mas ele não nasceu de uma compra, renda, empréstimo ou outro fato já registrado no Casa. Criar a obrigação não movimenta dinheiro.</p></div>
      <label className="block text-sm">O que existe?<select value={kind} onChange={(event) => setKind(event.target.value as 'receivable' | 'payable')} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="receivable">Alguém deve para a Casa</option><option value="payable">A Casa deve para alguém</option></select></label>
      <label className="block text-sm">Com quem?<select value={partyId} onChange={(event) => setPartyId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
      {parties.length === 0 && <p className="rounded-xl border border-amber-900 bg-amber-950/20 p-3 text-xs text-amber-200">Cadastre a pessoa em Configurações → Pessoas antes de criar este valor. O Casa não cria um terceiro implícito.</p>}
      <label className="block text-sm">Por que esse valor existe?<input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="Ex.: valor que emprestei antes de usar o Casa" /></label>
      <label className="block text-sm">Valor<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="0,00" /></label>
      <label className="block text-sm">Data em que a obrigação nasceu<input type="date" value={obligationDate} onChange={(event) => setObligationDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      <label className="block text-sm">Vencimento (opcional)<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      <label className="block text-sm">Observação (opcional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      <p className="rounded-xl border border-blue-900 bg-blue-950/30 p-3 text-xs text-blue-200"><strong>Regra do Casa:</strong> obrigação não é automaticamente renda ou despesa. Esta ação só registra o compromisso. Quando houver recebimento ou pagamento real, use “Acerto com outra pessoa”.</p>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
      <button type="submit" disabled={saving || parties.length === 0} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50"><HandCoins className="h-4 w-4"/>{saving ? 'Criando…' : 'Criar obrigação sem movimentar caixa'}</button>
    </form>}
  </div>;
}
