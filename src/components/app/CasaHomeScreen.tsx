import { useEffect, useState } from 'react';
import { AlertTriangle, CircleGauge, CreditCard, Landmark, LoaderCircle, TrendingUp, UsersRound, WalletCards } from 'lucide-react';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { getFinancialDashboard } from '../../finance/financialDashboard.js';

const money = (value: number | string | null | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));
const monthLabel = (value: string) => new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
const healthText = { green: 'Saudável', yellow: 'Atenção', red: 'Crítico' } as const;
const healthClass = { green: 'text-emerald-300', yellow: 'text-amber-300', red: 'text-rose-300' } as const;

type Dashboard = Awaited<ReturnType<typeof getFinancialDashboard>>;

export function CasaHomeScreen() {
  const { household, householdMembers } = useSupabaseAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!supabase || !household) return;
    setLoading(true); setError(false);
    getFinancialDashboard(supabase, household.id).then(setDashboard).catch(() => setError(true)).finally(() => setLoading(false));
  }, [household?.id]);

  if (loading) return <LoaderCircle aria-label="Carregando posição financeira" className="mx-auto mt-16 h-7 w-7 animate-spin text-blue-400" />;
  if (error || !dashboard) return <p role="alert" className="rounded-2xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">Não foi possível carregar a posição financeira.</p>;

  const { household: position, health, confidence, attention, projection, cards, settlements, resources } = dashboard;
  const currentMonth = projection[0];
  const openSettlements = settlements.filter((item) => Number(item.realized_outstanding) > 0 || Number(item.projected_outstanding) > 0);
  const memberName = (id: string) => householdMembers.find((member) => member.id === id)?.display_name ?? 'Membro';

  return <div className="space-y-7">
    <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Nossa Casa</p><h1 className="mt-1 text-2xl font-black">{household?.name}</h1><p className="mt-1 text-sm text-slate-400">O que temos hoje, o que ainda está comprometido e como os próximos meses estão se formando.</p></header>

    <section aria-labelledby="como-estamos"><h2 id="como-estamos" className="mb-3 flex items-center gap-2 font-bold"><CircleGauge className="h-5 w-5 text-blue-400" />Como estamos?</h2><div className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-blue-100">Saldo atual</p><strong className="mt-1 block text-3xl font-black">{money(health?.current_cash ?? resources.availableCash)}</strong><p className="mt-1 text-xs text-blue-100/80">Somente dinheiro realizado disponível. Limites, reservas e valores a receber ficam fora.</p></div>{health && <span className={`rounded-full bg-black/20 px-3 py-1 text-xs font-bold ${healthClass[health.health]}`}>{healthText[health.health]}</span>}</div><div className="mt-5 border-t border-white/20 pt-4"><p className="text-sm text-blue-100">Deve sobrar <span className="text-xs">(projeção)</span></p><strong className="mt-1 block text-2xl">{money(health?.projected_ending_cash ?? position?.projected_balance)}</strong>{confidence && <p className="mt-2 text-xs text-blue-100/80">{confidence.confidence_label}</p>}</div></div></section>

    <section aria-labelledby="atencao"><h2 id="atencao" className="mb-3 flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5 text-amber-400" />Precisa de atenção</h2>{attention.length === 0 ? <p className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-4 text-sm text-emerald-200">Nenhuma situação acionável agora.</p> : <div className="space-y-2">{attention.map((item) => <article key={item.attention_key} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className={item.severity === 'red' ? 'font-semibold text-rose-200' : 'font-semibold text-amber-200'}>{item.title}</h3>{item.due_date && <p className="mt-1 text-xs text-slate-500">Data: {item.due_date}</p>}</div>{Number(item.amount) > 0 && <strong className="text-sm">{money(item.amount)}</strong>}</div></article>)}</div>}</section>

    <section aria-labelledby="este-mes"><h2 id="este-mes" className="mb-3 flex items-center gap-2 font-bold"><TrendingUp className="h-5 w-5 text-emerald-400" />Este mês</h2><div className="grid grid-cols-2 gap-3"><article className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Entrou</p><strong className="mt-2 block">{money(currentMonth?.realized_true_income_in_month)}</strong></article><article className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Ainda entra</p><strong className="mt-2 block">{money(currentMonth?.expected_reliable_income_remaining)}</strong></article><article className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Já comprometido/pago</p><strong className="mt-2 block">{money(currentMonth?.realized_commitments_in_month)}</strong></article><article className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Ainda compromete</p><strong className="mt-2 block">{money(Number(currentMonth?.remaining_commitments_in_month ?? 0) + Number(currentMonth?.projected_recurring_commitments ?? 0) + Number(currentMonth?.prior_pending_outflow ?? 0))}</strong></article></div></section>

    <section aria-labelledby="nosso-dinheiro"><h2 id="nosso-dinheiro" className="mb-3 flex items-center gap-2 font-bold"><WalletCards className="h-5 w-5 text-blue-400" />Nosso dinheiro</h2><div className="grid grid-cols-2 gap-3">{[['Contas + dinheiro físico', resources.availableCash], ['Benefícios', resources.benefits], ['Reservas', resources.reserves], ['Investimentos', resources.investments]].map(([label, value]) => <article key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">{label}</p><strong className="mt-2 block">{money(value as number)}</strong></article>)}</div><p className="mt-2 text-xs text-slate-500">Essas classes permanecem separadas: reserva, investimento e crédito não viram saldo disponível.</p></section>

    <section aria-labelledby="cartoes"><h2 id="cartoes" className="mb-3 flex items-center gap-2 font-bold"><CreditCard className="h-5 w-5 text-violet-400" />Cartões</h2>{cards.length === 0 ? <p className="text-sm text-slate-500">Nenhum cartão ativo.</p> : <div className="space-y-3">{cards.map((card) => <article key={card.card_id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex justify-between gap-3"><h3 className="font-bold">{card.card_name}</h3><span className={`text-xs font-bold ${healthClass[card.card_health]}`}>{healthText[card.card_health]}</span></div><p className="mt-2 flex justify-between text-sm text-slate-400"><span>Fatura atual restante</span><strong className="text-slate-200">{money(card.current_invoice_remaining)}</strong></p><p className="mt-2 flex justify-between text-sm text-slate-400"><span>Compromissos futuros</span><strong className="text-slate-200">{money(card.future_known_commitments)}</strong></p><p className="mt-2 flex justify-between text-sm text-slate-400"><span>Limite disponível calculado</span><strong className="text-slate-200">{money(card.available_limit)}</strong></p>{card.next_due_date && <p className="mt-2 text-xs text-slate-500">Próximo vencimento: {card.next_due_date}</p>}</article>)}</div>}</section>

    <section aria-labelledby="acertos"><h2 id="acertos" className="mb-3 flex items-center gap-2 font-bold"><UsersRound className="h-5 w-5 text-cyan-400" />Acertos</h2>{openSettlements.length === 0 ? <p className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">Nenhum acerto em aberto entre vocês.</p> : <div className="space-y-3">{openSettlements.map((item) => <article key={`${item.debtor_member_id}:${item.creditor_member_id}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h3 className="font-semibold">{memberName(item.debtor_member_id)} → {memberName(item.creditor_member_id)}</h3><p className="mt-2 flex justify-between text-sm text-slate-400"><span>Já realizado e em aberto</span><strong className="text-slate-200">{money(item.realized_outstanding)}</strong></p><p className="mt-2 flex justify-between text-sm text-slate-400"><span>Projetado</span><strong className="text-slate-200">{money(item.projected_outstanding)}</strong></p></article>)}</div>}</section>

    <section aria-labelledby="frente"><h2 id="frente" className="mb-3 flex items-center gap-2 font-bold"><Landmark className="h-5 w-5 text-emerald-400" />Olhando pra frente</h2><div className="space-y-3">{projection.map((month) => <article key={month.financial_month} className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center justify-between"><h3 className="font-bold capitalize">{monthLabel(month.financial_month)}</h3><strong className={Number(month.projected_ending_cash) < 0 ? 'text-rose-300' : 'text-emerald-300'}>{money(month.projected_ending_cash)}</strong></div><p className="mt-1 text-xs text-slate-500">Saldo projetado acumulado no fim do mês</p></article>)}</div></section>
  </div>;
}
