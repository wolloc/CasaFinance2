import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeftRight, Banknote, CreditCard, HandCoins, Landmark, LoaderCircle, PiggyBank, Users } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { listHouseholdFinancialAccounts, type HouseholdAccount } from '../../finance/householdFinancialAccounts.js';
import { listMemberSettlementPositions, settleMemberPosition, type MemberSettlementPosition } from '../../finance/memberSettlements.js';

const formatMoney = (value: unknown) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const normalizeAmount = (value: string) => value.trim().replace(/\./g, '').replace(',', '.');

const intentions = [
  { id: 'transfer', label: 'Transferência entre recursos', description: 'Mover dinheiro entre contas ou recursos sem criar renda ou despesa.', icon: ArrowLeftRight, ready: false },
  { id: 'members', label: 'Acerto entre nós', description: 'Liquidar explicitamente uma dívida já realizada entre Wallace e Guilherme.', icon: Users, ready: true },
  { id: 'third-party', label: 'Acerto com outra pessoa', description: 'Receber ou pagar valores vinculados a terceiros.', icon: HandCoins, ready: false },
  { id: 'invoice', label: 'Pagamento de fatura', description: 'Movimentar caixa para liquidar cartão sem criar uma nova despesa.', icon: CreditCard, ready: false },
  { id: 'reserve', label: 'Investimento / reserva', description: 'Aporte ou resgate de principal como movimento patrimonial neutro.', icon: PiggyBank, ready: false },
  { id: 'loan', label: 'Empréstimos', description: 'Registrar movimentações de dívida sem tratar principal como renda ou despesa.', icon: Banknote, ready: false },
] as const;

export function NewAdjustmentScreen() {
  const { household, householdMembers } = useSupabaseAuth();
  const [selected, setSelected] = useState<(typeof intentions)[number]['id'] | null>(null);
  const [positions, setPositions] = useState<MemberSettlementPosition[]>([]);
  const [accounts, setAccounts] = useState<HouseholdAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payer, setPayer] = useState('');
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [sourceAccount, setSourceAccount] = useState('');
  const [destinationAccount, setDestinationAccount] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    if (!supabase || !household) return;
    setLoading(true); setError(null);
    try {
      const [positionRows, financial] = await Promise.all([
        listMemberSettlementPositions(supabase, household.id),
        listHouseholdFinancialAccounts(supabase, household.id),
      ]);
      setPositions(positionRows); setAccounts(financial.accounts);
    } catch { setError('Não foi possível carregar os acertos e recursos da Casa.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selected === 'members') load(); }, [selected, household?.id]);

  const currentPosition = useMemo(() => positions.find((position) => position.debtor_member_id === payer && position.creditor_member_id === receiver), [positions, payer, receiver]);
  const realizedOutstanding = Number(currentPosition?.realized_outstanding ?? 0);
  const memberName = (id: string) => householdMembers.find((member) => member.id === id)?.display_name ?? 'Membro';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !household) return;
    const normalizedAmount = normalizeAmount(amount);
    const numericAmount = Number(normalizedAmount);
    if (!payer || !receiver || payer === receiver) { setError('Escolha quem paga e quem recebe.'); return; }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Informe um valor maior que zero.'); return; }
    if (numericAmount > realizedOutstanding) { setError('O valor não pode superar a dívida realizada em aberto.'); return; }
    if (!sourceAccount || !destinationAccount) { setError('Informe de qual recurso sai e em qual recurso entra.'); return; }
    if (sourceAccount === destinationAccount) { setError('Origem e destino precisam ser recursos diferentes.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      await settleMemberPosition(supabase, { householdId: household.id, payerMemberId: payer, receiverMemberId: receiver, amount: normalizedAmount, sourceAccountId: sourceAccount, destinationAccountId: destinationAccount, notes });
      setSuccess('Acerto registrado como movimentação neutra. Nenhuma renda ou despesa nova foi criada.');
      setAmount(''); setNotes(''); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o acerto.'); }
    finally { setSaving(false); }
  };

  return <section className="space-y-5">
    <header><p className="text-xs font-bold uppercase tracking-widest text-blue-400">Ação global</p><h1 className="mt-1 text-2xl font-black">Novo acerto</h1><p className="mt-1 text-sm text-slate-400">Escolha o que aconteceu. O Casa mantém movimentação, renda, despesa e dívida como coisas diferentes.</p></header>
    {!selected && <div className="grid gap-3">{intentions.map(({ id, label, description, icon: Icon, ready }) => <button key={id} type="button" disabled={!ready} onClick={() => ready && setSelected(id)} className={`rounded-2xl border p-4 text-left ${ready ? 'border-blue-800 bg-blue-950/30' : 'border-slate-800 bg-slate-900 opacity-60'}`}><div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 text-blue-300"/><div><div className="flex flex-wrap items-center gap-2"><strong>{label}</strong>{!ready && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">Em preparação</span>}</div><p className="mt-1 text-sm text-slate-400">{description}</p></div></div></button>)}</div>}
    {selected === 'members' && <div className="space-y-4"><button type="button" onClick={() => setSelected(null)} className="text-sm font-semibold text-blue-300">← Voltar às intenções</button>{loading ? <LoaderCircle className="mx-auto h-6 w-6 animate-spin"/> : <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4"><div><h2 className="font-bold">Acerto entre nós</h2><p className="mt-1 text-sm text-slate-400">Só liquida uma posição realizada já existente. Não cria dívida inversa silenciosamente.</p></div><label className="block text-sm">Quem paga?<select value={payer} onChange={(event) => { setPayer(event.target.value); setReceiver(''); }} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{householdMembers.map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label><label className="block text-sm">Quem recebe?<select value={receiver} onChange={(event) => setReceiver(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{householdMembers.filter((member) => member.id !== payer).map((member) => <option key={member.id} value={member.id}>{member.display_name}</option>)}</select></label>{payer && receiver && <div className="rounded-xl bg-slate-950 p-3 text-sm"><span className="text-slate-400">Dívida realizada em aberto de {memberName(payer)} para {memberName(receiver)}:</span><strong className="ml-2 text-amber-200">{formatMoney(realizedOutstanding)}</strong></div>}<label className="block text-sm">Valor do acerto<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="0,00" /></label><label className="block text-sm">De qual recurso sai?<select value={sourceAccount} onChange={(event) => setSourceAccount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="block text-sm">Em qual recurso entra?<select value={destinationAccount} onChange={(event) => setDestinationAccount(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3"><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="block text-sm">Observação (opcional)<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" /></label>{error && <p role="alert" className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">{error}</p>}{success && <p role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/50 p-3 text-sm text-emerald-200">{success}</p>}<button type="submit" disabled={saving || realizedOutstanding <= 0} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold disabled:opacity-50"><Landmark className="h-4 w-4"/>{saving ? 'Registrando…' : 'Registrar acerto'}</button></form>}</div>}
  </section>;
}
