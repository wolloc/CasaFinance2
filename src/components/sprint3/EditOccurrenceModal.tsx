import React, { useState, useEffect } from 'react';
import type {
  Account,
  Card,
  Category,
  PaymentMethod,
  BeneficiaryType
} from '../../types/index.js';
import { ApiService } from '../../services/api.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { IOSBottomSheet } from '../common/IOSBottomSheet.js';
import type { UnifiedTimelineItem } from './TransactionsTimeline.js';
import {
  Pencil,
  CreditCard,
  Building2,
  ArrowRightLeft,
  UtensilsCrossed,
  Banknote,
  Users,
  User as UserIcon,
  AlertCircle,
  Repeat,
  Check
} from 'lucide-react';

interface EditOccurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: UnifiedTimelineItem | null;
  householdId: string;
  userId: string;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  onSuccess: () => void;
}

export const EditOccurrenceModal: React.FC<EditOccurrenceModalProps> = ({
  isOpen,
  onClose,
  item,
  householdId,
  userId,
  accounts = [],
  cards = [],
  categories = [],
  paymentMethods = [],
  onSuccess
}) => {
  const [amountStr, setAmountStr] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('pm-pix');
  const [cardId, setCardId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [payerUserId, setPayerUserId] = useState<string>('usr-wallace-001');
  const [buyerUserId, setBuyerUserId] = useState<string>('usr-wallace-001');
  const [beneficiaryType, setBeneficiaryType] = useState<BeneficiaryType>('both');
  const [customWallacePct, setCustomWallacePct] = useState<number>(50);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const checkingAccounts = accounts.filter(
    (a) => a.account_type === 'checking' || a.account_type === 'digital_wallet' || a.account_type === 'savings'
  );
  const mealAccounts = accounts.filter((a) => a.account_type === 'meal_benefit');
  const cashAccounts = accounts.filter((a) => a.account_type === 'cash');

  useEffect(() => {
    if (isOpen && item) {
      setAmountStr(item.amount ? item.amount.toFixed(2).replace('.', ',') : '');
      setDescription(item.title || '');
      setDate(item.date || new Date().toISOString().split('T')[0]);
      setCategoryId(item.categoryId || '');
      setPaymentMethodId(item.paymentMethodId || 'pm-pix');
      setCardId(item.cardId || '');
      setAccountId(item.accountId || '');
      setPayerUserId(item.payerId || 'usr-wallace-001');
      setBuyerUserId(item.buyerId || 'usr-wallace-001');
      setBeneficiaryType(item.beneficiaryType || 'both');
      setCustomWallacePct(item.wallacePercentage ?? 50);
      setError(null);
    }
  }, [isOpen, item]);

  const handlePaymentMethodChange = (pmId: string) => {
    triggerHaptic('selection');
    setPaymentMethodId(pmId);
    if (pmId === 'pm-credit') {
      const defaultCard = cards.find((c) => c.owner_user_id === payerUserId) || cards[0];
      if (defaultCard) {
        setCardId(defaultCard.id);
        setPayerUserId(defaultCard.owner_user_id);
      }
      setAccountId('');
    } else if (pmId === 'pm-va') {
      const defaultVA = mealAccounts[0];
      if (defaultVA) {
        setAccountId(defaultVA.id);
        if (defaultVA.owner_user_id) setPayerUserId(defaultVA.owner_user_id);
      }
      setCardId('');
    } else if (pmId === 'pm-cash') {
      const defaultCash = cashAccounts[0];
      if (defaultCash) {
        setAccountId(defaultCash.id);
        if (defaultCash.owner_user_id) setPayerUserId(defaultCash.owner_user_id);
      }
      setCardId('');
    } else {
      const defaultAcc = checkingAccounts.find((a) => a.owner_user_id === payerUserId) || checkingAccounts[0];
      if (defaultAcc) {
        setAccountId(defaultAcc.id);
        if (defaultAcc.owner_user_id) setPayerUserId(defaultAcc.owner_user_id);
      }
      setCardId('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    const numericAmount = parseFloat(amountStr.replace(',', '.')) || 0;
    if (numericAmount <= 0) {
      setError('Por favor, informe um valor válido maior que zero.');
      return;
    }

    if (!categoryId) {
      setError('Selecione uma categoria.');
      return;
    }

    if (paymentMethodId === 'pm-credit' && !cardId) {
      setError('Selecione o cartão de crédito utilizado.');
      return;
    }

    if (paymentMethodId !== 'pm-credit' && !accountId) {
      setError('Selecione a conta ou carteira utilizada.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      triggerHaptic('impact-medium');

      if (item.source === 'recurring_bill_occurrence') {
        await ApiService.updateBillOccurrence(householdId, userId, item.id, {
          amount: numericAmount,
          description: description.trim() || item.title,
          due_date: date,
          payment_method_id: paymentMethodId,
          account_id: paymentMethodId !== 'pm-credit' ? accountId : null,
          card_id: paymentMethodId === 'pm-credit' ? cardId : null,
          payer_user_id: payerUserId,
          buyer_user_id: buyerUserId,
          beneficiary_type: beneficiaryType,
          wallace_percentage: beneficiaryType === 'custom' ? customWallacePct : undefined,
          category_id: categoryId || undefined
        });
      } else {
        await ApiService.updateTransaction(householdId, userId, item.id, {
          total_amount: numericAmount,
          description: description.trim() || item.title,
          transaction_date: date,
          payment_method_id: paymentMethodId,
          account_id: paymentMethodId !== 'pm-credit' ? accountId : null,
          card_id: paymentMethodId === 'pm-credit' ? cardId : null,
          payer_user_id: payerUserId,
          buyer_user_id: buyerUserId,
          beneficiary_type: beneficiaryType,
          category_id: categoryId || undefined
        });
      }

      triggerHaptic('success');
      onSuccess();
      onClose();
    } catch (err: any) {
      triggerHaptic('error');
      setError(err.message || 'Erro ao atualizar dados');
    } finally {
      setIsSubmitting(false);
    }
  };

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  return (
    <IOSBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={item?.isRecurring ? 'Ajustar Conta Fixa deste Mês' : 'Editar Lançamento'}
      subtitle={
        item?.isRecurring
          ? 'Atualize o valor real, meio de pagamento ou responsável desta ocorrência'
          : 'Edite os valores e divisões contábeis'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-800 text-rose-300 text-xs rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {item?.isRecurring && (
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-200 flex items-center gap-2">
            <Repeat className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              Alteração exclusiva para esta competência mensal na timeline. O valor base da regra é preservado.
            </span>
          </div>
        )}

        {/* 1. VALOR REAL DO MÊS */}
        <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Valor Real deste Mês (R$)
          </span>
          <div className="flex items-baseline justify-center gap-1.5 w-full">
            <span className="text-xl font-bold text-slate-500">R$</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.,]/g, '');
                setAmountStr(val);
              }}
              className="text-3xl font-black text-white text-center bg-transparent focus:outline-none w-full max-w-[240px] tracking-tight placeholder:text-slate-700"
              required
            />
          </div>
        </div>

        {/* 2. DESCRIÇÃO E DATA */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Descrição & Vencimento
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do lançamento"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch font-medium"
              required
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch font-medium"
              required
            />
          </div>
        </div>

        {/* 3. CATEGORIA */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Categoria
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer font-semibold"
          >
            <option value="">Selecione a Categoria...</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                🏷️ {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* 4. MEIO DE PAGAMENTO */}
        <div className="space-y-2.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Meio de Pagamento Real
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1 font-medium">Forma de Saída</label>
              <select
                value={paymentMethodId}
                onChange={(e) => handlePaymentMethodChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer font-semibold"
              >
                <option value="pm-pix">⚡ Pix</option>
                <option value="pm-credit">💳 Cartão de Crédito</option>
                <option value="pm-debit">🏦 Débito em Conta</option>
                <option value="pm-va">🥗 Vale-Alimentação</option>
                <option value="pm-cash">💵 Dinheiro</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1 font-medium">
                {paymentMethodId === 'pm-credit' ? 'Cartão Utilizado' : 'Conta de Origem'}
              </label>

              {paymentMethodId === 'pm-credit' ? (
                <select
                  value={cardId}
                  onChange={(e) => {
                    const sel = cards.find((c) => c.id === e.target.value);
                    setCardId(e.target.value);
                    if (sel) setPayerUserId(sel.owner_user_id);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-blue-500/50 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer font-semibold"
                >
                  <option value="" disabled>Selecione o Cartão...</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      💳 {c.name} ({c.owner_user_id === 'usr-wallace-001' ? 'Wallace' : 'Guilherme'})
                    </option>
                  ))}
                </select>
              ) : paymentMethodId === 'pm-va' ? (
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/50 text-white text-xs focus:outline-none min-h-touch cursor-pointer font-semibold"
                >
                  <option value="" disabled>Selecione o Vale...</option>
                  {mealAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      🥗 {a.name}
                    </option>
                  ))}
                </select>
              ) : paymentMethodId === 'pm-cash' ? (
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-emerald-500/50 text-white text-xs focus:outline-none min-h-touch cursor-pointer font-semibold"
                >
                  <option value="" disabled>Selecione a Carteira...</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      💵 {a.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={accountId}
                  onChange={(e) => {
                    const sel = accounts.find((a) => a.id === e.target.value);
                    setAccountId(e.target.value);
                    if (sel?.owner_user_id) setPayerUserId(sel.owner_user_id);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-blue-500 min-h-touch cursor-pointer font-semibold"
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
        </div>

        {/* 5. RESPONSÁVEL POR PAGAR */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Quem Paga
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setPayerUserId('usr-wallace-001');
              }}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs font-bold border min-h-touch ${
                payerUserId === 'usr-wallace-001'
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
                setPayerUserId('usr-guilherme-002');
              }}
              className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs font-bold border min-h-touch ${
                payerUserId === 'usr-guilherme-002'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Guilherme</span>
            </button>
          </div>
        </div>

        {/* 6. DIVISÃO DE RESPONSABILIDADE */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Divisão de Responsabilidade
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
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
              <span>Wallace 100%</span>
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
              <span>Guilherme 100%</span>
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
              <span>Personalizada</span>
            </button>
          </div>

          {beneficiaryType === 'custom' && (
            <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-emerald-400">Wallace {customWallacePct}%</span>
                <span className="text-indigo-400">Guilherme {100 - customWallacePct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={customWallacePct}
                onChange={(event) => setCustomWallacePct(Number(event.target.value))}
                className="w-full accent-purple-500"
                aria-label="Percentual de responsabilidade do Wallace"
              />
            </div>
          )}
        </div>

        {/* 7. BOTÃO DE CONFIRMAR ALTERAÇÕES */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 min-h-touch cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
        </button>
      </form>
    </IOSBottomSheet>
  );
};
