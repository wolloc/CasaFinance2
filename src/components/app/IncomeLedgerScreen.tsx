import { useEffect, useState } from 'react';
import { LoaderCircle, ReceiptText } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdTransactions, type HouseholdTransaction } from '../../finance/householdTransactions.js';
import { IncomeCreationAction } from './IncomeCreationAction.js';
import { IncomeReceiptAction } from './IncomeReceiptAction.js';

const money = (value: string) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const stateLabel: Record<string,string> = { forecast: 'Prevista', confirmed: 'Confirmada', realized: 'Realizada', cancelled: 'Cancelada', reversed: 'Estornada' };

export function IncomeLedgerScreen() {
  const { household } = useSupabaseAuth();
  const [rows, setRows] = useState<HouseholdTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !household) return;
    let active = true;
    setLoading(true); setError(null);
    listHouseholdTransactions(supabase, household.id)
      .then((transactions) => { if (active) setRows(transactions.filter((row) => row.type === 'income')); })
      .catch(() => { if (active) setError('Não foi possível carregar as rendas da Casa.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [household?.id, refreshKey]);

  const refresh = () => setRefreshKey((value) => value + 1);

  return <div className="space-y-5">
    <header><h1 className="text-2xl font-black">Entradas</h1><p className="mt-1 text-sm text-slate-400">Renda verdadeira, previsão e caixa real ficam separados. O Casa nunca transforma transferência, acerto ou empréstimo em renda.</p></header>
    <IncomeCreationAction onCreated={refresh}/>
    <IncomeReceiptAction onCompleted={refresh}/>
    <section className="space-y-3">
      <h2 className="font-bold">Rendas cadastradas</h2>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {loading ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin"/> : rows.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">Nenhuma renda cadastrada.</p> : rows.map((row) => <article key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start gap-3"><ReceiptText className="mt-0.5 h-5 w-5 text-emerald-300"/><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><h3 className="font-bold">{row.description}</h3><strong className="text-emerald-300">+ {money(row.amount)}</strong></div><p className="mt-1 text-sm text-slate-400">{row.transaction_date} · {row.category?.name ?? 'Sem categoria'}</p><p className="mt-1 text-xs font-semibold text-emerald-300">{stateLabel[row.economic_state] ?? row.economic_state} · recebido {money(row.realized_amount)}</p></div></div></article>)}
    </section>
  </div>;
}
