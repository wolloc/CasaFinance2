import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, LoaderCircle, Plus, Check, X, UsersRound } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { getRetryStableRequestKey, releaseRetryStableRequestKey } from '../../finance/retryIdempotency.js';
import { listThirdPartyCommitmentPositions, type ThirdPartyCommitmentPosition } from '../../finance/thirdPartyCommitments.js';

type AccountOption = { id: string; name: string };
type PendingContribution = { requestKey: string; commitmentKey: string; counterpartyId: string; amount: string; accountId: string; occurredAt: string; notes: string };
const pendingStorageKey = (householdId: string, commitmentKey: string, counterpartyId: string) =>
  `casa:third-party-contribution:${householdId}:${commitmentKey}:${counterpartyId}`;
const readPendingContribution = (key: string): PendingContribution | null => {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingContribution;
    return value && typeof value.requestKey === 'string' ? value : null;
  } catch { return null; }
};
const writePendingContribution = (key: string, value: PendingContribution) => {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be unavailable; server idempotency still applies in this page. */ }
};
const clearPendingContribution = (key: string) => {
  try { if (typeof window !== 'undefined') window.localStorage.removeItem(key); } catch { /* Best effort cleanup. */ }
};
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function ThirdPartyCommitmentProjection({ financialMonth }: { financialMonth?: string }) {
  const { household } = useSupabaseAuth();
  const [rows, setRows] = useState<ThirdPartyCommitmentPosition[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [occurredAt, setOccurredAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [retryUncertain, setRetryUncertain] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !household?.id) {
      setRows([]);
      setAccounts([]);
      setLoading(false);
      return false;
    }
    setLoading(true);
    setFailed(false);
    try {
      const [positions, accountResult] = await Promise.all([
        listThirdPartyCommitmentPositions(supabase, household.id, financialMonth),
        supabase.from('accounts').select('id,name').eq('household_id', household.id).is('deactivated_at', null).order('name'),
      ]);
      if (accountResult.error) throw accountResult.error;
      setRows(positions);
      setAccounts((accountResult.data ?? []) as AccountOption[]);
      return true;
    } catch (error) {
      console.error('Casa Finance: falha ao carregar contribuições de terceiros', error);
      setFailed(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, [household?.id, financialMonth]);

  useEffect(() => { void load(); }, [load]);

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

  const startContribution = (row: ThirdPartyCommitmentPosition) => {
    setActiveKey(row.commitment_key);
    setAmount(row.expected_contribution_amount.toFixed(2));
    setAccountId(accounts[0]?.id ?? '');
    setOccurredAt(today());
    setNotes('');
    setFormError(null);
    setRetryUncertain(false);
    setNotice(null);
  };

  const friendlyError = (error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    if (/over.?collect|exceed|responsibility|contribution.*limit/i.test(message)) return 'Esse valor supera o que ainda está previsto. Atualize os valores e tente novamente.';
    if (/account|household|permission|unauthorized|forbidden|active member/i.test(message)) return 'Não foi possível validar a conta ou o acesso. Confira os dados e tente novamente.';
    if (/duplicate|idempot|request key|payload/i.test(message)) return 'Esse recebimento pode já ter sido registrado. Atualize os valores antes de tentar novamente.';
    return 'Não foi possível registrar o recebimento agora. Confira os dados e tente novamente.';
  };

  const saveContribution = async (row: ThirdPartyCommitmentPosition) => {
    if (!supabase || !household?.id || saving) return;
    const normalized = amount.trim().replace(',', '.');
    const numericAmount = Number(normalized);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Informe um valor maior que zero.');
      return;
    }
    if (numericAmount > row.expected_contribution_amount + 0.000001) {
      setFormError('O valor não pode superar a contribuição ainda prevista.');
      return;
    }
    if (!accountId) {
      setFormError('Selecione a conta em que o dinheiro entrou.');
      return;
    }
    if (!occurredAt) {
      setFormError('Informe a data em que o dinheiro foi recebido.');
      return;
    }

    // Keep one key per open commitment form, not per editable payload. If the
    // response is ambiguous, the form is locked and retry replays the exact same payload.
    const identity = [household.id, row.commitment_key, row.counterparty_id];
    const requestKey = getRetryStableRequestKey('third-party-contribution-record', identity);
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const result = await supabase.rpc('record_third_party_contribution', {
        p_household_id: household.id,
        p_commitment_key: row.commitment_key,
        p_counterparty_id: row.counterparty_id,
        p_destination_account_id: accountId,
        p_amount: numericAmount,
        p_occurred_at: new Date(`${occurredAt}T12:00:00.000Z`).toISOString(),
        p_request_key: requestKey,
        p_notes: notes.trim() || null,
      });
      if (result.error) throw result.error;
      releaseRetryStableRequestKey('third-party-contribution-record', identity);
      setRetryUncertain(false);
      setActiveKey(null);
      setNotice(`Contribuição de ${money(submittedAmount)} registrada como entrada de caixa, não como renda.`);
      const refreshed = await load();
      if (!refreshed) setNotice(`Contribuição de ${money(submittedAmount)} registrada, mas a tela não atualizou. Use “Tentar novamente” para conferir os valores.`);
    } catch (error) {
      console.error('Casa Finance: falha ao registrar contribuição de terceiro', error);
      const message = error instanceof Error ? error.message : '';
      const uncertain = /network|failed to fetch|fetch failed|connection (?:closed|reset)|econnreset|statement timeout|canceling statement due to statement timeout/i.test(message);
      if (uncertain) {
        // Do not release the key or allow edits: retry must use the same key and payload.
        setRetryUncertain(true);
        setFormError('Não foi possível confirmar se o recebimento foi salvo. Os campos foram bloqueados para evitar duplicidade. Tente confirmar novamente com os mesmos dados.');
      } else {
        releaseRetryStableRequestKey('third-party-contribution-record', identity);
        setFormError(friendlyError(error));
      }
    } finally {
      setSaving(false);
    }
  };

  return <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/35 p-3">
    <div className="flex items-center gap-2">
      <CalendarClock className="h-4 w-4 text-cyan-300" />
      <h3 className="text-xs font-bold text-slate-300">Contribuições previstas</h3>
      <span className="ml-auto text-xs text-slate-500">Contribuições previstas · Projeção · não é saldo disponível</span>
    </div>
    {notice && <p role="status" className="text-xs text-emerald-300">{notice}</p>}
    {loading ? <LoaderCircle className="h-4 w-4 animate-spin text-cyan-300" /> :
      failed ? <div role="status" className="flex items-center justify-between gap-3 text-sm text-amber-200"><span>Não foi possível carregar os valores com terceiros agora.</span><button type="button" onClick={() => void load()} className="min-h-10 rounded-lg border border-slate-700 px-3 text-sm font-semibold text-slate-200">Tentar novamente</button></div> :
      grouped.length === 0 ? <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 h-5 w-5 text-slate-400" /><div><p className="text-sm font-semibold text-slate-200">Nenhuma contribuição prevista</p><p className="mt-1 text-sm text-slate-400">Quando houver valores atribuídos a outras pessoas, eles aparecerão aqui.</p></div></div></div> :
      <div className="space-y-2">
        {grouped.map(group => <details key={group.id} className="rounded-lg border border-slate-800/80 px-3 py-2" open={group.items.some(item => item.commitment_key === activeKey)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="truncate text-xs font-semibold text-slate-300">{group.name}</span>
            <strong className="whitespace-nowrap text-xs text-cyan-200">{money(group.total)}</strong>
          </summary>
          <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
            {group.items.map(item => <div key={item.commitment_key} className="space-y-2 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-slate-300">{item.description}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{item.due_date ? `Vencimento ${dateLabel(item.due_date)}` : `Data financeira ${dateLabel(item.financial_date)}`}{item.source_installment_id ? ' · Parcela do cartão' : ''}</p>
                  {item.received_contribution_amount > 0 && <p className="mt-0.5 text-[10px] text-emerald-300">Já recebido: {money(item.received_contribution_amount)}</p>}
                </div>
                <div className="text-right">
                  <strong className="whitespace-nowrap text-slate-300">{money(item.expected_contribution_amount)}</strong>
                  <p className="text-[10px] text-slate-500">Ainda previsto</p>
                </div>
              </div>
              {activeKey === item.commitment_key ? <div className="space-y-2 rounded-lg bg-slate-900/80 p-3">
                <label className="block text-[11px] text-slate-300">Valor recebido
                  <input aria-label={`Valor recebido de ${group.name}`} type="number" min="0.01" max={item.expected_contribution_amount} step="0.01" value={amount} disabled={saving || retryUncertain} onChange={event => setAmount(event.target.value)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" />
                </label>
                <label className="block text-[11px] text-slate-300">Conta em que entrou
                  <select aria-label="Conta de destino" value={accountId} disabled={saving || retryUncertain} onChange={event => setAccountId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white">
                    <option value="">Selecione a conta</option>
                    {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </label>
                <label className="block text-[11px] text-slate-300">Data do recebimento
                  <input aria-label="Data do recebimento" type="date" value={occurredAt} disabled={saving || retryUncertain} onChange={event => setOccurredAt(event.target.value)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" />
                </label>
                <label className="block text-[11px] text-slate-300">Observação (opcional)
                  <input aria-label="Observação da contribuição" value={notes} disabled={saving || retryUncertain} onChange={event => setNotes(event.target.value)} maxLength={500} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white" />
                </label>
                {formError && <p role="alert" className="text-xs text-rose-300">{formError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setActiveKey(null); setFormError(null); }} disabled={saving || retryUncertain} className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 disabled:opacity-50"><X className="h-3 w-3" /> Cancelar</button>
                  <button type="button" onClick={() => void saveContribution(item)} disabled={saving || accounts.length === 0} className="inline-flex items-center gap-1 rounded-md bg-cyan-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} {retryUncertain ? "Tentar confirmar recebimento" : "Registrar recebimento"}</button>
                </div>
              </div> : <button type="button" onClick={() => startContribution(item)} className="inline-flex items-center gap-1 rounded-md border border-cyan-900 px-2 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-950/50"><Plus className="h-3 w-3" /> Registrar contribuição</button>}
            </div>)}
          </div>
        </details>)}
      </div>}
    {accounts.length === 0 && !loading && !failed && <p className="text-[10px] text-amber-300">Cadastre uma conta ativa para registrar onde o dinheiro entrou.</p>}
  </section>;
}
