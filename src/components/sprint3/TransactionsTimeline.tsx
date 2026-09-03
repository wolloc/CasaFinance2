import React, { useState, useEffect, useMemo } from 'react';
import type {
  Transaction,
  Account,
  Card,
  Category,
  PaymentMethod,
  BeneficiaryType
} from '../../types/index.js';
import { ApiService } from '../../services/api.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { IOSBottomSheet } from '../common/IOSBottomSheet.js';
import { SimplifiedFilterBar } from '../common/SimplifiedFilterBar.js';
import { EditOccurrenceModal } from './EditOccurrenceModal.js';
import {
  Search,
  CreditCard,
  Building2,
  UtensilsCrossed,
  ArrowRightLeft,
  Calendar,
  Trash2,
  RotateCcw,
  ShoppingBag,
  Plus,
  Repeat,
  X,
  CheckCircle2,
  User,
  Users,
  Scale,
  Pencil,
  Clock,
  XCircle
} from 'lucide-react';

export interface UnifiedTimelineItem {
  id: string;
  source: 'transaction' | 'recurring_bill_occurrence';
  date: string; // YYYY-MM-DD
  title: string;
  merchant?: string;
  amount: number;
  type: 'expense' | 'income';
  status: 'completed' | 'pending' | 'cancelled';
  isRecurring: boolean;
  categoryName: string;
  categoryColor: string;
  categoryId?: string | null;
  paymentMethodId?: string;
  cardId?: string;
  accountId?: string;
  paymentMethodName: string;
  cardOrAccountName: string;
  buyerName: string;
  buyerId: string;
  payerName: string;
  payerId: string;
  beneficiaryType: BeneficiaryType;
  splits: Array<{
    userId: string;
    userName: string;
    percentage: number;
    amount: number;
  }>;
  rawTransaction?: Transaction;
  rawOccurrence?: any;
}

interface Props {
  transactions: Transaction[];
  onOpenNewModal: () => void;
  onRefresh: () => void;
  householdId?: string;
  userId?: string;
  accounts?: Account[];
  cards?: Card[];
  categories?: Category[];
  paymentMethods?: PaymentMethod[];
  selectedMonth?: string;
  onMonthChange?: (month: string) => void;
  selectedResponsible?: 'all' | 'wallace' | 'guilherme';
  onResponsibleChange?: (resp: 'all' | 'wallace' | 'guilherme') => void;
  selectedCategory?: string;
  onCategoryChange?: (catId: string) => void;
}

export const TransactionsTimeline: React.FC<Props> = ({
  transactions,
  onOpenNewModal,
  onRefresh,
  householdId = 'hh-wallace-gui-001',
  userId = 'usr-wallace-001',
  accounts = [],
  cards = [],
  categories = [],
  paymentMethods = [],
  selectedMonth: propMonth,
  onMonthChange: propOnMonthChange,
  selectedResponsible: propResponsible,
  onResponsibleChange: propOnResponsibleChange,
  selectedCategory: propCategory,
  onCategoryChange: propOnCategoryChange
}) => {
  // Local state fallbacks if not supplied by global context
  const [localMonth, setLocalMonth] = useState<string>('2026-05');
  const [localResponsible, setLocalResponsible] = useState<'all' | 'wallace' | 'guilherme'>('all');
  const [localCategory, setLocalCategory] = useState<string>('all');

  const currentMonth = propMonth || localMonth;
  const handleMonthChange = (m: string) => {
    if (propOnMonthChange) propOnMonthChange(m);
    else setLocalMonth(m);
  };

  const currentResponsible = propResponsible || localResponsible;
  const handleResponsibleChange = (r: 'all' | 'wallace' | 'guilherme') => {
    if (propOnResponsibleChange) propOnResponsibleChange(r);
    else setLocalResponsible(r);
  };

  const currentCategory = propCategory || localCategory;
  const handleCategoryChange = (c: string) => {
    if (propOnCategoryChange) propOnCategoryChange(c);
    else setLocalCategory(c);
  };

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [isRecurringOnly, setIsRecurringOnly] = useState<boolean>(false);

  // Action states for selected transaction / occurrence detail
  const [selectedItem, setSelectedItem] = useState<UnifiedTimelineItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isRefunding, setIsRefunding] = useState<boolean>(false);
  const [refundReason, setRefundReason] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPayingOccurrence, setIsPayingOccurrence] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Fetch occurrences for the current active month
  const loadOccurrences = async (monthStr: string) => {
    try {
      const res = await ApiService.getBillOccurrences(householdId, userId, monthStr);
      setOccurrences(res.occurrences || []);
    } catch {
      setOccurrences([]);
    }
  };

  useEffect(() => {
    loadOccurrences(currentMonth);
  }, [currentMonth, householdId, userId]);

  // Unify standard transactions + recurring bill occurrences (FOCO EXCLUSIVO EM DESPESAS)
  const unifiedItems = useMemo<UnifiedTimelineItem[]>(() => {
    const list: UnifiedTimelineItem[] = [];

    // 1. Transactions - Exclusivo para despesas (saídas)
    transactions.forEach((tx) => {
      // Requisito estrito: Ignorar receitas nesta visão
      if (tx.transaction_type === 'income') return;

      const cat = categories.find((c) => c.id === tx.category_id);
      const card = cards.find((c) => c.id === tx.card_id);
      const acc = accounts.find((a) => a.id === tx.account_id);
      const pm = paymentMethods.find((p) => p.id === tx.payment_method_id);

      const splits = (tx.splits || []).map((s) => ({
        userId: s.user_id,
        userName: s.user_id === 'usr-wallace-001' ? 'Wallace' : 'Guilherme',
        percentage: s.percentage,
        amount: s.amount
      }));

      list.push({
        id: tx.id,
        source: 'transaction',
        date: tx.transaction_date,
        title: tx.description || tx.merchant || 'Despesa sem título',
        merchant: tx.merchant,
        amount: tx.total_amount,
        type: 'expense',
        status: tx.status,
        isRecurring: false,
        categoryName: cat?.name || 'Geral',
        categoryColor: cat?.color || '#64748b',
        categoryId: tx.category_id,
        paymentMethodId: tx.payment_method_id,
        paymentMethodName: pm?.name || (card ? 'Cartão' : acc ? 'Conta' : 'Outro'),
        cardOrAccountName: card?.name || acc?.name || 'Carteira',
        buyerName: tx.buyer_user_id === 'usr-wallace-001' ? 'Wallace' : 'Guilherme',
        buyerId: tx.buyer_user_id,
        payerName: tx.payer_user_id === 'usr-wallace-001' ? 'Wallace' : 'Guilherme',
        payerId: tx.payer_user_id,
        beneficiaryType: tx.beneficiary_type || 'both',
        splits,
        rawTransaction: tx
      });
    });

    // 2. Occurrences from recurring bills (Contas Fixas)
    occurrences.forEach((occ) => {
      const bill = occ.recurring_bill;
      if (!bill) return;

      const billDescription = occ.description || bill.description || occ.title || 'Conta Fixa';
      // A ocorrência só deixa a projeção quando está vinculada à transação que a quitou.
      // Comparar descrições pode esconder contas distintas com nomes semelhantes.
      const alreadyHasTx = Boolean(occ.paid_transaction_id);

      if (!alreadyHasTx) {
        const categoryId = occ.category_id ?? bill.category_id;
        const paymentMethodId = occ.payment_method_id ?? bill.payment_method_id;
        const cardId = occ.card_id ?? bill.card_id;
        const accountId = occ.account_id ?? bill.account_id;
        const payerId = occ.payer_user_id ?? bill.payer_user_id;
        const buyerId = occ.buyer_user_id ?? bill.buyer_user_id;
        const beneficiaryType = occ.beneficiary_type ?? bill.beneficiary_type ?? 'both';
        const cat = categories.find((c) => c.id === categoryId);
        const card = cards.find((c) => c.id === cardId);
        const acc = accounts.find((a) => a.id === accountId);
        const pm = paymentMethods.find((p) => p.id === paymentMethodId);
        const wallaceAmount = Number((occ.amount / 2).toFixed(2));
        const guilhermeAmount = Number((occ.amount - wallaceAmount).toFixed(2));

        list.push({
          id: occ.id,
          source: 'recurring_bill_occurrence',
          date: occ.due_date,
          title: billDescription,
          merchant: bill.merchant || billDescription,
          amount: occ.amount,
          type: 'expense',
          status: occ.status === 'paid' ? 'completed' : 'pending',
          isRecurring: true,
          categoryName: cat?.name || 'Contas Fixas',
          categoryColor: cat?.color || '#a855f7',
          categoryId,
          paymentMethodId,
          cardId: cardId || undefined,
          accountId: accountId || undefined,
          paymentMethodName: pm?.name || 'Recorrente',
          cardOrAccountName: card?.name || acc?.name || 'Conta Padrão',
          buyerName: buyerId === 'usr-wallace-001' ? 'Wallace' : 'Guilherme',
          buyerId,
          payerName: payerId === 'usr-wallace-001' ? 'Wallace' : 'Guilherme',
          payerId,
          beneficiaryType,
          splits: beneficiaryType === 'wallace' ? [{
            userId: 'usr-wallace-001', userName: 'Wallace', percentage: 100, amount: occ.amount
          }] : beneficiaryType === 'guilherme' ? [{
            userId: 'usr-guilherme-002', userName: 'Guilherme', percentage: 100, amount: occ.amount
          }] : [
            {
              userId: 'usr-wallace-001',
              userName: 'Wallace',
              percentage: 50,
              amount: wallaceAmount
            },
            {
              userId: 'usr-guilherme-002',
              userName: 'Guilherme',
              percentage: 50,
              amount: guilhermeAmount
            }
          ],
          rawOccurrence: occ
        });
      }
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, occurrences, categories, cards, accounts, paymentMethods, currentMonth]);

  // Filter items using simplified period, responsible, category, payment method, and recurring
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      // 1. Month Scope
      const itemMonth = item.date.substring(0, 7);
      if (itemMonth !== currentMonth) return false;

      // 2. Text Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchMerchant = item.merchant?.toLowerCase().includes(q) || false;
        const matchCat = item.categoryName.toLowerCase().includes(q);
        const matchCard = item.cardOrAccountName.toLowerCase().includes(q);
        const matchNotes = item.rawTransaction?.notes?.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchMerchant && !matchCat && !matchCard && !matchNotes) {
          return false;
        }
      }

      // 3. Quick Filter: Responsável ("Todos", "Wallace", "Guilherme")
      if (currentResponsible === 'wallace') {
        const isWallaceInvolved =
          item.beneficiaryType === 'wallace' ||
          item.buyerId === 'usr-wallace-001' ||
          item.payerId === 'usr-wallace-001' ||
          item.splits.some((s) => s.userId === 'usr-wallace-001' && s.percentage > 0);
        if (!isWallaceInvolved) return false;
      } else if (currentResponsible === 'guilherme') {
        const isGuiInvolved =
          item.beneficiaryType === 'guilherme' ||
          item.buyerId === 'usr-guilherme-002' ||
          item.payerId === 'usr-guilherme-002' ||
          item.splits.some((s) => s.userId === 'usr-guilherme-002' && s.percentage > 0);
        if (!isGuiInvolved) return false;
      }

      // 4. Quick Filter: Categoria
      if (currentCategory !== 'all') {
        if (item.categoryId !== currentCategory && item.categoryName.toLowerCase() !== currentCategory.toLowerCase()) {
          return false;
        }
      }

      // 5. Filtro de Contas Fixas
      if (isRecurringOnly && !item.isRecurring) {
        return false;
      }

      // 6. Filtro por Meio de Pagamento
      if (selectedPaymentMethod !== 'all') {
        if (item.paymentMethodId !== selectedPaymentMethod) {
          return false;
        }
      }

      return true;
    });
  }, [
    unifiedItems,
    searchTerm,
    currentResponsible,
    currentCategory,
    currentMonth,
    selectedPaymentMethod,
    isRecurringOnly
  ]);

  // Summary counts - Foco exclusivo em despesas
  const summary = useMemo(() => {
    let totalExpense = 0;
    filteredItems.forEach((it) => {
      if (it.status !== 'cancelled') {
        totalExpense += it.amount;
      }
    });
    return {
      totalExpense,
      count: filteredItems.length
    };
  }, [filteredItems]);

  const handleDelete = async (txId: string) => {
    triggerHaptic('warning');
    if (!confirm('Deseja realmente excluir este lançamento contábil?')) return;
    try {
      setDeletingId(txId);
      await ApiService.deleteTransaction(householdId, userId, txId);
      triggerHaptic('success');
      setIsDetailOpen(false);
      onRefresh();
    } catch (err: any) {
      triggerHaptic('error');
      alert(err.message || 'Erro ao excluir lançamento');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRefund = async (txId: string) => {
    triggerHaptic('warning');
    if (!confirm('Deseja estornar esta movimentação? O saldo da conta será revertido.')) return;
    try {
      setIsRefunding(true);
      await ApiService.refundTransaction(
        householdId,
        userId,
        txId,
        refundReason.trim() || 'Estorno solicitado pelo usuário via app'
      );
      triggerHaptic('success');
      setIsDetailOpen(false);
      setRefundReason('');
      onRefresh();
    } catch (err: any) {
      triggerHaptic('error');
      alert(err.message || 'Erro ao estornar transação');
    } finally {
      setIsRefunding(false);
    }
  };

  const handlePayOccurrence = async (occurrenceId: string) => {
    triggerHaptic('impact-medium');
    try {
      setIsPayingOccurrence(true);
      await ApiService.payBillOccurrence(householdId, userId, occurrenceId);
      triggerHaptic('success');
      setIsDetailOpen(false);
      await loadOccurrences(currentMonth);
      onRefresh();
    } catch (err: any) {
      triggerHaptic('error');
      alert(err.message || 'Erro ao registrar pagamento da conta');
    } finally {
      setIsPayingOccurrence(false);
    }
  };

  const handleMarkTransactionPaid = async (txId: string) => {
    triggerHaptic('impact-medium');
    try {
      setIsPayingOccurrence(true);
      await ApiService.updateTransaction(householdId, userId, txId, { status: 'completed' });
      triggerHaptic('success');
      setIsDetailOpen(false);
      onRefresh();
    } catch (err: any) {
      triggerHaptic('error');
      alert(err.message || 'Erro ao registrar pagamento do lançamento');
    } finally {
      setIsPayingOccurrence(false);
    }
  };

  const getMethodIcon = (pmId?: string, isRecurring?: boolean) => {
    if (isRecurring) return <Repeat className="w-4 h-4 text-purple-400" />;
    switch (pmId) {
      case 'pm-credit':
        return <CreditCard className="w-4 h-4 text-sky-400" />;
      case 'pm-va':
        return <UtensilsCrossed className="w-4 h-4 text-emerald-400" />;
      case 'pm-pix':
        return <ArrowRightLeft className="w-4 h-4 text-amber-400" />;
      case 'pm-debit':
        return <Building2 className="w-4 h-4 text-blue-400" />;
      default:
        return <ShoppingBag className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div id="transactions-timeline-container" className="space-y-3.5 sm:space-y-4">
      {/* 1. SELETOR DE PERÍODO & FILTROS RÁPIDOS SIMPLIFICADOS (Mês com < > e v, Resp, Categoria, Meio de Pagamento, Contas Fixas) */}
      <SimplifiedFilterBar
        selectedMonth={currentMonth}
        onMonthChange={handleMonthChange}
        selectedResponsible={currentResponsible}
        onResponsibleChange={handleResponsibleChange}
        selectedCategory={currentCategory}
        onCategoryChange={handleCategoryChange}
        categories={categories}
        selectedPaymentMethod={selectedPaymentMethod}
        onPaymentMethodChange={setSelectedPaymentMethod}
        isRecurringOnly={isRecurringOnly}
        onToggleRecurringOnly={() => setIsRecurringOnly((prev) => !prev)}
        onRefresh={onRefresh}
      />

      {/* 2. BARRA DE BUSCA TEXTUAL E BOTÃO + NOVA DESPESA (SEM MODAL ESCONDIDO DE FILTROS) */}
      <div className="bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-md space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Campo de Busca Textual */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar despesa por descrição, estabelecimento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8.5 pr-8 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 min-h-touch"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                title="Limpar busca"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Botão Superior + Nova despesa */}
          <button
            id="btn-add-tx-timeline"
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              onOpenNewModal();
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm min-h-touch cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nova despesa</span>
          </button>
        </div>

        {/* Resumo Dinâmico dos Itens Filtrados (Apenas Despesas) */}
        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px]">
            <strong className="text-white font-bold">{summary.count}</strong> despesas
          </span>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-medium">Total:</span>
            <span className="font-black text-rose-400">
              - R$ {summary.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* 3. LISTAGEM REORGANIZADA DE LANÇAMENTOS COM BADGES CLARAS */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/60 rounded-3xl border border-slate-800 space-y-2">
            <ShoppingBag className="w-8 h-8 text-slate-600 mx-auto opacity-40" />
            <h3 className="text-xs font-bold text-slate-300">Nenhum lançamento encontrado</h3>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              {searchTerm || currentResponsible !== 'all' || currentCategory !== 'all'
                ? 'Nenhum resultado corresponde aos filtros ativos.'
                : 'Toque em "+ Novo" para cadastrar uma despesa ou receita.'}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isIncome = item.type === 'income';
            const isCancelled = item.status === 'cancelled';
            const isPendingOccurrence = item.source === 'recurring_bill_occurrence' && item.status === 'pending';

            // Responsabilidade simplificada para as badges
            const wallaceSplit = item.splits.find((s) => s.userId === 'usr-wallace-001');
            const guiSplit = item.splits.find((s) => s.userId === 'usr-guilherme-002');

            const isWallaceOnly =
              item.beneficiaryType === 'wallace' || (wallaceSplit && wallaceSplit.percentage === 100);
            const isGuiOnly =
              item.beneficiaryType === 'guilherme' || (guiSplit && guiSplit.percentage === 100);
            const isBothFiftyFifty =
              item.beneficiaryType === 'both' ||
              (wallaceSplit && guiSplit && Math.abs(wallaceSplit.percentage - 50) < 1 && Math.abs(guiSplit.percentage - 50) < 1);

            return (
              <div
                key={`${item.source}-${item.id}`}
                onClick={() => {
                  triggerHaptic('impact-light');
                  setSelectedItem(item);
                  setIsDetailOpen(true);
                }}
                className={`p-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-850 active:scale-[0.99] border transition-all cursor-pointer shadow-sm space-y-2.5 ${
                  isCancelled
                    ? 'opacity-45 grayscale border-slate-800/60'
                    : isPendingOccurrence
                    ? 'border-amber-500/30 bg-amber-950/10'
                    : 'border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Linha Superior: Ícone + Título/Data + Valor */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                      style={{
                        backgroundColor: `${item.categoryColor}25`,
                        color: item.categoryColor
                      }}
                    >
                      {getMethodIcon(item.paymentMethodId, item.isRecurring)}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate max-w-[190px] sm:max-w-[280px]">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                        <span className="font-semibold text-slate-300">
                          {item.date.split('-').reverse().slice(0, 2).join('/')}
                        </span>
                        <span>•</span>
                        <span className="truncate text-slate-400">{item.categoryName}</span>
                        <span>•</span>
                        <span className="truncate text-slate-400 font-medium">{item.cardOrAccountName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Valor Total Formatado (Sempre Saída/Despesa) */}
                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-black tracking-tight block ${
                        isCancelled
                          ? 'line-through text-slate-500'
                          : 'text-white'
                      }`}
                    >
                      - R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {item.paymentMethodName}
                    </span>
                  </div>
                </div>

                {/* Linha Inferior: BADGES CONTEXTUAIS (Fixa, Status de Pagamento, Responsável) */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5 flex-wrap">
                  {/* Badges de Recorrência e Status */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.isRecurring && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        <Repeat className="w-2.5 h-2.5" />
                        Fixa
                      </span>
                    )}

                    {/* 2. BADGE DE STATUS DE PAGAMENTO */}
                    {isCancelled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                        <XCircle className="w-2.5 h-2.5" />
                        Estornado
                      </span>
                    ) : isPendingOccurrence || item.status === 'pending' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Clock className="w-2.5 h-2.5" />
                        Previsto
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Pago
                      </span>
                    )}
                  </div>

                  {/* 3. BADGE DE RESPONSÁVEL */}
                  <div className="flex items-center gap-1 font-bold">
                    {isWallaceOnly ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <User className="w-2.5 h-2.5" />
                        Wallace
                      </span>
                    ) : isGuiOnly ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        <User className="w-2.5 h-2.5" />
                        Guilherme
                      </span>
                    ) : isBothFiftyFifty ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        <Users className="w-2.5 h-2.5" />
                        Casal (50/50)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                        <Scale className="w-2.5 h-2.5" />
                        Proporcional
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. DETALHES DO LANÇAMENTO OU CONTA FIXA */}
      {selectedItem && (
        <IOSBottomSheet
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={selectedItem.title}
          subtitle={`Registrado em ${selectedItem.date.split('-').reverse().join('/')}`}
        >
          <div className="space-y-4 text-xs">
            {/* Bloco de Valor e Status */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Valor Total
                </span>
                <span
                  className={`text-xl font-black ${
                    selectedItem.status === 'cancelled'
                      ? 'line-through text-slate-500'
                      : selectedItem.type === 'income'
                      ? 'text-emerald-400'
                      : 'text-white'
                  }`}
                >
                  R$ {selectedItem.amount.toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Forma
                </span>
                <span className="text-xs font-bold text-slate-200">
                  {selectedItem.paymentMethodName}
                </span>
              </div>
            </div>

            {/* Divisão / Responsabilidades */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Divisão Contábil
              </span>
              <div className="grid grid-cols-2 gap-2">
                {selectedItem.splits.map((s) => (
                  <div
                    key={s.userId}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col"
                  >
                    <span className="text-[10px] font-bold text-slate-400">
                      {s.userName} ({s.percentage}%)
                    </span>
                    <span className="text-xs font-black text-white">
                      R$ {s.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ações: Pagar ocorrência pendente / Estornar / Excluir */}
            <div className="pt-2 space-y-2">
              {selectedItem.source === 'recurring_bill_occurrence' && selectedItem.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailOpen(false);
                    setIsEditing(true);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-touch cursor-pointer shadow-md"
                >
                  <Pencil className="w-4 h-4" />
                  <span>Ajustar esta Conta Fixa</span>
                </button>
              )}
              {selectedItem.source === 'recurring_bill_occurrence' && selectedItem.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => handlePayOccurrence(selectedItem.id)}
                  disabled={isPayingOccurrence}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-touch cursor-pointer shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isPayingOccurrence ? 'Registrando pagamento...' : 'Marcar Conta como Paga'}</span>
                </button>
              )}

              {selectedItem.source === 'transaction' && selectedItem.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => handleMarkTransactionPaid(selectedItem.id)}
                  disabled={isPayingOccurrence}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-touch cursor-pointer shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isPayingOccurrence ? 'Liquidando lançamento...' : 'Marcar Lançamento como Pago / Liquidado'}</span>
                </button>
              )}

              {selectedItem.source === 'transaction' && selectedItem.status !== 'cancelled' && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Motivo do estorno (opcional)..."
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none min-h-touch"
                  />
                  <button
                    type="button"
                    onClick={() => handleRefund(selectedItem.id)}
                    disabled={isRefunding}
                    className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-touch cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{isRefunding ? 'Estornando...' : 'Estornar Movimentação'}</span>
                  </button>
                </div>
              )}

              {selectedItem.source === 'transaction' && (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedItem.id)}
                  disabled={deletingId === selectedItem.id}
                  className="w-full py-3 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 font-bold text-xs flex items-center justify-center gap-2 transition-all min-h-touch cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>{deletingId === selectedItem.id ? 'Excluindo...' : 'Excluir Lançamento'}</span>
                </button>
              )}
            </div>
          </div>
        </IOSBottomSheet>
      )}

      <EditOccurrenceModal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        item={selectedItem}
        householdId={householdId}
        userId={userId}
        accounts={accounts}
        cards={cards}
        categories={categories}
        paymentMethods={paymentMethods}
        onSuccess={async () => {
          await loadOccurrences(currentMonth);
          onRefresh();
        }}
      />
    </div>
  );
};
