import { useEffect, useState, type FormEvent } from 'react';
import { CalendarRange, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { closeRecurringExpenseRule, listRecurringExpenseRules, reviseRecurringExpenseRule, type RecurringExpenseFrequency, type RecurringExpenseRule } from '../../finance/recurringExpenses.js';

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const normalizeAmount = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');
const money = (value: string) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const frequencyLabel: Record<RecurringExpenseFrequency,string> = { weekly: 'Semanal', monthly: 'Mensal', yearly: 'Anual' };

export function RecurringExpenseManagement({ onChanged, focusRuleId }: { onChanged?: () => void; focusRuleId?: string | null }) {
  const { household } = useSupabaseAuth();
  const [rules, setRules] = useState<RecurringExpenseRule[]>([]);
  const [selected, setSelected] = useState<RecurringExpenseRule | null>(null);
  const [mode, setMode] = useState<'revise'|'close'|null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(localDate());
  const [amount, setAmount] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setError(null);
    try { const loaded=await listRecurringExpenseRules(supabase, household.id); setRules(loaded); if(focusRuleId&&!loaded.some(rule=>rule.id===focusRuleId))setError('Esta recorrência não está mais ativa.'); }
    catch { setError('Não foi possível carregar as séries de gastos.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [household?.id, focusRuleId]);

  const open = (rule: RecurringExpenseRule, nextMode: 'revise'|'close') => {
    setSelected(rule); setMode(nextMode); setEffectiveFrom(localDate()); setReason(''); setError(null); setSuccess(null);
    setAmount(rule.estimated_amount); setEndDate(rule.end_date ?? '');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household || !selected || !mode) return;
    const normalizedAmount = normalizeAmount(amount);
    if (!reason.trim()) { setError('Explique o motivo da mudança para manter o histórico auditável.'); return; }
    if (effectiveFrom < localDate()) { setError('A mudança só pode valer de hoje em diante.'); return; }
    if (mode === 'revise' && (!Number.isFinite(Number(normalizedAmount)) || Number(normalizedAmount) <= 0)) { setError('Informe um valor maior que zero.'); return; }
    if (mode === 'revise' && endDate && endDate < effectiveFrom) { setError('A data final não pode ser anterior ao início da nova versão.'); return; }

    setSaving(true); setError(null); setSuccess(null);
    try {
      if (mode === 'close') {
        await closeRecurringExpenseRule(supabase, { householdId: household.id, ruleId: selected.id, effectiveFrom, reason });
        setSuccess('Série encerrada dali em diante. Gastos e efeitos financeiros anteriores foram preservados.');
      } else {
        await reviseRecurringExpenseRule(supabase, { householdId: household.id, ruleId: selected.id, effectiveFrom, amount: normalizedAmount, endDate, reason });
        setSuccess('Nova versão criada. O passado permaneceu intacto e apenas o futuro foi recalculado.');
      }
      setSelected(null); setMode(null); await load(); onChanged?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível alterar a série.'); }
    finally { setSaving(false); }
  };

  const visibleRules=focusRuleId?rules.filter(rule=>rule.id===focusRuleId):rules;
  return <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
    <div className="flex items-start gap-3"><CalendarRange className="mt-0.5 h-5 w-5 text-amber-300"/><div><h2 className="font-bold">{focusRuleId?'Esta recorrência':'Gastos que se repetem'}</h2><p className="mt-1 text-sm text-slate-400">Veja o que vem pela frente e mude somente os próximos meses. O que já aconteceu continua preservado.</p></div></div>
    {loading ? <LoaderCircle className="mx-auto mt-4 h-5 w-5 animate-spin"/> : visibleRules.length === 0 ? <p className="mt-4 text-sm text-slate-400">Nenhuma série ativa.</p> : <div className="mt-4 space-y-3">{visibleRules.map((rule) => <article key={rule.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><div className="flex justify-between gap-3"><div><strong>{rule.template_description}</strong><p className="mt-1 text-xs text-slate-400">{money(rule.estimated_amount)} · {rule.frequency==='monthly'&&rule.interval_count===1?'todo mês':`${frequencyLabel[rule.frequency]} · legado`}</p><div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">{rule.next_occurrence_date&&<span className="rounded-full bg-slate-900 px-2 py-1">Próxima · {new Date(`${rule.next_occurrence_date}T12:00:00`).toLocaleDateString('pt-BR')}</span>}<span className="rounded-full bg-slate-900 px-2 py-1">{rule.end_date?`Termina · ${new Date(`${rule.end_date}T12:00:00`).toLocaleDateString('pt-BR')}`:'Até você parar'}</span></div></div><div className="flex gap-2"><button type="button" onClick={() => open(rule,'revise')} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold">Mudar próximos meses</button><button type="button" onClick={() => open(rule,'close')} className="rounded-lg border border-rose-800 px-3 py-2 text-xs font-bold text-rose-300">Parar recorrência</button></div></div></article>)}</div>}

    {selected && mode && <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-amber-900/60 bg-slate-950 p-3">
      <div><strong>{mode === 'revise' ? 'Mudar os próximos meses' : 'Parar recorrência'}</strong><p className="text-xs text-slate-400">{selected.template_description}</p></div>
      <label className="text-sm font-semibold">Vale a partir de<input type="date" min={localDate()} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"/></label>
      {mode === 'revise' && <><label className="text-sm font-semibold">Novo valor<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"/></label><p className="rounded-xl bg-slate-900 p-3 text-xs text-slate-400">Daqui para frente, gastos recorrentes seguem <strong className="text-slate-300">mensalmente</strong>. Se esta for uma série antiga semanal/anual, a nova versão passa para o padrão mensal da Release 1.</p><label className="text-sm font-semibold">Até quando? (opcional)<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3"/></label></>}
      <label className="text-sm font-semibold">Por que está mudando?<textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-900 p-3" placeholder="Ex.: reajuste do aluguel, assinatura cancelada"/></label>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
      <div className="flex gap-2"><button disabled={saving} className="min-h-11 flex-1 rounded-xl bg-amber-500 px-4 font-bold text-slate-950 disabled:opacity-50">{saving ? 'Salvando…' : mode === 'revise' ? 'Salvar mudança' : 'Parar recorrência'}</button><button type="button" onClick={() => { setSelected(null); setMode(null); }} className="min-h-11 rounded-xl border border-slate-700 px-4">Cancelar</button></div>
    </form>}
    {!selected && success && <p role="status" className="mt-3 text-sm text-emerald-300">{success}</p>}
    {!selected && error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
  </section>;
}
