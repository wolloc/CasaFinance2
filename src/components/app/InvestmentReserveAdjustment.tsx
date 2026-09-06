import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { LoaderCircle, PiggyBank } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import {
  isInvestmentOrReserve,
  isTransactionalResource,
  listInvestmentReserveResources,
  moveInvestmentReservePrincipal,
  type InvestmentReserveResource,
} from '../../finance/investmentReserveAdjustments.js';

const normalizeAmount = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');
const localDate = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

export function InvestmentReserveAdjustment({ onBack }: { onBack: () => void }) {
  const { household } = useSupabaseAuth();
  const [resources, setResources] = useState<InvestmentReserveResource[]>([]);
  const [kind, setKind] = useState<'deposit' | 'withdrawal'>('deposit');
  const [transactionalAccountId, setTransactionalAccountId] = useState('');
  const [investmentAccountId, setInvestmentAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDate());
  const [description, setDescription] = useState('Movimentação de principal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setError(null);
    try { setResources(await listInvestmentReserveResources(supabase, household.id)); }
    catch { setError('Não foi possível carregar os recursos da Casa.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [household?.id]);

  const transactionalResources = useMemo(() => resources.filter(isTransactionalResource), [resources]);
  const investmentResources = useMemo(() => resources.filter(isInvestmentOrReserve), [resources]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household) return;
    const normalizedAmount = normalizeAmount(amount);
    const numericAmount = Number(normalizedAmount);
    if (!transactionalAccountId || !investmentAccountId) { setError('Escolha o recurso transacional e o investimento/reserva.'); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Informe um valor maior que zero.'); return; }
    const sourceAccountId = kind === 'deposit' ? transactionalAccountId : investmentAccountId;
    const destinationAccountId = kind === 'deposit' ? investmentAccountId : transactionalAccountId;
    setSaving(true); setError(null); setSuccess(null);
    try {
      await moveInvestmentReservePrincipal(supabase, {
        householdId: household.id,
        sourceAccountId,
        destinationAccountId,
        amount: normalizedAmount,
        date,
        description,
      });
      setSuccess(kind === 'deposit'
        ? 'Aporte registrado como movimentação de principal. Nenhuma despesa foi criada.'
        : 'Resgate registrado como movimentação de principal. Nenhuma renda foi criada.');
      setAmount('');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a movimentação.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <button type="button" onClick={onBack} className="text-sm font-semibold text-blue-300">← Voltar às intenções</button>
    {loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin"/> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold">Investimento / reserva</h2><p className="mt-1 text-sm text-slate-400">Aqui o Casa movimenta apenas o principal. Aporte e resgate não são despesa nem renda; rendimento e perda são fatos econômicos separados.</p></div>
      <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setKind('deposit')} className={`rounded-xl border p-3 text-sm font-semibold ${kind === 'deposit' ? 'border-blue-500 bg-blue-950/50 text-blue-200' : 'border-slate-700 text-slate-400'}`}>Aporte</button><button type="button" onClick={() => setKind('withdrawal')} className={`rounded-xl border p-3 text-sm font-semibold ${kind === 'withdrawal' ? 'border-blue-500 bg-blue-950/50 text-blue-200' : 'border-slate-700 text-slate-400'}`}>Resgate</button></div>
      <label className="block text-sm">Recurso transacional<select value={transactionalAccountId} onChange={(event) => setTransactionalAccountId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{transactionalResources.map((resource) => <option key={resource.account_id} value={resource.account_id}>{resource.name}</option>)}</select></label>
      <label className="block text-sm">Investimento ou reserva<select value={investmentAccountId} onChange={(event) => setInvestmentAccountId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{investmentResources.map((resource) => <option key={resource.account_id} value={resource.account_id}>{resource.name}</option>)}</select></label>
      <div className="rounded-xl bg-slate-950 p-3 text-xs text-slate-400">{kind === 'deposit' ? 'O dinheiro sai do recurso transacional e entra no investimento/reserva.' : 'O dinheiro sai do investimento/reserva e volta ao recurso transacional.'} O principal continua neutro no resultado econômico.</div>
      <label className="block text-sm">Valor<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="0,00" /></label>
      <label className="block text-sm">Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      <label className="block text-sm">Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{success}</p>}
      {(transactionalResources.length === 0 || investmentResources.length === 0) && <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">Cadastre ao menos um recurso transacional e um investimento/reserva antes de registrar esta movimentação.</p>}
      <button type="submit" disabled={saving || transactionalResources.length === 0 || investmentResources.length === 0} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50"><PiggyBank className="h-4 w-4"/>{saving ? 'Registrando…' : kind === 'deposit' ? 'Registrar aporte' : 'Registrar resgate'}</button>
    </form>}
  </div>;
}
