import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap,
  CreditCard,
  Building2,
  UtensilsCrossed,
  Banknote,
  Sparkles,
  Check,
  AlertCircle,
  User,
  Users,
  Sliders,
  ChevronDown,
  Repeat,
  Clock
} from 'lucide-react';
import type { Account, Card, Category, PaymentMethod, User as UserType, BeneficiaryType } from '../../types/index.js';
import { ApiService } from '../../services/api.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { IOSBottomSheet } from './IOSBottomSheet.js';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  householdId: string;
  currentUser: UserType;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
}

interface FastPreset {
  label: string;
  icon: string;
  categoryName: string;
  paymentMethodCode: string;
  defaultBeneficiary: BeneficiaryType;
}

const FAST_PRESETS: FastPreset[] = [
  { label: 'Supermercado', icon: '🛒', categoryName: 'Mercado', paymentMethodCode: 'pm-credit', defaultBeneficiary: 'both' },
  { label: 'Almoço VA', icon: '🥗', categoryName: 'Alimentação', paymentMethodCode: 'pm-va', defaultBeneficiary: 'wallace' },
  { label: 'Jantar Casal', icon: '🍷', categoryName: 'Alimentação', paymentMethodCode: 'pm-credit', defaultBeneficiary: 'both' },
  { label: 'Uber / Transporte', icon: '🚗', categoryName: 'Transporte', paymentMethodCode: 'pm-credit', defaultBeneficiary: 'both' },
  { label: 'Farmácia', icon: '💊', categoryName: 'Saúde', paymentMethodCode: 'pm-pix', defaultBeneficiary: 'both' },
  { label: 'Luz / Internet', icon: '⚡', categoryName: 'Casa', paymentMethodCode: 'pm-pix', defaultBeneficiary: 'both' }
];

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  householdId,
  currentUser,
  accounts,
  cards,
  categories,
  paymentMethods
}) => {
  const [amountStr, setAmountStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('pm-credit');
  const [cardId, setCardId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [payerUserId, setPayerUserId] = useState<string>(currentUser.id);
  const [buyerUserId, setBuyerUserId] = useState<string>(currentUser.id);
  const [beneficiaryType, setBeneficiaryType] = useState<BeneficiaryType>('both');
  const [customWallacePct, setCustomWallacePct] = useState<number>(50);
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [dueDay, setDueDay] = useState<number>(10);
  const [projectionMonths, setProjectionMonths] = useState<number>(12);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize defaults on open
  useEffect(() => {
    if (isOpen) {
      setAmountStr('');
      setDescription('');
      setMerchant('');
      setBeneficiaryType('both');
      setCustomWallacePct(50);
      setInstallmentsCount(1);
      setIsRecurring(false);
      setDueDay(10);
      setProjectionMonths(12);
      setPayerUserId(currentUser.id);
      setBuyerUserId(currentUser.id);
      setErrorMessage(null);

      // Default category
      const expenseCats = categories.filter((c) => c.type === 'expense');
      const defaultCat = expenseCats.find((c) => c.name.toLowerCase().includes('mercado')) || expenseCats[0];
      if (defaultCat) setCategoryId(defaultCat.id);

      // Default payment method & specific source
      setPaymentMethodId('pm-credit');
      const defaultCard = cards.find((c) => c.owner_user_id === currentUser.id) || cards[0];
      if (defaultCard) {
        setCardId(defaultCard.id);
        setPayerUserId(defaultCard.owner_user_id);
      }
      setAccountId('');

      // Auto-focus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, currentUser, cards, categories]);

  const numericAmount = parseFloat(amountStr.replace(',', '.')) || 0;

  // Add quick amount (+10, +20, +50, +100)
  const handleAddAmount = (addVal: number) => {
    triggerHaptic('impact-light');
    const current = parseFloat(amountStr.replace(',', '.')) || 0;
    const nextVal = (current + addVal).toFixed(2);
    setAmountStr(nextVal);
  };

  // Helper to filter accounts by type
  const checkingAccounts = accounts.filter(
    (a) => a.account_type === 'checking' || a.account_type === 'digital_wallet' || a.account_type === 'savings'
  );
  const mealAccounts = accounts.filter((a) => a.account_type === 'meal_benefit');
  const cashAccounts = accounts.filter((a) => a.account_type === 'cash');

  // Handle Payment Method Change
  const handlePaymentMethodChange = (methodId: string) => {
    triggerHaptic('selection');
    setPaymentMethodId(methodId);

    if (methodId === 'pm-credit') {
      const preferredCard = cards.find((c) => c.owner_user_id === payerUserId) || cards[0];
      if (preferredCard) {
        setCardId(preferredCard.id);
        setPayerUserId(preferredCard.owner_user_id);
      }
      setAccountId('');
    } else if (methodId === 'pm-va') {
      const vaAcc = mealAccounts.find((a) => a.owner_user_id === payerUserId) || mealAccounts[0] || accounts[0];
      if (vaAcc) {
        setAccountId(vaAcc.id);
        if (vaAcc.owner_user_id) setPayerUserId(vaAcc.owner_user_id);
      }
      setCardId('');
    } else if (methodId === 'pm-cash') {
      const cashAcc = cashAccounts.find((a) => a.owner_user_id === payerUserId) || cashAccounts[0] || accounts[0];
      if (cashAcc) {
        setAccountId(cashAcc.id);
        if (cashAcc.owner_user_id) setPayerUserId(cashAcc.owner_user_id);
      }
      setCardId('');
    } else {
      // Pix / Débito / Boleto
      const chkAcc = checkingAccounts.find((a) => a.owner_user_id === payerUserId) || checkingAccounts[0] || accounts[0];
      if (chkAcc) {
        setAccountId(chkAcc.id);
        if (chkAcc.owner_user_id) setPayerUserId(chkAcc.owner_user_id);
      }
      setCardId('');
    }
  };

  const handleToggleRecurring = () => {
    const nextValue = !isRecurring;
    triggerHaptic('selection');

    if (!nextValue) {
      setIsRecurring(false);
      return;
    }

    const fixaCategory = categories.find(
      (category) => category.name.toLowerCase() === 'fixa' || category.id === 'cat-fixa'
    ) || categories.find((category) => category.name.toLowerCase().includes('fixa'));

    if (!fixaCategory) {
      setErrorMessage('Cadastre ou ative a categoria "Fixa" antes de criar uma conta fixa.');
      return;
    }

    setErrorMessage(null);
    setIsRecurring(true);
    setInstallmentsCount(1);
    setCategoryId(fixaCategory.id);
    setBeneficiaryType('both');
    setCustomWallacePct(50);
    handlePaymentMethodChange('pm-pix');
  };

  // Apply preset with 1-tap
  const handleApplyPreset = (preset: FastPreset) => {
    triggerHaptic('selection');
    setDescription(preset.label);
    setBeneficiaryType(preset.defaultBeneficiary);

    const expenseCats = categories.filter((c) => c.type === 'expense');
    const cat = expenseCats.find((c) => c.name.toLowerCase().includes(preset.categoryName.toLowerCase()));
    if (cat) setCategoryId(cat.id);

    handlePaymentMethodChange(preset.paymentMethodCode);
  };

  // Calculate splits
  const getSplits = () => {
    let wallacePct = 50;
    let guilhermePct = 50;
    if (beneficiaryType === 'wallace') {
      wallacePct = 100;
      guilhermePct = 0;
    } else if (beneficiaryType === 'guilherme') {
      wallacePct = 0;
      guilhermePct = 100;
    } else if (beneficiaryType === 'custom') {
      wallacePct = customWallacePct;
      guilhermePct = 100 - customWallacePct;
    }

    const totalCents = Math.round(numericAmount * 100);
    const wallaceCents = Math.floor((totalCents * wallacePct) / 100);
    const guilhermeCents = Math.floor((totalCents * guilhermePct) / 100);
    const residueCents = totalCents - (wallaceCents + guilhermeCents);

    return [
      {
        responsible_user_id: 'usr-wallace-001',
        percentage: wallacePct,
        amount: Number(((wallaceCents + residueCents) / 100).toFixed(2))
      },
      {
        responsible_user_id: 'usr-guilherme-002',
        percentage: guilhermePct,
        amount: Number((guilhermeCents / 100).toFixed(2))
      }
    ];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      triggerHaptic('warning');
      setErrorMessage('Digite um valor maior que R$ 0,00');
      inputRef.current?.focus();
      return;
    }

    if (!categoryId) {
      triggerHaptic('warning');
      setErrorMessage('A seleção da Categoria é obrigatória');
      return;
    }

    if (!paymentMethodId) {
      triggerHaptic('warning');
      setErrorMessage('A seleção do Meio de Pagamento é obrigatória');
      return;
    }

    if (paymentMethodId === 'pm-credit' && !cardId) {
      triggerHaptic('warning');
      setErrorMessage('Selecione o Cartão de Crédito utilizado');
      return;
    }

    if (paymentMethodId !== 'pm-credit' && !accountId) {
      triggerHaptic('warning');
      setErrorMessage('Selecione a Conta / Carteira de saída utilizada');
      return;
    }

    const finalDesc = description.trim() || 'Despesa Rápida';

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (isRecurring) {
        await ApiService.createRecurringBill(householdId, currentUser.id, {
          description: finalDesc,
          merchant: merchant.trim() || finalDesc,
          expected_amount: numericAmount,
          due_day: dueDay,
          frequency: 'monthly',
          category_id: categoryId,
          payment_method_id: paymentMethodId,
          account_id: paymentMethodId !== 'pm-credit' ? accountId : undefined,
          card_id: paymentMethodId === 'pm-credit' ? cardId : undefined,
          buyer_user_id: buyerUserId,
          payer_user_id: payerUserId,
          beneficiary_type: beneficiaryType,
          wallace_percentage: beneficiaryType === 'custom' ? customWallacePct : undefined,
          auto_generate: true,
          projection_months: projectionMonths
        });
      } else {
        await ApiService.createTransaction(householdId, currentUser.id, {
          description: finalDesc,
          merchant: merchant.trim() || undefined,
          total_amount: numericAmount,
          transaction_type: 'expense',
          payment_method_id: paymentMethodId,
          account_id: paymentMethodId !== 'pm-credit' ? accountId : null,
          card_id: paymentMethodId === 'pm-credit' ? cardId : null,
          category_id: categoryId,
          buyer_user_id: buyerUserId,
          payer_user_id: payerUserId,
          beneficiary_type: beneficiaryType,
          transaction_date: new Date().toISOString().split('T')[0],
          installments_count: installmentsCount,
          splits: getSplits()
        });
      }

      triggerHaptic('success');
      onSuccess();
      onClose();
    } catch (err: any) {
      triggerHaptic('error');
      setErrorMessage(err.message || 'Erro ao lançar movimentação');
    } finally {
      setIsSubmitting(false);
    }
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const displayedCategories = expenseCategories;

  return (
    <IOSBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Lançamento Rápido"
      subtitle="Cadastre uma saída auditada com categoria e meio de pagamento"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-2xl flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* 1. Large Currency Display Input */}
        <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 flex flex-col items-center justify-center">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Valor da Saída (R$)
          </span>
          <div className="flex items-baseline justify-center gap-1.5 w-full">
            <span className="text-xl font-bold text-slate-500">R$</span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.,]/g, '');
                setAmountStr(val);
              }}
              className="text-4xl font-extrabold text-white text-center bg-transparent focus:outline-none w-full max-w-[240px] tracking-tight placeholder:text-slate-700"
            />
          </div>

          {/* Quick Increment Chips */}
          <div className="flex items-center gap-1.5 mt-3 flex-wrap justify-center">
            {[10, 20, 50, 100, 200].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleAddAmount(val)}
                className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold border border-slate-700 transition-all min-h-touch flex items-center justify-center"
              >
                +R${val}
              </button>
            ))}
            {amountStr && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setAmountStr('');
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 text-xs font-semibold border border-rose-800 transition-all min-h-touch"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* 2. Fast 1-Tap Presets */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Atalhos Rápidos de 1-Toque
          </label>
          <div className="grid grid-cols-3 gap-2">
            {FAST_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="p-2.5 rounded-2xl bg-slate-800/60 hover:bg-blue-900/30 hover:border-blue-500/50 border border-slate-700/80 flex flex-col items-center text-center gap-1 transition-all active:scale-95 min-h-touch"
              >
                <span className="text-xl">{p.icon}</span>
                <span className="text-[11px] font-semibold text-slate-200 line-clamp-1">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Description & Category (Mandatory) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Descrição do Gasto
            </label>
            <input
              type="text"
              placeholder="Ex: Supermercado Pão de Açúcar"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-blue-500 min-h-touch"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Categoria <span className="text-rose-400 font-bold">*Obrigatória</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                triggerHaptic('selection');
                setCategoryId(e.target.value);
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer"
              required
            >
              <option value="" disabled>Selecione uma Categoria...</option>
              {displayedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  🏷️ {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. Payment Method & Specific Source (Mandatory) */}
        <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Meio de Pagamento Real <span className="text-rose-400 font-bold">*Obrigatório</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Payment Method Selector */}
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 font-medium">Tipo de Saída</label>
              <select
                value={paymentMethodId}
                onChange={(e) => handlePaymentMethodChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer font-semibold"
                required
              >
                <option value="pm-credit">💳 Cartão de Crédito</option>
                <option value="pm-pix">⚡ Pix</option>
                <option value="pm-debit">🏦 Débito em Conta</option>
                <option value="pm-va">🥗 Vale-Alimentação / VR</option>
                <option value="pm-cash">💵 Dinheiro em Espécie</option>
              </select>
            </div>

            {/* Specific Source Selector */}
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 font-medium">
                {paymentMethodId === 'pm-credit' ? 'Cartão Específico' : 'Conta / Carteira de Origem'}
              </label>

              {paymentMethodId === 'pm-credit' ? (
                <select
                  value={cardId}
                  onChange={(e) => {
                    triggerHaptic('selection');
                    const selected = cards.find((c) => c.id === e.target.value);
                    setCardId(e.target.value);
                    if (selected) setPayerUserId(selected.owner_user_id);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-blue-500/50 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer font-semibold"
                  required
                >
                  <option value="" disabled>Selecione o Cartão...</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      💳 {c.name} ({c.institution}) - {c.owner_user_id === 'usr-wallace-001' ? 'Wallace' : 'Guilherme'}
                    </option>
                  ))}
                </select>
              ) : paymentMethodId === 'pm-va' ? (
                <select
                  value={accountId}
                  onChange={(e) => {
                    triggerHaptic('selection');
                    const selected = accounts.find((a) => a.id === e.target.value);
                    setAccountId(e.target.value);
                    if (selected?.owner_user_id) setPayerUserId(selected.owner_user_id);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-amber-500/50 text-white text-xs focus:outline-none focus:border-amber-500 min-h-touch cursor-pointer font-semibold"
                  required
                >
                  <option value="" disabled>Selecione o Vale...</option>
                  {mealAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      🥗 {a.name} (R$ {a.current_balance.toFixed(2)})
                    </option>
                  ))}
                  {mealAccounts.length === 0 && (
                    <option value="" disabled>Nenhum VA cadastrado em Ajustes</option>
                  )}
                </select>
              ) : paymentMethodId === 'pm-cash' ? (
                <select
                  value={accountId}
                  onChange={(e) => {
                    triggerHaptic('selection');
                    const selected = accounts.find((a) => a.id === e.target.value);
                    setAccountId(e.target.value);
                    if (selected?.owner_user_id) setPayerUserId(selected.owner_user_id);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-emerald-500/50 text-white text-xs focus:outline-none focus:border-emerald-500 min-h-touch cursor-pointer font-semibold"
                  required
                >
                  <option value="" disabled>Selecione a Carteira...</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      💵 {a.name} (R$ {a.current_balance.toFixed(2)})
                    </option>
                  ))}
                  {cashAccounts.length === 0 && (
                    <option value="" disabled>Nenhuma carteira física cadastrada</option>
                  )}
                </select>
              ) : (
                <select
                  value={accountId}
                  onChange={(e) => {
                    triggerHaptic('selection');
                    const selected = accounts.find((a) => a.id === e.target.value);
                    setAccountId(e.target.value);
                    if (selected?.owner_user_id) setPayerUserId(selected.owner_user_id);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer font-semibold"
                  required
                >
                  <option value="" disabled>Selecione a Conta...</option>
                  {checkingAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      🏦 {a.name} ({a.institution})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Módulo de Parcelamento (1x a 24x) para Cartão de Crédito */}
          {paymentMethodId === 'pm-credit' && !isRecurring && (
            <div className="p-3 bg-slate-950/90 rounded-2xl border border-blue-500/30 space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                  Parcelamento (1x a 24x)
                </span>
                <span className="text-xs font-black text-blue-400">
                  {installmentsCount}x de R${' '}
                  {(numericAmount > 0 ? numericAmount / installmentsCount : 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>

              {/* Botões rápidos */}
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setInstallmentsCount(num);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      installmentsCount === num
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {num}x
                  </button>
                ))}
              </div>

              {/* Select completo de 1x a 24x */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400">Parcelas específicas:</span>
                <select
                  value={installmentsCount}
                  onChange={(e) => {
                    triggerHaptic('selection');
                    setInstallmentsCount(Number(e.target.value));
                  }}
                  className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x {n === 1 ? '(à vista)' : `de R$ ${(numericAmount > 0 ? numericAmount / n : 0).toFixed(2)}/mês`}
                    </option>
                  ))}
                </select>
              </div>

              {installmentsCount > 1 && (
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                  <span>
                    Gera {installmentsCount} lançamentos fracionados (1/{installmentsCount} a {installmentsCount}/{installmentsCount}) nos meses seguintes.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Flag de Conta Fixa / Recorrente */}
          <div
            onClick={handleToggleRecurring}
            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between mt-2 ${
              isRecurring
                ? 'bg-purple-950/40 border-purple-500/40 text-white'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`p-1.5 rounded-xl flex items-center justify-center ${
                  isRecurring ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  Conta Fixa
                </span>
                <span className="text-[10px] text-slate-400">
                  {isRecurring
                    ? 'Projetada como status Previsto (não consome do saldo real até ser paga)'
                    : 'Marque para despesas que se repetem todo mês'}
                </span>
              </div>
            </div>
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                isRecurring
                  ? 'bg-purple-600 border-purple-500 text-white'
                  : 'border-slate-700 bg-slate-900'
              }`}
            >
              {isRecurring && <span className="text-xs font-black">✓</span>}
            </div>
          </div>

          {isRecurring && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <label className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold text-slate-200 block">Dia do Vencimento</span>
                <span className="text-[10px] text-slate-400 block mb-2">Dia limite de pagamento no mês</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(event) => setDueDay(Math.min(31, Math.max(1, Number(event.target.value) || 1)))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-purple-500"
                />
              </label>
              <label className="p-3 rounded-xl bg-slate-950 border border-purple-500/30">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Projetar por quantos meses?
                </span>
                <span className="text-[10px] text-slate-400 block mb-2">Gera ocorrências futuras na timeline</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={projectionMonths}
                  onChange={(event) => setProjectionMonths(Math.min(60, Math.max(1, Number(event.target.value) || 1)))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-purple-500/50 text-white text-xs font-bold focus:outline-none focus:border-purple-400"
                />
              </label>
            </div>
          )}
        </div>

        {/* 5. Division / Split Selector (4 Simple Buttons: 50/50, 100% Wallace, 100% Guilherme, Custom) */}
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Divisão de Responsabilidade
          </label>
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setBeneficiaryType('both');
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all min-h-touch ${
                beneficiaryType === 'both'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>50/50</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setBeneficiaryType('wallace');
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all min-h-touch ${
                beneficiaryType === 'wallace'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Wallace</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setBeneficiaryType('guilherme');
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all min-h-touch ${
                beneficiaryType === 'guilherme'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Guilherme</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setBeneficiaryType('custom');
              }}
              className={`py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all min-h-touch ${
                beneficiaryType === 'custom'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Custom</span>
            </button>
          </div>

          {/* Custom Split Slider */}
          {beneficiaryType === 'custom' && (
            <div className="mt-2 p-3 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-400">Wallace: {customWallacePct}% (R$ {((numericAmount * customWallacePct) / 100).toFixed(2)})</span>
                <span className="text-indigo-400">Guilherme: {100 - customWallacePct}% (R$ {((numericAmount * (100 - customWallacePct)) / 100).toFixed(2)})</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={customWallacePct}
                onChange={(e) => setCustomWallacePct(Number(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* 6. Instant Submit Button (Full Width iOS Action) */}
        <button
          type="submit"
          disabled={isSubmitting || numericAmount <= 0 || !categoryId}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white text-sm font-bold shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 min-h-touch mt-2 cursor-pointer"
        >
          <Zap className="w-4 h-4 fill-white" />
          {isSubmitting ? 'Registrando...' : 'Confirmar Lançamento Rápido'}
        </button>
      </form>
    </IOSBottomSheet>
  );
};
