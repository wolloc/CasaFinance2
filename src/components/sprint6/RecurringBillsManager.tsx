import React, { useState, useEffect } from 'react';
import type { User, Account, Card, Category, PaymentMethod } from '../../types/index.js';
import { ApiService } from '../../services/api.js';
import {
  CalendarClock,
  Plus,
  CheckCircle2,
  Clock,
  TrendingDown,
  ChevronRight,
  ChevronLeft,
  Calendar,
  AlertCircle,
  RefreshCw,
  Layers,
  Sparkles,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  CreditCard,
  Building,
  Tag,
  Users,
  Repeat
} from 'lucide-react';

interface Props {
  householdId: string;
  currentUser: User;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
}

export const RecurringBillsManager: React.FC<Props> = ({
  householdId,
  currentUser,
  accounts,
  cards,
  categories,
  paymentMethods
}) => {
  const [subTab, setSubTab] = useState<'projection' | 'occurrences' | 'bills'>('projection');
  const [projectionRange, setProjectionRange] = useState<number>(6); // +1m, +3m, +6m, +12m
  const [projections, setProjections] = useState<any[]>([]);
  const [selectedMonthProjection, setSelectedMonthProjection] = useState<any | null>(null);

  const [currentMonth, setCurrentMonth] = useState<string>(
    new Date().toISOString().substring(0, 7)
  );
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [recurringBills, setRecurringBills] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New Bill Modal
  const [isNewBillOpen, setIsNewBillOpen] = useState<boolean>(false);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formMerchant, setFormMerchant] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDueDay, setFormDueDay] = useState<number>(10);
  const [formCategory, setFormCategory] = useState<string>(categories[0]?.id || '');
  const [formPaymentMethod, setFormPaymentMethod] = useState<string>('pm-pix');
  const [formAccount, setFormAccount] = useState<string>(accounts[0]?.id || '');
  const [formCard, setFormCard] = useState<string>(cards[0]?.id || '');
  const [formBeneficiary, setFormBeneficiary] = useState<'both' | 'wallace' | 'guilherme'>('both');
  const [formBuyer, setFormBuyer] = useState<string>(currentUser.id);
  const [formPayer, setFormPayer] = useState<string>(currentUser.id);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [projRes, occRes, billsRes] = await Promise.all([
        ApiService.getCommitmentsProjection(householdId, currentUser.id, 12),
        ApiService.getBillOccurrences(householdId, currentUser.id, currentMonth),
        ApiService.getRecurringBills(householdId, currentUser.id)
      ]);

      setProjections(projRes.projections);
      if (!selectedMonthProjection && projRes.projections.length > 0) {
        setSelectedMonthProjection(projRes.projections[0]);
      }
      setOccurrences(occRes.occurrences);
      setRecurringBills(billsRes.recurring_bills);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar módulo de contas fixas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [householdId, currentUser.id, currentMonth]);

  const handlePayOccurrence = async (occurrenceId: string) => {
    try {
      setIsActionLoading(true);
      await ApiService.payBillOccurrence(householdId, currentUser.id, occurrenceId);
      setSuccessMessage('Conta marcada como paga e debitada no razão com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar pagamento');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleBillActive = async (billId: string) => {
    try {
      await ApiService.toggleRecurringBillActive(householdId, currentUser.id, billId);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Falha ao alternar status da conta fixa');
    }
  };

  const handleDeleteBill = async (billId: string) => {
    if (!confirm('Deseja realmente remover esta conta recorrente?')) return;
    try {
      await ApiService.deleteRecurringBill(householdId, currentUser.id, billId);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Falha ao remover conta fixa');
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription || !formAmount || Number(formAmount) <= 0) {
      setError('Por favor preencha descrição e valor válido.');
      return;
    }

    try {
      setIsActionLoading(true);
      await ApiService.createRecurringBill(householdId, currentUser.id, {
        description: formDescription,
        merchant: formMerchant || undefined,
        expected_amount: parseFloat(formAmount),
        due_day: formDueDay,
        frequency: 'monthly',
        category_id: formCategory || undefined,
        payment_method_id: formPaymentMethod,
        account_id: formPaymentMethod === 'pm-credit' ? undefined : formAccount,
        card_id: formPaymentMethod === 'pm-credit' ? formCard : undefined,
        beneficiary_type: formBeneficiary,
        buyer_user_id: formBuyer,
        payer_user_id: formPayer,
        auto_generate: true
      });

      setIsNewBillOpen(false);
      setFormDescription('');
      setFormMerchant('');
      setFormAmount('');
      setSuccessMessage('Nova conta recorrente cadastrada com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar conta fixa');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Month navigation helper
  const changeMonth = (offset: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    const newMonthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(newMonthStr);
  };

  return (
    <div className="space-y-4">
      {/* 1. Header Banner */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-800/60 text-white shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">Sprint 6</span>
              <h2 className="text-sm font-black text-white">Contas Fixas & Projeção Futura</h2>
            </div>
          </div>
          <button
            onClick={() => setIsNewBillOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Conta
          </button>
        </div>

        {/* Sub-tabs switch */}
        <div className="grid grid-cols-3 gap-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800">
          <button
            onClick={() => setSubTab('projection')}
            className={`py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              subTab === 'projection'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Projeção
          </button>
          <button
            onClick={() => setSubTab('occurrences')}
            className={`py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              subTab === 'occurrences'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Ocorrências Mês
          </button>
          <button
            onClick={() => setSubTab('bills')}
            className={`py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
              subTab === 'bills'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Cadastro Fixo ({recurringBills.length})
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-2xl text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs underline font-bold">
            Fechar
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SUBTAB: PROJEÇÃO DE COMPROMETIMENTO (+1m, +3m, +6m, +12m) */}
      {/* ========================================================================= */}
      {subTab === 'projection' && (
        <div className="space-y-4">
          {/* Quick Filter Horizons */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 pl-2">
              Horizonte de Análise:
            </span>
            <div className="flex items-center gap-1">
              {[1, 3, 6, 12].map((range) => (
                <button
                  key={range}
                  onClick={() => setProjectionRange(range)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-extrabold transition-all ${
                    projectionRange === range
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  +{range}m
                </button>
              ))}
            </div>
          </div>

          {/* Projection Cards Horizontal Scroller / Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Comprometimento Mensal Consolidado
              </h3>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                Contas Fixas + Parcelas Cartão
              </span>
            </div>

            <div className="space-y-2">
              {projections.slice(0, projectionRange + 1).map((proj) => {
                const isSelected = selectedMonthProjection?.month_year === proj.month_year;
                return (
                  <div
                    key={proj.month_year}
                    onClick={() => setSelectedMonthProjection(proj)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {proj.label}
                          </span>
                          {proj.month_year === currentMonth && (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase">
                              Mês Atual
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <span>{proj.fixed_bills_count} contas fixas</span>
                          <span>•</span>
                          <span>{proj.installments_count} parcelas de cartão</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 dark:text-white block">
                          R$ {proj.total_committed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider">
                          Comprometido
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar of Composition */}
                    <div className="mt-2.5 space-y-1">
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                        <div
                          className="bg-indigo-600 h-full"
                          style={{
                            width: `${
                              proj.total_committed > 0
                                ? (proj.fixed_bills_total / proj.total_committed) * 100
                                : 0
                            }%`
                          }}
                          title={`Contas Fixas: R$ ${proj.fixed_bills_total}`}
                        ></div>
                        <div
                          className="bg-amber-500 h-full"
                          style={{
                            width: `${
                              proj.total_committed > 0
                                ? (proj.credit_installments_total / proj.total_committed) * 100
                                : 0
                            }%`
                          }}
                          title={`Parcelas Crédito: R$ ${proj.credit_installments_total}`}
                        ></div>
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                          Fixas: R$ {proj.fixed_bills_total.toFixed(2)}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          Parcelas: R$ {proj.credit_installments_total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Month Deep Dive */}
          {selectedMonthProjection && (
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Detalhes de {selectedMonthProjection.label}
                </h4>
                <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
                  Total: R$ {selectedMonthProjection.total_committed.toFixed(2)}
                </span>
              </div>

              {/* Fixed Bills List */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  1. Despesas Fixas Previstas ({selectedMonthProjection.details.fixed_bills.length})
                </span>
                {selectedMonthProjection.details.fixed_bills.map((b: any) => (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        {b.description}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Vencimento: {b.due_date} • {b.category}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      R$ {b.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Installments List */}
              {selectedMonthProjection.details.installments.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    2. Parcelas de Cartão Agendadas ({selectedMonthProjection.details.installments.length})
                  </span>
                  {selectedMonthProjection.details.installments.map((i: any) => (
                    <div
                      key={i.id}
                      className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-amber-950 dark:text-amber-200 block">
                          {i.description} ({i.installment_info})
                        </span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400">
                          {i.card_name} • Vencimento: {i.due_date}
                        </span>
                      </div>
                      <span className="text-xs font-extrabold text-amber-950 dark:text-amber-200">
                        R$ {i.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SUBTAB: OCORRÊNCIAS MENSAIS (BAIXA / PAGAMENTO) */}
      {/* ========================================================================= */}
      {subTab === 'occurrences' && (
        <div className="space-y-3">
          {/* Month Selector Controls */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <span className="text-xs font-black text-slate-900 dark:text-white block">
                Competência: {currentMonth}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {occurrences.filter((o) => o.status === 'paid').length} de {occurrences.length} pagas
              </span>
            </div>
            <button
              onClick={() => changeMonth(1)}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Occurrences List */}
          <div className="space-y-2">
            {occurrences.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
                <CalendarClock className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Nenhuma conta fixa agendada para este mês
                </p>
              </div>
            ) : (
              occurrences.map((occ) => {
                const isPaid = occ.status === 'paid';
                return (
                  <div
                    key={occ.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isPaid
                        ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-80'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: occ.category_color }}
                          ></span>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {occ.description}
                          </h4>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 space-x-1.5">
                          <span>Venc: <strong>{occ.due_date}</strong></span>
                          <span>•</span>
                          <span>Comprador: {occ.buyer_name}</span>
                          <span>•</span>
                          <span className="capitalize">
                            {occ.beneficiary_type === 'both' ? '🤝 50/50' : `👤 ${occ.beneficiary_type}`}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-slate-900 dark:text-white block">
                          R$ {occ.amount.toFixed(2)}
                        </span>
                        {isPaid ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold flex items-center gap-0.5 justify-end">
                            <Check className="w-2.5 h-2.5" /> Pago
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePayOccurrence(occ.id)}
                            disabled={isActionLoading}
                            className="mt-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm active:scale-95 transition-all"
                          >
                            <Check className="w-3 h-3" /> Pagar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SUBTAB: CADASTRO DE CONTAS FIXAS */}
      {/* ========================================================================= */}
      {subTab === 'bills' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              Contas Recorrentes Cadastradas
            </h3>
            <button
              onClick={() => setIsNewBillOpen(true)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>

          <div className="space-y-2">
            {recurringBills.map((bill) => (
              <div
                key={bill.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: bill.category_color }}
                    ></span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {bill.description}
                    </h4>
                    {!bill.is_active && (
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-500 text-[9px] font-bold">
                        Pausada
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 space-x-1.5">
                    <span>Todo dia <strong>{bill.due_day}</strong></span>
                    <span>•</span>
                    <span>{bill.category_name}</span>
                    <span>•</span>
                    <span>{bill.payment_method_id.replace('pm-', '').toUpperCase()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    R$ {bill.expected_amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleToggleBillActive(bill.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-200"
                    title={bill.is_active ? 'Pausar' : 'Ativar'}
                  >
                    <Repeat className={`w-3.5 h-3.5 ${bill.is_active ? 'text-indigo-500' : 'text-slate-600'}`} />
                  </button>
                  <button
                    onClick={() => handleDeleteBill(bill.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-500"
                    title="Excluir"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: NOVA CONTA FIXA RECORRENTE */}
      {/* ========================================================================= */}
      {isNewBillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Repeat className="w-4 h-4 text-indigo-600" /> Cadastrar Conta Fixa
              </h3>
              <button
                onClick={() => setIsNewBillOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBill} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Descrição (ex: Aluguel, Internet, Academia)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome da despesa fixa"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Valor Previsto (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Dia Vencimento (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={formDueDay}
                    onChange={(e) => setFormDueDay(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Categoria
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Divisão de Responsabilidade
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFormBeneficiary('both')}
                    className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                      formBeneficiary === 'both'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent'
                    }`}
                  >
                    🤝 50/50
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormBeneficiary('wallace')}
                    className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                      formBeneficiary === 'wallace'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent'
                    }`}
                  >
                    👤 Só Wallace
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormBeneficiary('guilherme')}
                    className={`py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                      formBeneficiary === 'guilherme'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent'
                    }`}
                  >
                    👤 Só Gui
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewBillOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> Salvar Conta Fixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
