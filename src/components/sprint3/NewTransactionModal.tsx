import React, { useState, useEffect, useRef } from 'react';
import type { Account, Card, Category, PaymentMethod, User, BeneficiaryType } from '../../types/index.js';
import { ApiService } from '../../services/api.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { IOSBottomSheet } from '../common/IOSBottomSheet.js';
import {
  CreditCard,
  Building2,
  UtensilsCrossed,
  Banknote,
  Calendar,
  Sparkles,
  Zap,
  AlertCircle,
  Users,
  User as UserIcon,
  Repeat,
  Sliders,
  Clock
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  householdId: string;
  currentUser: User;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
}

export const NewTransactionModal: React.FC<Props> = ({
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
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [amountStr, setAmountStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [merchant, setMerchant] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('pm-credit');
  const [cardId, setCardId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [buyerUserId, setBuyerUserId] = useState<string>(currentUser.id);
  const [payerUserId, setPayerUserId] = useState<string>(currentUser.id);
  const [beneficiaryType, setBeneficiaryType] = useState<BeneficiaryType>('both');
  const [customWallacePct, setCustomWallacePct] = useState<number>(50);
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [dueDay, setDueDay] = useState<number>(10);
  const [projectionMonths, setProjectionMonths] = useState<number>(12);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sub-account lists
  const checkingAccounts = accounts.filter(
    (a) => a.account_type === 'checking' || a.account_type === 'digital_wallet' || a.account_type === 'savings'
  );
  const mealAccounts = accounts.filter((a) => a.account_type === 'meal_benefit');
  const cashAccounts = accounts.filter((a) => a.account_type === 'cash');

  useEffect(() => {
    if (isOpen) {
      setAmountStr('');
      setDescription('');
      setMerchant('');
      setTransactionDate(new Date().toISOString().split('T')[0]);
      setBuyerUserId(currentUser.id);
      setPayerUserId(currentUser.id);
      setBeneficiaryType('both');
      setCustomWallacePct(50);
      setInstallmentsCount(1);
      setIsRecurring(false);
      setDueDay(10);
      setProjectionMonths(12);
      setFormError(null);

      const expenseCats = categories.filter((c) => c.type === 'expense');
      const defaultCat = expenseCats.find((c) => c.name.toLowerCase().includes('mercado')) || expenseCats[0];
      if (defaultCat) setCategoryId(defaultCat.id);

      setPaymentMethodId('pm-credit');
      const defaultCard = cards.find((c) => c.owner_user_id === currentUser.id) || cards[0];
      if (defaultCard) {
        setCardId(defaultCard.id);
        setPayerUserId(defaultCard.owner_user_id);
      }
      setAccountId('');

      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, currentUser, cards, categories]);

  const numericAmount = parseFloat(amountStr.replace(',', '.')) || 0;

  const handleToggleRecurring = (nextVal: boolean) => {
    triggerHaptic('selection');
    setIsRecurring(nextVal);

    if (nextVal) {
      // Passo 1 (Valor): Mantém a digitação do valor existente (não zera)

      // Passo 2 (Descrição e Categoria): Define Categoria padrão como "Fixa"
      const fixaCategory = categories.find(
        (c) => c.name.toLowerCase() === 'fixa' || c.id === 'cat-fixa'
      ) || categories.find((c) => c.name.toLowerCase().includes('fixa'));
      if (fixaCategory) {
        setCategoryId(fixaCategory.id);
      } else {
        setCategoryId('cat-fixa');
      }

      // Meio de Pagamento Padrão: Pré-selecionar PIX como padrão ao marcar Conta Fixa
      setPaymentMethodId('pm-pix');
      setCardId('');
      const defaultPixAcc =
        checkingAccounts.find((a) => a.owner_user_id === payerUserId) ||
        checkingAccounts[0] ||
        accounts[0];
      if (defaultPixAcc) {
        setAccountId(defaultPixAcc.id);
        if (defaultPixAcc.owner_user_id) setPayerUserId(defaultPixAcc.owner_user_id);
      }

      // Divisão de Responsabilidade Padrão: Pré-selecionar 50/50 como padrão
      setBeneficiaryType('both');
      setCustomWallacePct(50);
    }
  };

  const handleAddAmount = (addVal: number) => {
    triggerHaptic('impact-light');
    const current = parseFloat(amountStr.replace(',', '.')) || 0;
    setAmountStr((current + addVal).toFixed(2));
  };

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
      const chkAcc = checkingAccounts.find((a) => a.owner_user_id === payerUserId) || checkingAccounts[0] || accounts[0];
      if (chkAcc) {
        setAccountId(chkAcc.id);
        if (chkAcc.owner_user_id) setPayerUserId(chkAcc.owner_user_id);
      }
      setCardId('');
    }
  };

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
      setFormError('Digite um valor maior que R$ 0,00');
      amountInputRef.current?.focus();
      return;
    }

    if (!categoryId) {
      triggerHaptic('warning');
      setFormError('A seleção da Categoria é obrigatória');
      return;
    }

    if (!paymentMethodId) {
      triggerHaptic('warning');
      setFormError('A seleção do Meio de Pagamento é obrigatória');
      return;
    }

    if (paymentMethodId === 'pm-credit' && !cardId) {
      triggerHaptic('warning');
      setFormError('Selecione o Cartão de Crédito utilizado');
      return;
    }

    if (paymentMethodId !== 'pm-credit' && !accountId) {
      triggerHaptic('warning');
      setFormError('Selecione a Conta / Carteira de saída utilizada');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (isRecurring) {
        await ApiService.createRecurringBill(householdId, currentUser.id, {
          description: description.trim() || 'Conta Fixa',
          merchant: merchant.trim() || description.trim() || 'Conta Fixa',
          expected_amount: numericAmount,
          due_day: Number(dueDay) || 10,
          frequency: 'monthly',
          category_id: categoryId,
          payment_method_id: paymentMethodId,
          account_id: paymentMethodId !== 'pm-credit' ? accountId : undefined,
          card_id: paymentMethodId === 'pm-credit' ? cardId : undefined,
          beneficiary_type: beneficiaryType,
          buyer_user_id: buyerUserId,
          payer_user_id: payerUserId,
          auto_generate: true,
          projection_months: projectionMonths
        });
      } else {
        await ApiService.createTransaction(householdId, currentUser.id, {
          description: description.trim() || 'Nova Movimentação',
          merchant: merchant.trim() || undefined,
          total_amount: numericAmount,
          transaction_type: transactionType,
          payment_method_id: paymentMethodId,
          account_id: paymentMethodId !== 'pm-credit' ? accountId : null,
          card_id: paymentMethodId === 'pm-credit' ? cardId : null,
          category_id: categoryId,
          buyer_user_id: buyerUserId,
          payer_user_id: payerUserId,
          beneficiary_type: beneficiaryType,
          transaction_date: transactionDate,
          installments_count: installmentsCount,
          splits: getSplits()
        });
      }

      triggerHaptic('success');
      onSuccess();
      onClose();
    } catch (err: any) {
      triggerHaptic('error');
      setFormError(err.message || 'Erro ao registrar lançamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const hasFixa = expenseCategories.some((c) => c.name.toLowerCase() === 'fixa' || c.id === 'cat-fixa');
  const displayedCategories = hasFixa
    ? expenseCategories
    : [{ id: 'cat-fixa', household_id: householdId, name: 'Fixa', type: 'expense', color: '#8b5cf6', icon: 'repeat', is_system: true, is_active: true } as Category, ...expenseCategories];

  return (
    <IOSBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isRecurring ? 'Nova Conta Fixa' : 'Novo Lançamento'}
      subtitle={isRecurring ? 'Adiciona uma regra recorrente com projeção futura' : 'Lançamento completo com auditoria contábil'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-2xl flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-medium">{formError}</span>
          </div>
        )}

        {/* RECORRÊNCIA / CONTA FIXA TOGGLE */}
        <div
          onClick={() => handleToggleRecurring(!isRecurring)}
          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            isRecurring
              ? 'bg-purple-950/40 border-purple-500/50 text-purple-200'
              : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isRecurring ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400'
              }`}
            >
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">
                Conta Fixa
              </span>
              <span className="text-[10px] text-slate-400">
                {isRecurring
                  ? 'Despesa fixa recorrente com projeção automática nos próximos meses'
                  : 'Lançamento avulso padrão do dia a dia'}
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

        {/* 1. PASSO 1: CAMPO DE VALOR DIRETO */}
        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Passo 1: Valor
          </span>
          <div className="flex items-baseline justify-center gap-1.5 w-full">
            <span className="text-xl font-bold text-slate-500">R$</span>
            <input
              ref={amountInputRef}
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.,]/g, '');
                setAmountStr(val);
              }}
              className="text-4xl font-black text-white text-center bg-transparent focus:outline-none w-full max-w-[240px] tracking-tight placeholder:text-slate-700"
            />
          </div>

          <div className="flex items-center gap-1.5 mt-3 flex-wrap justify-center">
            {[20, 50, 100, 200, 500].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleAddAmount(val)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700/80 transition-all min-h-touch"
              >
                +R${val}
              </button>
            ))}
          </div>
        </div>

        {/* 2. PASSO 2: DESCRIÇÃO E CATEGORIA (OBRIGATÓRIA) */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Passo 2: Descrição & Categoria <span className="text-rose-400">*Obrigatória</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder={isRecurring ? 'Nome da Conta Fixa (ex: Aluguel, Internet)' : 'Descrição (ex: Supermercado)'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-blue-500 min-h-touch"
              required
            />
            <select
              value={categoryId}
              onChange={(e) => {
                triggerHaptic('selection');
                setCategoryId(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer font-semibold"
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

          {isRecurring ? (
            <div className="space-y-2">
              {/* Dia do Vencimento */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-200 font-bold block">Dia do Vencimento</span>
                  <span className="text-[10px] text-slate-400">Dia limite de pagamento todo mês</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Dia</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-16 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-center text-xs font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Projeção Futura */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-purple-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-purple-300 font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      Projetar por quantos meses?
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Gera automaticamente os lançamentos desta conta fixa na timeline futura
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={projectionMonths}
                      onChange={(e) => setProjectionMonths(Math.min(60, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-16 px-2 py-1.5 rounded-lg bg-slate-900 border border-purple-500/50 text-white text-center text-xs font-black focus:outline-none focus:border-purple-400"
                    />
                    <span className="text-[11px] text-slate-400 font-medium">meses</span>
                  </div>
                </div>

                {/* Chips rápidos de meses */}
                <div className="flex items-center gap-1.5 pt-1">
                  {[3, 6, 12, 24].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        triggerHaptic('selection');
                        setProjectionMonths(m);
                      }}
                      className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        projectionMonths === m
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {m} meses
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch"
                required
              />
              <input
                type="text"
                placeholder="Estabelecimento / Local"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-blue-500 min-h-touch"
              />
            </div>
          )}
        </div>

        {/* 3. PASSO 3: MEIO DE PAGAMENTO ESPECÍFICO & RESPONSABILIDADE */}
        <div className="space-y-2.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Passo 3: Meio de Pagamento Real <span className="text-rose-400">*Obrigatório</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 font-medium">Tipo de Saída</label>
              <select
                value={paymentMethodId}
                onChange={(e) => handlePaymentMethodChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer font-semibold"
                required
              >
                <option value="pm-credit">💳 Cartão de Crédito</option>
                <option value="pm-pix">⚡ Pix</option>
                <option value="pm-debit">🏦 Débito em Conta</option>
                <option value="pm-va">🥗 Vale-Alimentação / VR</option>
                <option value="pm-cash">💵 Dinheiro em Espécie</option>
              </select>
            </div>

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
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-blue-500/50 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer font-semibold"
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
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/50 text-white text-xs focus:outline-none focus:border-amber-500 min-h-touch cursor-pointer font-semibold"
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
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/50 text-white text-xs focus:outline-none focus:border-emerald-500 min-h-touch cursor-pointer font-semibold"
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
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer font-semibold"
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

          {/* Comprador: quem iniciou/gerou a despesa, independente do pagador e da divisão */}
          <div className="space-y-1.5 pt-1">
            <div>
              <label className="text-[10px] text-slate-400 block font-medium">Comprador</label>
              <span className="text-[10px] text-slate-500">Quem iniciou ou gerou esta despesa</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setBuyerUserId('usr-wallace-001');
                }}
                aria-pressed={buyerUserId === 'usr-wallace-001'}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs font-bold border min-h-touch ${
                  buyerUserId === 'usr-wallace-001'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Wallace</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setBuyerUserId('usr-guilherme-002');
                }}
                aria-pressed={buyerUserId === 'usr-guilherme-002'}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs font-bold border min-h-touch ${
                  buyerUserId === 'usr-guilherme-002'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Guilherme</span>
              </button>
            </div>
          </div>

          {/* Módulo de Parcelamento (1x a 24x) para Cartão de Crédito e Compras Parceladas */}
          {paymentMethodId === 'pm-credit' && !isRecurring && (
            <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-blue-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                  Parcelamento no Cartão (1x a 24x)
                </span>
                <span className="text-xs font-black text-blue-400">
                  {installmentsCount}x de R${' '}
                  {(numericAmount > 0 ? numericAmount / installmentsCount : 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>

              {/* Botões rápidos de parcelas mais frequentes */}
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

              {/* Select para qualquer parcela de 1 a 24x */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400">Selecionar parcelas (1x a 24x):</span>
                <select
                  value={installmentsCount}
                  onChange={(e) => {
                    triggerHaptic('selection');
                    setInstallmentsCount(Number(e.target.value));
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x {n === 1 ? '(à vista)' : `de R$ ${(numericAmount > 0 ? numericAmount / n : 0).toFixed(2)}/mês`}
                    </option>
                  ))}
                </select>
              </div>

              {installmentsCount > 1 && (
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                  <span>
                    Projetará automaticamente {installmentsCount} lançamentos fracionados (1/{installmentsCount} a {installmentsCount}/{installmentsCount}) nos meses subsequentes.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Divisão Segmentada em 4 Botões */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] text-slate-400 block font-medium">Divisão de Responsabilidade</label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setBeneficiaryType('both');
                }}
                className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all min-h-touch ${
                  beneficiaryType === 'both' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
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
                className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all min-h-touch ${
                  beneficiaryType === 'wallace' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Wallace</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setBeneficiaryType('guilherme');
                }}
                className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all min-h-touch ${
                  beneficiaryType === 'guilherme' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Guilherme</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setBeneficiaryType('custom');
                }}
                className={`py-2 rounded-xl flex items-center justify-center gap-1 transition-all min-h-touch ${
                  beneficiaryType === 'custom' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Custom</span>
              </button>
            </div>

            {/* Slider for custom split */}
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
        </div>

        {/* 4. CONFIRMAÇÃO EM 1 BOTÃO */}
        <button
          type="submit"
          disabled={isSubmitting || numericAmount <= 0 || !categoryId}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white text-sm font-bold shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 min-h-touch cursor-pointer"
        >
          {isRecurring ? <Repeat className="w-4 h-4 text-white" /> : <Zap className="w-4 h-4 fill-white" />}
          <span>
            {isSubmitting
              ? 'Salvando...'
              : isRecurring
              ? 'Cadastrar Conta Fixa Mensal'
              : 'Confirmar Lançamento'}
          </span>
        </button>
      </form>
    </IOSBottomSheet>
  );
};
