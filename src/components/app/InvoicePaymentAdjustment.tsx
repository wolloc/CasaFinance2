import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CreditCard, LoaderCircle } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount } from '../../finance/householdFinancialAccounts.js';
import { listFinancialInvoices, type FinancialInvoice } from '../../finance/financialInvoices.js';
import { payHouseholdInvoice } from '../../finance/invoicePayments.js';

const formatMoney = (value: unknown) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const normalizeAmount = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');

export function InvoicePaymentAdjustment({ onBack }: { onBack: () => void }) {
  const { household, householdMembers } = useSupabaseAuth();
  const [invoices, setInvoices] = useState<FinancialInvoice[]>([]);
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [funderMemberId, setFunderMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setError(null);
    try {
      const [invoiceRows, financial] = await Promise.all([
        listFinancialInvoices(supabase, household.id),
        listHouseholdFinancialAccounts(supabase, household.id),
      ]);
      setInvoices(invoiceRows.filter((invoice) => Number(invoice.outstanding_amount) > 0));
      setAccounts(financial.accounts);
    } catch { setError('Não foi possível carregar as faturas e recursos da Casa.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [household?.id]);

  const selectedInvoice = useMemo(() => invoices.find((invoice) => invoice.invoice_id === invoiceId), [invoices, invoiceId]);
  const outstanding = Number(selectedInvoice?.outstanding_amount ?? 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household) return;
    const normalizedAmount = normalizeAmount(amount);
    const numericAmount = Number(normalizedAmount);
    if (!invoiceId) { setError('Escolha a fatura que foi paga.'); return; }
    if (!sourceAccountId) { setError('Informe de qual recurso o dinheiro realmente saiu.'); return; }
    if (!funderMemberId) { setError('Informe quem efetivamente financiou este pagamento.'); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (numericAmount > outstanding) { setError('O pagamento não pode superar o valor em aberto da fatura.'); return; }
    const paidAt = new Date(`${paidDate}T12:00:00`).toISOString();
    setSaving(true); setError(null); setSuccess(null);
    try {
      await payHouseholdInvoice(supabase, {
        householdId: household.id,
        invoiceId,
        sourceAccountId,
        funderMemberId,
        amount: normalizedAmount,
        paidAt,
      });
      setSuccess('Pagamento registrado. A fatura foi liquidada sem criar uma segunda despesa.');
      setAmount(''); setInvoiceId(''); setSourceAccountId(''); setFunderMemberId('');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o pagamento da fatura.'); }
    finally { setSaving(false); }
  };

  return <div className="space-y-4">
    <button type="button" onClick={onBack} className="text-sm font-semibold text-blue-300">← Voltar às intenções</button>
    {loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin"/> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div><h2 className="font-bold">Pagamento de fatura</h2><p className="mt-1 text-sm text-slate-400">A despesa já nasceu nas compras do cartão. Aqui o Casa registra apenas a liquidação da obrigação e a saída real de caixa.</p></div>
      <label className="block text-sm">Qual fatura foi paga?<select value={invoiceId} onChange={(event) => { setInvoiceId(event.target.value); setAmount(''); }} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{invoices.map((invoice) => <option key={invoice.invoice_id} value={invoice.invoice_id}>{invoice.card_name} · {invoice.competence_date} · em aberto {formatMoney(invoice.outstanding_amount)}</option>)}</select></label>
      {selectedInvoice && <div className="rounded-xl bg-slate-950 p-3 text-sm"><p><span className="text-slate-400">Em aberto:</span> <strong className="text-amber-200">{formatMoney(outstanding)}</strong></p><p className="mt-1 text-xs text-slate-500">Conta prevista: {selectedInvoice.account_name ?? 'não definida'}. Isso é só uma previsão; abaixo você informa de onde o dinheiro realmente saiu.</p></div>}
      <label className="block text-sm">De qual recurso o dinheiro saiu?<select value={sourceAccountId} onChange={(event) => setSourceAccountId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label className="block text-sm">Quem efetivamente financiou este pagamento?<select value={funderMemberId} onChange={(event) => setFunderMemberId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>
      <label className="block text-sm">Valor pago<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="0,00" /></label>
      <label className="block text-sm">Data do pagamento<input type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>
      {error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}
      {success && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{success}</p>}
      {invoices.length === 0 && <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-400">Não há faturas com saldo em aberto.</p>}
      <button type="submit" disabled={saving || invoices.length === 0} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50"><CreditCard className="h-4 w-4"/>{saving ? 'Registrando…' : 'Registrar pagamento'}</button>
    </form>}
  </div>;
}
