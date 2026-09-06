import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CreditCard, LoaderCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase.js';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount } from '../../finance/householdFinancialAccounts.js';
import { listPostPaymentCardRefundPositions, recordPostPaymentCardRefund, type PostPaymentCardRefundPosition, type RefundBenefitAllocationInput } from '../../finance/postPaymentCardRefunds.js';

const money = (value: number | string | null | undefined) => Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const localDate = () => { const now = new Date(); const offset = now.getTimezoneOffset(); return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10); };
const normalize = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');

export function PostPaymentCardRefundAction() {
  const { household, householdMembers } = useSupabaseAuth();
  const [rows, setRows] = useState<PostPaymentCardRefundPosition[]>([]);
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [outcome, setOutcome] = useState<'future_invoice_credit' | 'cash_return'>('future_invoice_credit');
  const [targetInvoiceId, setTargetInvoiceId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [benefits, setBenefits] = useState<RefundBenefitAllocationInput[]>([]);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDate());
  const [reason, setReason] = useState('Estorno pós-pagamento');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true);
    try {
      const [refundRows, financial] = await Promise.all([
        listPostPaymentCardRefundPositions(supabase, household.id),
        listHouseholdFinancialAccounts(supabase, household.id),
      ]);
      setRows(refundRows);
      setAccounts(financial.accounts);
    } catch {
      setError('Não foi possível carregar compras, membros e contas elegíveis para estorno pós-pagamento.');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [household?.id]);

  const selected = useMemo(() => rows.find((row) => row.transaction_id === selectedId) ?? null, [rows, selectedId]);
  const target = selected?.future_invoice_targets.find((invoice) => invoice.invoice_id === targetInvoiceId) ?? null;
  const benefitTotal = benefits.reduce((sum, allocation) => sum + Number(allocation.percentage || 0), 0);
  const memberName = (id: string) => householdMembers.find((member) => member.id === id)?.display_name ?? 'Membro';
  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name ?? 'Conta';

  const choosePurchase = (transactionId: string) => {
    setSelectedId(transactionId); setTargetInvoiceId(''); setDestinationAccountId(''); setAmount(''); setSuccess(null); setError(null);
    const row = rows.find((candidate) => candidate.transaction_id === transactionId);
    if (!row) { setBenefits([]); return; }
    const byMember = new Map<string, number>();
    for (const allocation of row.responsibility_allocations) byMember.set(allocation.member_id, (byMember.get(allocation.member_id) ?? 0) + Number(allocation.percentage));
    setBenefits([...byMember.entries()].map(([memberId, percentage]) => ({ memberId, percentage })));
  };

  const setBenefitPercentage = (memberId: string, percentage: number) => {
    setBenefits((current) => {
      const next = current.filter((allocation) => allocation.memberId !== memberId);
      if (percentage > 0) next.push({ memberId, percentage });
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household || !selected) return;
    const normalizedAmount = normalize(amount); const numeric = Number(normalizedAmount);
    const max = outcome === 'future_invoice_credit' && target ? Math.min(Number(selected.remaining_refundable_amount), Number(target.outstanding)) : Number(selected.remaining_refundable_amount);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > max) { setError(`Informe um valor entre R$ 0,01 e ${money(max)}.`); return; }
    if (Math.abs(benefitTotal - 100) > 0.000001) { setError('Diga quem ficou com o benefício do estorno. Os percentuais precisam totalizar 100%.'); return; }
    if (outcome === 'future_invoice_credit' && !target) { setError('Escolha a fatura futura onde o crédito apareceu.'); return; }
    if (outcome === 'cash_return' && !destinationAccountId) { setError('Escolha a conta onde o dinheiro realmente voltou.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      await recordPostPaymentCardRefund(supabase, {
        householdId: household.id, transactionId: selected.transaction_id, outcome, amount: normalizedAmount,
        benefitAllocations: benefits, targetInvoiceId: outcome === 'future_invoice_credit' ? targetInvoiceId : null,
        destinationAccountId: outcome === 'cash_return' ? destinationAccountId : null,
        occurredAt: `${date}T12:00:00-03:00`, reason,
      });
      setSuccess(outcome === 'future_invoice_credit'
        ? 'Crédito registrado na fatura futura e o benefício foi distribuído explicitamente. Nenhuma renda ou entrada em conta foi criada.'
        : `Dinheiro devolvido registrado em ${accountName(destinationAccountId)}. O Casa recalculou o acerto entre vocês sem transformar o estorno em renda.`);
      setAmount(''); setTargetInvoiceId(''); setDestinationAccountId(''); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o estorno pós-pagamento.'); }
    finally { setSaving(false); }
  };

  return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
    <div className="flex items-start gap-3"><CreditCard className="mt-0.5 h-5 w-5 text-fuchsia-300"/><div><h2 className="font-bold">Estorno depois de pagar a fatura</h2><p className="mt-1 text-sm text-slate-400">Agora o Casa também aceita compras compartilhadas, outra conta de devolução e beneficiário diferente de quem pagou. Nada é inferido pelo titular do cartão ou da conta.</p></div></div>
    {loading ? <LoaderCircle className="mx-auto mt-4 h-5 w-5 animate-spin"/> : <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block text-sm">Qual compra foi estornada?<select value={selectedId} onChange={(event) => choosePurchase(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{rows.map((row) => <option key={row.transaction_id} value={row.transaction_id}>{row.description} · {money(row.remaining_refundable_amount)} ainda estornável</option>)}</select></label>
      {selected && <div className="rounded-xl bg-slate-950 p-3 text-xs text-slate-400"><p>Responsabilidade atual: {selected.responsibility_allocations.map((allocation) => `${memberName(allocation.member_id)} ${money(allocation.amount)}`).join(' · ')}</p><p>Funding histórico preservado: {selected.original_funding_routes.map((route) => `${memberName(route.funder_member_id)} ${money(route.amount)}`).join(' · ')}</p><p>Ainda estornável: <strong className="text-slate-200">{money(selected.remaining_refundable_amount)}</strong></p></div>}
      <fieldset className="space-y-2"><legend className="text-sm">Como o banco devolveu?</legend><label className="flex gap-2 text-sm"><input type="radio" checked={outcome === 'future_invoice_credit'} onChange={() => setOutcome('future_invoice_credit')}/>Crédito em uma fatura futura</label><label className="flex gap-2 text-sm"><input type="radio" checked={outcome === 'cash_return'} onChange={() => setOutcome('cash_return')}/>Dinheiro voltou para uma conta</label></fieldset>
      {selected && outcome === 'future_invoice_credit' && <label className="block text-sm">Em qual fatura futura o crédito apareceu?<select value={targetInvoiceId} onChange={(event) => setTargetInvoiceId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{selected.future_invoice_targets.map((invoice) => <option key={invoice.invoice_id} value={invoice.invoice_id}>Fatura {invoice.invoice_month.slice(0, 7)} · saldo {money(invoice.outstanding)}</option>)}</select></label>}
      {selected && outcome === 'cash_return' && <label className="block text-sm">Em qual conta o dinheiro realmente voltou?<select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><span className="mt-1 block text-xs text-slate-500">A conta define onde o caixa entrou. Ela não define quem ficou com o benefício.</span></label>}
      <label className="block text-sm">Valor<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/></label>
      {selected && <fieldset className="space-y-2 rounded-xl border border-blue-900 bg-blue-950/20 p-3"><legend className="px-1 text-sm font-semibold">Quem ficou com o benefício desse estorno?</legend><p className="text-xs text-blue-200">Isso é independente de comprador, titular do cartão, conta de destino e de quem financiou a compra.</p>{householdMembers.map((member) => { const value = benefits.find((allocation) => allocation.memberId === member.id)?.percentage ?? 0; return <label key={member.id} className="grid grid-cols-[1fr_6rem] items-center gap-3 text-sm"><span>{member.display_name}</span><span className="flex items-center gap-1"><input inputMode="decimal" value={value || ''} onChange={(event) => setBenefitPercentage(member.id, Number(event.target.value.replace(',', '.')) || 0)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-right"/>%</span></label>; })}<p className={Math.abs(benefitTotal - 100) < 0.000001 ? 'text-xs text-emerald-300' : 'text-xs text-amber-300'}>Total: {benefitTotal.toLocaleString('pt-BR')}%</p></fieldset>}
      <label className="block text-sm">Data do estorno<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/></label>
      <label className="block text-sm">Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"/></label>
      <p className="rounded-xl border border-fuchsia-900/60 bg-fuchsia-950/20 p-3 text-xs text-fuchsia-200"><strong>Regra do Casa:</strong> o estorno reduz o custo econômico da compra. Se o benefício ficou com pessoa diferente de quem financiou, nasce um ajuste de acerto entre vocês. O funding antigo não é apagado.</p>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
      <button disabled={saving || !selected} className="min-h-12 w-full rounded-xl bg-fuchsia-600 font-bold disabled:opacity-50">{saving ? 'Registrando…' : 'Registrar estorno e redistribuição'}</button>
    </form>}
  </section>;
}
