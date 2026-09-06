import { useState } from 'react';
import { ChevronDown, ChevronUp, CircleDollarSign, LoaderCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';

export type ExpenseFinancialStoryRow = {
  transaction_id: string;
  effective_amount: string;
  responsibility_breakdown: Array<{ member_id: string | null; party_id: string | null; amount: string; percentage: string }>;
  member_funded_amount: string;
  external_paid_amount: string;
  remaining_to_fund: string;
  funding_breakdown: Array<{ funder_member_id: string; source_account_id: string; amount: string; funded_at: string; invoice_id: string | null }>;
  external_payment_breakdown: Array<{ payer_party_id: string; intent: 'gift' | 'reimbursement'; amount: string; occurred_at: string }>;
  settlement_breakdown: Array<{ debtor_member_id: string; creditor_member_id: string; amount: string; state: 'projected' | 'realized'; financial_date: string }>;
};

const money = (value: unknown) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ExpenseFinancialStory({ householdId, transactionId, memberName, partyName, accountName }: {
  householdId: string;
  transactionId: string;
  memberName: (id: string | null) => string;
  partyName: (id: string | null) => string;
  accountName: (id: string | null) => string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<ExpenseFinancialStoryRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || story || !supabase) return;
    setLoading(true); setError(null);
    const response = await supabase.from('financial_expense_story_positions')
      .select('transaction_id, effective_amount, responsibility_breakdown, member_funded_amount, external_paid_amount, remaining_to_fund, funding_breakdown, external_payment_breakdown, settlement_breakdown')
      .eq('household_id', householdId)
      .eq('transaction_id', transactionId)
      .single();
    if (response.error) setError('Não foi possível carregar a história financeira deste gasto.');
    else setStory(response.data as unknown as ExpenseFinancialStoryRow);
    setLoading(false);
  };

  return <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60">
    <button type="button" onClick={toggle} className="flex min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-semibold text-slate-300">
      <span className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-emerald-300"/>História financeira</span>
      {open ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
    </button>
    {open && <div className="border-t border-slate-800 p-3">
      {loading ? <LoaderCircle className="mx-auto h-4 w-4 animate-spin"/> : error ? <p className="text-xs text-rose-300">{error}</p> : story && <div className="grid gap-3 text-xs">
        <div><p className="font-semibold text-slate-300">Responsabilidade</p><div className="mt-1 space-y-1 text-slate-400">{story.responsibility_breakdown.length === 0 ? <p>Não informada.</p> : story.responsibility_breakdown.map((item, index) => <p key={`${item.member_id ?? item.party_id}-${index}`}>{item.member_id ? memberName(item.member_id) : partyName(item.party_id)} · {money(item.amount)} ({Number(item.percentage).toLocaleString('pt-BR')}%)</p>)}</div></div>
        <div className="grid grid-cols-2 gap-3"><div><p className="font-semibold text-slate-300">Pago por</p><div className="mt-1 space-y-1 text-slate-400">{story.funding_breakdown.length === 0 && story.external_payment_breakdown.length === 0 ? <p>Ainda sem funding realizado.</p> : <>{story.funding_breakdown.map((item, index) => <p key={`fund-${index}`}>{memberName(item.funder_member_id)} · {money(item.amount)}</p>)}{story.external_payment_breakdown.map((item, index) => <p key={`ext-${index}`}>{partyName(item.payer_party_id)} · {money(item.amount)} · {item.intent === 'gift' ? 'presente' : 'reembolso'}</p>)}</>}</div></div><div><p className="font-semibold text-slate-300">Saiu de</p><div className="mt-1 space-y-1 text-slate-400">{story.funding_breakdown.length === 0 ? <p>Ainda sem saída de caixa da Casa.</p> : story.funding_breakdown.map((item, index) => <p key={`cash-${index}`}>{accountName(item.source_account_id)} · {money(item.amount)}</p>)}</div></div></div>
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-900 p-2"><div><p className="text-slate-500">Já coberto</p><strong className="text-emerald-300">{money(Number(story.member_funded_amount) + Number(story.external_paid_amount))}</strong></div><div><p className="text-slate-500">Falta pagar</p><strong className={Number(story.remaining_to_fund) > 0 ? 'text-amber-300' : 'text-emerald-300'}>{money(story.remaining_to_fund)}</strong></div></div>
        <div><p className="font-semibold text-slate-300">Acerto gerado</p><div className="mt-1 space-y-1 text-slate-400">{story.settlement_breakdown.length === 0 ? <p>Nenhum acerto entre membros para este gasto.</p> : story.settlement_breakdown.map((item, index) => <p key={`settlement-${index}`}>{memberName(item.debtor_member_id)} → {memberName(item.creditor_member_id)} · {money(item.amount)} · {item.state === 'realized' ? 'realizado' : 'projetado'}</p>)}</div></div>
      </div>}
    </div>}
  </div>;
}
