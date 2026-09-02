import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet,
  TrendingUp,
  Plus,
  ArrowUpRight,
  Briefcase,
  HandCoins,
  HeartHandshake,
  PiggyBank,
  Search,
  Filter,
  Calendar,
  Building2,
  Trash2,
  Check,
  X,
  Sparkles,
  ChevronRight,
  Info,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Plane,
  Layers,
  ArrowDownRight,
  Zap,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type {
  Account,
  Category,
  PaymentMethod,
  Transaction,
  User,
  ProtectedFund,
  ReserveDrainage,
  BeneficiaryType
} from '../../types/index.js';
import { ApiService } from '../../services/api.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { IOSBottomSheet } from '../common/IOSBottomSheet.js';

interface EntradasProps {
  householdId: string;
  currentUser: User;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  paymentMethods: PaymentMethod[];
  onRefresh: () => void;
}

type MemberFilter = 'all' | 'wallace' | 'guilherme' | 'both';
type TagFilter = 'all' | 'free' | 'protected' | 'salary' | 'help' | 'investments';

export const Entradas: React.FC<EntradasProps> = ({
  householdId,
  currentUser,
  accounts,
  categories,
  transactions,
  paymentMethods,
  onRefresh
}) => {
  // Protected funds and drainages state
  const [protectedFunds, setProtectedFunds] = useState<ProtectedFund[]>([]);
  const [reserveDrainages, setReserveDrainages] = useState<ReserveDrainage[]>([]);
  const [isLoadingFunds, setIsLoadingFunds] = useState(false);
  const [showDrainageHistory, setShowDrainageHistory] = useState(false);

  // Income transactions
  const incomeTransactions = useMemo(() => {
    return transactions.filter((t) => t.transaction_type === 'income');
  }, [transactions]);

  // Load protected funds & drainages from server
  const loadProtectedFundsData = async () => {
    try {
      setIsLoadingFunds(true);
      const [fundsRes, drainRes] = await Promise.all([
        ApiService.getProtectedFunds(householdId, currentUser.id),
        ApiService.getReserveDrainages(householdId, currentUser.id)
      ]);
      setProtectedFunds(fundsRes.funds || []);
      setReserveDrainages(drainRes.drainages || []);
    } catch (err) {
      console.error('Erro ao carregar fundos protegidos:', err);
    } finally {
      setIsLoadingFunds(false);
    }
  };

  useEffect(() => {
    loadProtectedFundsData();
  }, [householdId, currentUser.id]);

  // Income categories
  const incomeCategories = useMemo(() => {
    const list = categories.filter((c) => c.type === 'income');
    if (list.length > 0) return list;
    return [
      { id: 'cat-salario', name: 'Salário & Proventos', icon: 'briefcase', color: '#10b981', type: 'income', is_system: true, is_active: true, household_id: householdId, created_at: '' },
      { id: 'cat-emprestimo', name: 'Empréstimos & Adiantamentos', icon: 'hand-coins', color: '#0ea5e9', type: 'income', is_system: true, is_active: true, household_id: householdId, created_at: '' },
      { id: 'cat-ajuda-familiar', name: 'Doações & Ajudas Familiares', icon: 'heart-handshake', color: '#f59e0b', type: 'income', is_system: true, is_active: true, household_id: householdId, created_at: '' },
      { id: 'cat-rendimentos', name: 'Rendimentos & Reservas', icon: 'trending-up', color: '#8b5cf6', type: 'income', is_system: true, is_active: true, household_id: householdId, created_at: '' },
      { id: 'cat-outras-receitas', name: 'Outras Receitas', icon: 'wallet', color: '#64748b', type: 'income', is_system: true, is_active: true, household_id: householdId, created_at: '' }
    ];
  }, [categories, householdId]);

  // UI Filters
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<MemberFilter>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<TagFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDrainModalOpen, setIsDrainModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State: Nova Entrada
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(incomeCategories[0]?.id || 'cat-salario');
  const [beneficiary, setBeneficiary] = useState<'wallace' | 'guilherme' | 'both'>(
    currentUser.name?.toLowerCase().includes('guilherme') ? 'guilherme' : 'wallace'
  );
  // Protection Tag: 'free' (Livre para Gastos) vs 'protected' (Fundo Protegido)
  const [isProtectedChoice, setIsProtectedChoice] = useState<boolean>(false);
  const [selectedFundTag, setSelectedFundTag] = useState<'apartment' | 'vacation' | 'investments'>('apartment');
  const [notes, setNotes] = useState('');

  // Form State: Reclassificação / Resgate de Drenagem
  const [drainFundId, setDrainFundId] = useState<string>('fund-apartment');
  const [drainAmountStr, setDrainAmountStr] = useState('');
  const [drainReason, setDrainReason] = useState('');
  const [drainResponsible, setDrainResponsible] = useState<'wallace' | 'guilherme' | 'both'>('both');
  const [drainDestAccountId, setDrainDestAccountId] = useState<string>(accounts[0]?.id || '');

  // Auto-clear feedback
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  // Calculations
  const currentMonthStr = useMemo(() => new Date().toISOString().substring(0, 7), []);

  const totalMonthlyFreeIncome = useMemo(() => {
    const directFree = incomeTransactions
      .filter((t) => t.transaction_date.startsWith(currentMonthStr) && !t.is_protected_fund)
      .reduce((sum, t) => sum + (t.total_amount || 0), 0);

    const drainedFree = reserveDrainages
      .filter((d) => d.drainage_date.startsWith(currentMonthStr))
      .reduce((sum, d) => sum + (d.amount || 0), 0);

    return directFree + drainedFree;
  }, [incomeTransactions, reserveDrainages, currentMonthStr]);

  const totalProtectedFundsBalance = useMemo(() => {
    return protectedFunds.reduce((sum, f) => sum + (f.current_balance || 0), 0);
  }, [protectedFunds]);

  const totalDrainedThisMonth = useMemo(() => {
    return reserveDrainages
      .filter((d) => d.drainage_date.startsWith(currentMonthStr))
      .reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [reserveDrainages, currentMonthStr]);

  // Grouped Incomes for the Current Month
  const currentMonthIncomes = useMemo(() => {
    return incomeTransactions.filter((t) => t.transaction_date.startsWith(currentMonthStr));
  }, [incomeTransactions, currentMonthStr]);

  // Filtered List
  const filteredIncomes = useMemo(() => {
    return currentMonthIncomes.filter((tx) => {
      // Member Filter
      if (selectedMemberFilter !== 'all') {
        if (selectedMemberFilter === 'wallace' && tx.beneficiary_type !== 'wallace' && tx.buyer_user_id !== 'usr-wallace-001') return false;
        if (selectedMemberFilter === 'guilherme' && tx.beneficiary_type !== 'guilherme' && tx.buyer_user_id !== 'usr-guilherme-002') return false;
        if (selectedMemberFilter === 'both' && tx.beneficiary_type !== 'both') return false;
      }

      // Tag Filter
      if (selectedTagFilter !== 'all') {
        if (selectedTagFilter === 'free' && tx.is_protected_fund) return false;
        if (selectedTagFilter === 'protected' && !tx.is_protected_fund) return false;
        if (selectedTagFilter === 'salary') {
          const desc = (tx.description || '').toLowerCase();
          const cat = (tx.category_id || '').toLowerCase();
          if (!desc.includes('salário') && !cat.includes('salario')) return false;
        }
        if (selectedTagFilter === 'help') {
          const desc = (tx.description || '').toLowerCase();
          const cat = (tx.category_id || '').toLowerCase();
          if (!desc.includes('doação') && !desc.includes('ajuda') && !desc.includes('família') && !cat.includes('ajuda')) return false;
        }
        if (selectedTagFilter === 'investments') {
          const desc = (tx.description || '').toLowerCase();
          const cat = (tx.category_id || '').toLowerCase();
          if (!desc.includes('rendimento') && !desc.includes('cdi') && !desc.includes('reserva') && !cat.includes('rendimento')) return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = (tx.description || '').toLowerCase().includes(q);
        const matchMerchant = (tx.merchant || '').toLowerCase().includes(q);
        const matchNotes = (tx.notes || '').toLowerCase().includes(q);
        const matchFund = (tx.protected_fund_name || '').toLowerCase().includes(q);
        if (!matchDesc && !matchMerchant && !matchNotes && !matchFund) return false;
      }

      return true;
    });
  }, [currentMonthIncomes, selectedMemberFilter, selectedTagFilter, searchQuery]);

  // Grouped by Beneficiary
  const groupedIncomes = useMemo(() => {
    const wallaceList = filteredIncomes.filter(
      (t) => t.beneficiary_type === 'wallace' || (!t.beneficiary_type && t.buyer_user_id === 'usr-wallace-001')
    );
    const guilhermeList = filteredIncomes.filter(
      (t) => t.beneficiary_type === 'guilherme' || (!t.beneficiary_type && t.buyer_user_id === 'usr-guilherme-002')
    );
    const casalList = filteredIncomes.filter((t) => t.beneficiary_type === 'both' || t.beneficiary_type === 'custom');

    const wallaceTotal = wallaceList.reduce((sum, t) => sum + t.total_amount, 0);
    const guilhermeTotal = guilhermeList.reduce((sum, t) => sum + t.total_amount, 0);
    const casalTotal = casalList.reduce((sum, t) => sum + t.total_amount, 0);

    return {
      wallace: { list: wallaceList, total: wallaceTotal },
      guilherme: { list: guilhermeList, total: guilhermeTotal },
      casal: { list: casalList, total: casalTotal }
    };
  }, [filteredIncomes]);

  // Quick preset clicks for New Income Form
  const handlePresetSelect = (
    presetTitle: string,
    catId: string,
    defaultProtected: boolean,
    fundTag: 'apartment' | 'vacation' | 'investments' = 'apartment',
    targetBeneficiary?: 'wallace' | 'guilherme' | 'both'
  ) => {
    triggerHaptic('selection');
    setDescription(presetTitle);
    setSelectedCategoryId(catId);
    setIsProtectedChoice(defaultProtected);
    if (defaultProtected) {
      setSelectedFundTag(fundTag);
    }
    if (targetBeneficiary) {
      setBeneficiary(targetBeneficiary);
    }
  };

  // Submit Nova Entrada
  const handleCreateIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      triggerHaptic('warning');
      setFeedbackMessage({ type: 'error', text: 'Informe um valor válido maior que zero.' });
      return;
    }
    if (!description.trim()) {
      triggerHaptic('warning');
      setFeedbackMessage({ type: 'error', text: 'Informe uma descrição para a entrada.' });
      return;
    }

    try {
      setIsSubmitting(true);
      triggerHaptic('impact-medium');

      const targetAccount = accounts.find((a) => a.id === selectedAccountId);
      const payerUserId = beneficiary === 'guilherme' ? 'usr-guilherme-002' : 'usr-wallace-001';

      await ApiService.createTransaction(householdId, currentUser.id, {
        description: description.trim(),
        total_amount: val,
        transaction_type: 'income',
        payment_method_id: 'pm-pix',
        account_id: selectedAccountId || null,
        category_id: selectedCategoryId || null,
        buyer_user_id: payerUserId,
        payer_user_id: payerUserId,
        beneficiary_type: beneficiary,
        transaction_date: date,
        merchant: targetAccount?.institution || 'Recebimento em Conta',
        notes: notes.trim(),
        is_protected_fund: isProtectedChoice,
        protected_fund_tag: isProtectedChoice ? selectedFundTag : 'free',
        protected_fund_name: isProtectedChoice
          ? selectedFundTag === 'apartment'
            ? 'Fundo Apartamento'
            : selectedFundTag === 'vacation'
            ? 'Fundo Férias'
            : 'Investimentos & CDI'
          : undefined,
        splits: [
          {
            responsible_user_id: payerUserId,
            percentage: 100,
            amount: val
          }
        ]
      });

      triggerHaptic('success');
      setFeedbackMessage({
        type: 'success',
        text: isProtectedChoice
          ? `Entrada de R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} salva e blindada no Fundo Protegido!`
          : `Receita de R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} adicionada ao Saldo Livre do mês!`
      });

      // Reset form & reload
      setDescription('');
      setAmountStr('');
      setNotes('');
      setIsProtectedChoice(false);
      setIsAddModalOpen(false);

      onRefresh();
      loadProtectedFundsData();
    } catch (err: any) {
      console.error(err);
      triggerHaptic('warning');
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao registrar entrada.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Reclassificação / Resgate de Drenagem
  const handleDrainReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(drainAmountStr.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      triggerHaptic('warning');
      setFeedbackMessage({ type: 'error', text: 'Informe um valor de resgate válido maior que zero.' });
      return;
    }
    if (!drainReason.trim()) {
      triggerHaptic('warning');
      setFeedbackMessage({ type: 'error', text: 'Informe o motivo da reclassificação/resgate.' });
      return;
    }

    const fund = protectedFunds.find((f) => f.id === drainFundId);
    if (fund && val > fund.current_balance) {
      triggerHaptic('warning');
      setFeedbackMessage({
        type: 'error',
        text: `Saldo insuficiente no ${fund.name}. Disponível: R$ ${fund.current_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      });
      return;
    }

    try {
      setIsSubmitting(true);
      triggerHaptic('impact-medium');

      await ApiService.drainProtectedFund(householdId, currentUser.id, {
        fund_id: drainFundId,
        amount: val,
        reason: drainReason.trim(),
        responsible_type: drainResponsible,
        destination_account_id: drainDestAccountId || null,
        drainage_date: new Date().toISOString().split('T')[0]
      });

      triggerHaptic('success');
      setFeedbackMessage({
        type: 'success',
        text: `Resgate de R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} reclassificado com sucesso para o Saldo Livre!`
      });

      setDrainAmountStr('');
      setDrainReason('');
      setIsDrainModalOpen(false);

      onRefresh();
      loadProtectedFundsData();
    } catch (err: any) {
      console.error(err);
      triggerHaptic('warning');
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao reclassificar reserva.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete / Refund Transaction
  const handleDeleteIncome = async (txId: string, desc: string) => {
    if (!window.confirm(`Deseja estornar/excluir a receita "${desc}"?`)) return;
    try {
      triggerHaptic('impact-medium');
      await ApiService.deleteTransaction(householdId, currentUser.id, txId);
      triggerHaptic('success');
      setFeedbackMessage({ type: 'success', text: 'Receita removida com sucesso.' });
      onRefresh();
      loadProtectedFundsData();
    } catch (err: any) {
      console.error(err);
      triggerHaptic('warning');
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao excluir receita.' });
    }
  };

  // Income Card Renderer
  const renderIncomeCard = (tx: Transaction) => {
    const isProtected = tx.is_protected_fund;
    const targetAcc = accounts.find((a) => a.id === tx.account_id);

    return (
      <div
        key={tx.id}
        className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700/90 shadow-md transition-all flex items-center justify-between group"
      >
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
              isProtected
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {isProtected ? <Shield className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white leading-tight">{tx.description}</span>
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-slate-400 flex-wrap">
              {targetAcc && (
                <span className="flex items-center gap-1 text-slate-300">
                  <Wallet className="w-3 h-3 text-slate-500" />
                  {targetAcc.name}
                </span>
              )}
              <span>•</span>
              <span>{tx.transaction_date}</span>
            </div>

            {/* DESTINATION / PROTECTION TAG */}
            <div className="pt-1">
              {isProtected ? (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-950/80 border border-blue-500/40 text-[10px] font-semibold text-blue-300">
                  <ShieldCheck className="w-3 h-3 text-blue-400" />
                  <span>Fundo Protegido: {tx.protected_fund_name || 'Reserva Blindada'}</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-semibold text-emerald-300">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Livre para Gastos do Mês</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <span className="text-sm sm:text-base font-black text-white block">
              + R$ {tx.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400">
              {tx.beneficiary_type === 'wallace'
                ? 'Wallace'
                : tx.beneficiary_type === 'guilherme'
                ? 'Guilherme'
                : 'Casal'}
            </span>
          </div>

          <button
            onClick={() => handleDeleteIncome(tx.id, tx.description)}
            className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-all"
            title="Estornar/Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-6 pb-28 text-slate-100">
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedbackMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 max-w-sm w-[90%] border ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
            } backdrop-blur-md`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <p className="text-xs font-semibold leading-relaxed">{feedbackMessage.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER PRINCIPAL */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Entradas</h1>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold tracking-wide border border-emerald-500/30">
              Receitas & Blindagem
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Proventos do casal, controle de reservas e rastreamento de drenagem
          </p>
        </div>

        <button
          onClick={() => {
            triggerHaptic('impact-light');
            setIsAddModalOpen(true);
          }}
          className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-semibold text-xs shadow-lg shadow-emerald-900/30 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Entrada</span>
        </button>
      </div>

      {/* SUMMARY BENTO METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1: Receita Livre do Mês */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-emerald-500/20 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Livre para Gastos (Mês)</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
              R$ {totalMonthlyFreeIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-500" /> Alimenta o Saldo Livre do Dashboard
            </p>
          </div>
        </div>

        {/* Card 2: Fundos Protegidos (Blindado) */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-blue-500/20 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Fundos Blindados</span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-blue-400 tracking-tight">
              R$ {totalProtectedFundsBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
              <Shield className="w-3 h-3 text-blue-400" /> Blindado contra gastos comuns
            </p>
          </div>
        </div>

        {/* Card 3: Drenagens / Resgates */}
        <div className="p-4 rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-900/40 border border-purple-500/20 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Drenagens do Mês</span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-purple-300 tracking-tight">
              R$ {totalDrainedThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
              <ArrowDownRight className="w-3 h-3 text-purple-400" /> Reclassificado para cobrir despesas
            </p>
          </div>
        </div>
      </div>

      {/* MÓDULO DE FUNDOS PROTEGIDOS & DRENAGEM (RECLASSIFICAÇÃO) */}
      <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Módulo de Fundos Protegidos</h2>
              <p className="text-[11px] text-slate-400">Reservas blindadas que não somam no saldo comum</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                triggerHaptic('selection');
                setShowDrainageHistory(!showDrainageHistory);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center space-x-1 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{showDrainageHistory ? 'Ocultar Resgates' : 'Histórico Resgates'}</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('impact-light');
                setIsDrainModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-900/30 flex items-center space-x-1.5 active:scale-95 transition-all"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ Resgatar / Drenar</span>
            </button>
          </div>
        </div>

        {/* BENTO CARDS DE CADA FUNDO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {protectedFunds.map((fund) => {
            const isApt = fund.id.includes('apartment') || fund.name.toLowerCase().includes('apartamento');
            const isVac = fund.id.includes('vacation') || fund.name.toLowerCase().includes('férias');
            const IconComp = isApt ? Building2 : isVac ? Plane : TrendingUp;
            const target = fund.target_amount || (isApt ? 100000 : isVac ? 15000 : 50000);
            const progress = Math.min(100, Math.round((fund.current_balance / target) * 100));

            return (
              <div
                key={fund.id}
                className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between space-y-2 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${fund.color}25`, color: fund.color }}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white leading-tight">{fund.name}</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">{progress}%</span>
                </div>

                <div>
                  <span className="text-base font-black text-white">
                    R$ {fund.current_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, backgroundColor: fund.color }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 block">
                    Meta: R$ {target.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* HISTÓRICO EXPANSÍVEL DE DRENAGENS */}
        <AnimatePresence>
          {showDrainageHistory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-2 border-t border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Registro Contábil de Resgates (Drenagens)</span>
                <span className="text-[11px] text-purple-400 font-medium">{reserveDrainages.length} eventos</span>
              </div>

              {reserveDrainages.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">Nenhum resgate de reserva registrado.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {reserveDrainages.map((drain) => (
                    <div
                      key={drain.id}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-white">{drain.fund_name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-medium">
                            {drain.user_name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">"{drain.reason}"</p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-purple-300">
                          - R$ {drain.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="block text-[10px] text-slate-500">{drain.drainage_date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FILTROS E CONTROLES DE RECEITAS */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Segmented Control: Beneficiário */}
          <div className="flex p-1 bg-slate-900 rounded-2xl border border-slate-800/80 max-w-sm">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'wallace', label: 'Wallace' },
              { id: 'guilherme', label: 'Guilherme' },
              { id: 'both', label: 'Casal' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedMemberFilter(tab.id as MemberFilter);
                }}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                  selectedMemberFilter === tab.id
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar entrada..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700"
            />
          </div>
        </div>

        {/* Tag Filters (Chips) */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'Todas as Entradas' },
            { id: 'free', label: '🟢 Livre para Gastos' },
            { id: 'protected', label: '🛡️ Fundos Protegidos' },
            { id: 'salary', label: '💼 Salários' },
            { id: 'help', label: '🤝 Doações/Ajudas' },
            { id: 'investments', label: '📈 Rendimentos' }
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => {
                triggerHaptic('selection');
                setSelectedTagFilter(chip.id as TagFilter);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                selectedTagFilter === chip.id
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* LISTA DAS RECEITAS AGRUPADAS POR BENEFICIÁRIO */}
      <div className="space-y-6">
        {/* GRUPO 1: WALLACE */}
        {(selectedMemberFilter === 'all' || selectedMemberFilter === 'wallace') && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <h3 className="text-sm font-bold text-white">Wallace</h3>
                <span className="text-xs text-slate-500">({groupedIncomes.wallace.list.length} entradas)</span>
              </div>
              <span className="text-sm font-bold text-blue-400">
                R$ {groupedIncomes.wallace.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {groupedIncomes.wallace.list.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center text-xs text-slate-500">
                Nenhuma entrada registrada para Wallace com os filtros atuais.
              </div>
            ) : (
              <div className="space-y-2">
                {groupedIncomes.wallace.list.map((tx) => renderIncomeCard(tx))}
              </div>
            )}
          </div>
        )}

        {/* GRUPO 2: GUILHERME */}
        {(selectedMemberFilter === 'all' || selectedMemberFilter === 'guilherme') && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <h3 className="text-sm font-bold text-white">Guilherme</h3>
                <span className="text-xs text-slate-500">({groupedIncomes.guilherme.list.length} entradas)</span>
              </div>
              <span className="text-sm font-bold text-purple-400">
                R$ {groupedIncomes.guilherme.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {groupedIncomes.guilherme.list.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center text-xs text-slate-500">
                Nenhuma entrada registrada para Guilherme com os filtros atuais.
              </div>
            ) : (
              <div className="space-y-2">
                {groupedIncomes.guilherme.list.map((tx) => renderIncomeCard(tx))}
              </div>
            )}
          </div>
        )}

        {/* GRUPO 3: CASAL / CONJUNTO */}
        {(selectedMemberFilter === 'all' || selectedMemberFilter === 'both') && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <h3 className="text-sm font-bold text-white">Casal (Conjunto)</h3>
                <span className="text-xs text-slate-500">({groupedIncomes.casal.list.length} entradas)</span>
              </div>
              <span className="text-sm font-bold text-emerald-400">
                R$ {groupedIncomes.casal.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {groupedIncomes.casal.list.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center text-xs text-slate-500">
                Nenhuma entrada conjunta registrada para o período.
              </div>
            ) : (
              <div className="space-y-2">
                {groupedIncomes.casal.list.map((tx) => renderIncomeCard(tx))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* MODAL 1: NOVA ENTRADA (iOS BOTTOM SHEET) */}
      {/* =================================================================== */}
      <IOSBottomSheet
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Nova Entrada (Receita)"
      >
        <form onSubmit={handleCreateIncome} className="space-y-4 p-1">
          {/* Quick Presets (1-Toque) */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sugestões Rápidas</span>
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => handlePresetSelect('Salário CLT (Tech Solutions)', 'cat-salario', false, 'apartment', 'wallace')}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 whitespace-nowrap"
              >
                💼 Salário Wallace
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect('Salário PJ (Design Studio)', 'cat-salario', false, 'apartment', 'guilherme')}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 whitespace-nowrap"
              >
                💼 Salário Guilherme
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect('PLR Anual', 'cat-salario', true, 'apartment', 'wallace')}
                className="px-2.5 py-1 rounded-xl bg-blue-950 hover:bg-blue-900 text-[11px] font-semibold text-blue-300 border border-blue-700 whitespace-nowrap"
              >
                🛡️ PLR (Fundo Apto)
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect('Doação Pai do Guilherme', 'cat-ajuda-familiar', true, 'vacation', 'guilherme')}
                className="px-2.5 py-1 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-[11px] font-semibold text-emerald-300 border border-emerald-700 whitespace-nowrap"
              >
                🛡️ Doação Familiar (Férias)
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect('Férias Vendidas', 'cat-salario', false, 'apartment', 'wallace')}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 whitespace-nowrap"
              >
                🌴 Férias Vendidas
              </button>
            </div>
          </div>

          {/* Campo Valor (R$) */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Valor da Receita (R$)*</label>
            <div className="relative mt-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-slate-400">R$</span>
              <input
                type="text"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0,00"
                className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-xl font-black text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Campo Descrição */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Descrição / Origem*</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Salário Mensal, PLR, Doação, Rendimento"
              className="w-full px-3.5 py-2.5 mt-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Beneficiário: Wallace | Guilherme | Casal */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Beneficiário*</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[
                { id: 'wallace', label: 'Wallace', color: 'border-blue-500 bg-blue-500/10 text-blue-300' },
                { id: 'guilherme', label: 'Guilherme', color: 'border-purple-500 bg-purple-500/10 text-purple-300' },
                { id: 'both', label: 'Casal', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-300' }
              ].map((b) => (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => {
                    triggerHaptic('selection');
                    setBeneficiary(b.id as any);
                  }}
                  className={`py-2 px-3 rounded-2xl text-xs font-bold border transition-all ${
                    beneficiary === b.id ? b.color : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conta de Destino */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Conta de Depósito / Meio*</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-3.5 py-2.5 mt-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} (Saldo: R$ {acc.current_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                </option>
              ))}
            </select>
          </div>

          {/* ======================================================= */}
          {/* TAG DE DESTINO / PROTEÇÃO (LIVRE VS FUNDO PROTEGIDO) */}
          {/* ======================================================= */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <span className="text-xs font-bold text-slate-200">Tag de Destino & Blindagem</span>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setIsProtectedChoice(false);
                }}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between space-y-1 transition-all ${
                  !isProtectedChoice
                    ? 'border-emerald-500 bg-emerald-950/40 text-white'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">🟢 Livre para Gastos</span>
                  {!isProtectedChoice && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[10px] text-slate-400">Alimenta o fluxo comum do mês e o Saldo Livre</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setIsProtectedChoice(true);
                }}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between space-y-1 transition-all ${
                  isProtectedChoice
                    ? 'border-blue-500 bg-blue-950/40 text-white'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">🛡️ Fundo Protegido</span>
                  {isProtectedChoice && <Shield className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <p className="text-[10px] text-slate-400">Blindado contra gastos comuns da casa</p>
              </button>
            </div>

            {/* SELETOR DO FUNDO PROTEGIDO */}
            {isProtectedChoice && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-2 space-y-1.5"
              >
                <label className="text-[11px] font-semibold text-blue-300">Escolha o Fundo de Reserva:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'apartment', label: 'Apartamento', icon: Building2 },
                    { id: 'vacation', label: 'Férias', icon: Plane },
                    { id: 'investments', label: 'Investimentos', icon: TrendingUp }
                  ].map((f) => {
                    const FundIcon = f.icon;
                    return (
                      <button
                        type="button"
                        key={f.id}
                        onClick={() => {
                          triggerHaptic('selection');
                          setSelectedFundTag(f.id as any);
                        }}
                        className={`py-2 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-center space-x-1 transition-all ${
                          selectedFundTag === f.id
                            ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                            : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <FundIcon className="w-3.5 h-3.5" />
                        <span>{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>

          {/* Data & Categoria */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-slate-300">Data da Receita</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 mt-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Categoria</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full px-3 py-2 mt-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-medium text-white focus:outline-none focus:border-emerald-500"
              >
                {incomeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botão Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-emerald-900/40 active:scale-98 transition-all flex items-center justify-center space-x-2 mt-2"
          >
            {isSubmitting ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Salvar Entrada</span>
              </>
            )}
          </button>
        </form>
      </IOSBottomSheet>

      {/* =================================================================== */}
      {/* MODAL 2: RECLASSIFICAÇÃO / RESGATE DE DRENAGEM (iOS BOTTOM SHEET) */}
      {/* =================================================================== */}
      <IOSBottomSheet
        isOpen={isDrainModalOpen}
        onClose={() => setIsDrainModalOpen(false)}
        title="Reclassificação de Reserva (Drenagem)"
      >
        <form onSubmit={handleDrainReserve} className="space-y-4 p-1">
          {/* Card explicativo */}
          <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-start space-x-3">
            <Zap className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <p className="text-xs text-purple-200 leading-relaxed">
              Use este recurso quando precisar resgatar dinheiro de um <strong>Fundo Protegido</strong> para cobrir o mês. O valor sairá da reserva e será <strong>somado ao Saldo Livre Disponível</strong>.
            </p>
          </div>

          {/* Fundo de Origem */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Fundo de Origem (Reserva)*</label>
            <select
              value={drainFundId}
              onChange={(e) => setDrainFundId(e.target.value)}
              className="w-full px-3.5 py-2.5 mt-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-medium text-white focus:outline-none focus:border-purple-500"
            >
              {protectedFunds.map((fund) => (
                <option key={fund.id} value={fund.id}>
                  {fund.name} — Saldo Blindado: R$ {fund.current_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </option>
              ))}
            </select>
          </div>

          {/* Valor a Resgatar (R$) */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Valor a Reclassificar / Drenar (R$)*</label>
            <div className="relative mt-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-black text-purple-400">R$</span>
              <input
                type="text"
                required
                value={drainAmountStr}
                onChange={(e) => setDrainAmountStr(e.target.value)}
                placeholder="0,00"
                className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-xl font-black text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Presets Rápidos de Motivo */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Motivos Comuns</span>
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                'Cobrir estouro no cartão',
                'Manutenção imprevista da casa',
                'Emergência de saúde',
                'Oportunidade pontual de viagem'
              ].map((reasonPreset) => (
                <button
                  type="button"
                  key={reasonPreset}
                  onClick={() => {
                    triggerHaptic('selection');
                    setDrainReason(reasonPreset);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 border border-slate-700 whitespace-nowrap"
                >
                  {reasonPreset}
                </button>
              ))}
            </div>
          </div>

          {/* Campo Motivo */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Motivo / Justificativa do Resgate*</label>
            <input
              type="text"
              required
              value={drainReason}
              onChange={(e) => setDrainReason(e.target.value)}
              placeholder="Ex: Cobrir gastos excedentes da fatura de Maio"
              className="w-full px-3.5 py-2.5 mt-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Responsável pelo Resgate */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Responsável pelo Resgate*</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {[
                { id: 'wallace', label: 'Wallace' },
                { id: 'guilherme', label: 'Guilherme' },
                { id: 'both', label: 'Casal' }
              ].map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => {
                    triggerHaptic('selection');
                    setDrainResponsible(r.id as any);
                  }}
                  className={`py-2 px-3 rounded-2xl text-xs font-bold border transition-all ${
                    drainResponsible === r.id
                      ? 'border-purple-500 bg-purple-600 text-white shadow-sm'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conta de Destino / Aplicação */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Conta de Destino / Depósito</label>
            <select
              value={drainDestAccountId}
              onChange={(e) => setDrainDestAccountId(e.target.value)}
              className="w-full px-3.5 py-2.5 mt-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-medium text-white focus:outline-none focus:border-purple-500"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botão Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-bold text-sm shadow-xl shadow-purple-900/40 active:scale-98 transition-all flex items-center justify-center space-x-2 mt-2"
          >
            {isSubmitting ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Confirmar Reclassificação de Reserva</span>
              </>
            )}
          </button>
        </form>
      </IOSBottomSheet>
    </div>
  );
};
