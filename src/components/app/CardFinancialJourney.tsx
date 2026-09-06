import { useState } from 'react';
import { ChevronDown, ChevronUp, LoaderCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { listHouseholdFinancialAccounts } from '../../finance/householdFinancialAccounts.js';
import { listCardFinancialJourney, type CardFinancialJourney as Journey } from '../../finance/cardFinancialJourney.js';

const money = (value: number | string) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CardFinancialJourney({ cardId }: { cardId: string }) {
  const { household, householdMembers } = useSupabaseAuth();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Journey[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const memberName = (id: string) => householdMembers.find((member) => member.id === id)?.display_name ?? 'Membro';
  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name ?? 'Conta';

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || rows.length || !supabase || !household) return;
    setLoading(true); setError(false);
    try {
      const [journey, financial] = await Promise.all([
        listCardFinancialJourney(supabase, household.id, cardId),
        listHouseholdFinancialAccounts(supabase, household.id),
      ]);
      setRows(journey); setAccounts(financial.accounts);
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  return <div className="mt-3 border-t border-slate-800 pt-3">
    <button type="button" onClick={toggle} className="flex w-full items-center justify-between text-xs font-semibold text-violet-300">
      <span>Ver jornada do cartão</span>{open ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
    </button>
    {open && <div className="mt-3 space-y-3">
      {loading ? <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-violet-300"/> : error ? <p className="text-xs text-rose-300">Não foi possível carregar a jornada. Nenhum valor foi presumido.</p> : rows.length === 0 ? <p className="text-xs text-slate-500">Ainda não há faturas materializadas para este cartão.</p> : rows.map((row) => <article key={row.invoice_id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <div className="flex justify-between gap-3"><div><h4 className="text-sm font-bold">Fatura {row.invoice_month.slice(0,7)}</h4><p className="text-xs text-slate-500">Vence {row.due_date}</p></div><strong className="text-sm">{money(row.known_invoice_amount)}</strong></div>
        <div className="mt-3 space-y-2 text-xs text-slate-400">
          <p className="flex justify-between gap-3"><span>Compra → parcela/fatura</span><strong className="text-slate-200">{row.installment_count > 0 ? `${row.installment_count} parcela(s)` : `${row.purchase_commitment_count} compromisso(s)`}</strong></p>
          <p className="flex justify-between gap-3"><span>Pago da fatura</span><strong className="text-emerald-300">{money(row.paid_amount)}</strong></p>
          <p className="flex justify-between gap-3"><span>Falta pagar</span><strong className={Number(row.remaining_amount) > 0 ? 'text-amber-300' : 'text-emerald-300'}>{money(row.remaining_amount)}</strong></p>
        </div>
        {row.payment_events.length > 0 && <div className="mt-3 rounded-lg bg-slate-900 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Caixa</p>{row.payment_events.map((event, index) => <p key={`${event.paid_at}:${index}`} className="mt-1 text-xs text-slate-300">Saiu de {accountName(event.account_id)} · {money(event.amount)}</p>)}</div>}
        {row.funding_events.length > 0 && <div className="mt-2 rounded-lg bg-slate-900 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Funding</p>{row.funding_events.map((event, index) => <p key={`${event.funded_at}:${index}`} className="mt-1 text-xs text-slate-300">{memberName(event.member_id)} bancou {money(event.amount)}</p>)}</div>}
        {row.settlement_events.length > 0 && <div className="mt-2 rounded-lg bg-slate-900 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Acertos das compras</p>{row.settlement_events.map((event, index) => <p key={`${event.financial_date}:${index}`} className="mt-1 text-xs text-slate-300">{memberName(event.debtor_member_id)} → {memberName(event.creditor_member_id)} · {money(event.amount)} · {event.state === 'realized' ? 'realizado' : 'projetado'}</p>)}</div>}
        <p className="mt-3 text-[11px] text-slate-500">O pagamento da fatura movimenta caixa e realiza funding. Ele não cria outra despesa nem outro acerto.</p>
      </article>)}
    </div>}
  </div>;
}
