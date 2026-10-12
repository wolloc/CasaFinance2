import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listThirdPartyCommitmentPositions, type ThirdPartyCommitmentPosition } from '../../finance/thirdPartyCommitments.js';

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');

export function ThirdPartyCommitmentProjection({ financialMonth }: { financialMonth?: string }) {
  const { household } = useSupabaseAuth();
  const [rows, setRows] = useState<ThirdPartyCommitmentPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase || !household?.id) {
        if (active) { setRows([]); setLoading(false); }
        return;
      }
      setLoading(true);
      setFailed(false);
      try {
        const result = await listThirdPartyCommitmentPositions(supabase, household.id, financialMonth);
        if (active) setRows(result);
      } catch (error) {
        console.error('Casa Finance: falha ao carregar contribuições previstas de terceiros', error);
        if (active) { setRows([]); setFailed(true); }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [household?.id, financialMonth]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ThirdPartyCommitmentPosition[]>();
    for (const row of rows) groups.set(row.counterparty_id, [...(groups.get(row.counterparty_id) ?? []), row]);
    return [...groups.entries()].map(([id, items]) => ({
      id,
      name: items[0]?.counterparty_name ?? 'Outra pessoa',
      total: items.reduce((sum, item) => sum + item.expected_contribution_amount, 0),
      items,
    })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [rows]);

  return <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/35 p-3">
    <div className="flex items-center gap-2">
      <CalendarClock className="h-4 w-4 text-cyan-300" />
      <h3 className="text-xs font-bold text-slate-300">Contribuições previstas</h3>
      <span className="ml-auto text-[10px] text-slate-500">Projeção · não é saldo disponível</span>
    </div>
    {loading ? <LoaderCircle className="h-4 w-4 animate-spin text-cyan-300" /> :
      failed ? <p role="status" className="text-xs text-amber-300">Não foi possível carregar as contribuições previstas agora.</p> :
      groups.length === 0 ? <p className="text-xs text-slate-500">Nenhuma contribuição prevista para este período.</p> :
      <div className="space-y-2">
        {groups.map(group => <details key={group.id} className="rounded-lg border border-slate-800/80 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="truncate text-xs font-semibold text-slate-300">{group.name}</span>
            <strong className="whitespace-nowrap text-xs text-cyan-200">{money(group.total)}</strong>
          </summary>
          <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
            {group.items.map(item => <div key={item.commitment_key} className="flex items-start justify-between gap-3 text-xs">
              <div className="min-w-0">
                <p className="truncate text-slate-300">{item.description}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{item.due_date ? `Vencimento ${dateLabel(item.due_date)}` : `Data financeira ${dateLabel(item.financial_date)}`}{item.source_installment_id ? ' · Parcela do cartão' : ''}</p>
              </div>
              <strong className="whitespace-nowrap text-slate-300">{money(item.expected_contribution_amount)}</strong>
            </div>)}
          </div>
        </details>)}
      </div>}
  </section>;
}
