import React, { useState } from 'react';
import type { Account, User } from '../../types/index.js';
import { ApiService } from '../../services/api.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Wallet,
  Plus,
  UtensilsCrossed,
  Building2,
  Banknote,
  Edit2,
  Trash2,
  X,
  CreditCard,
  Layers,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Check,
  Sparkles
} from 'lucide-react';

interface Props {
  accounts: Account[];
  householdId: string;
  currentUser: User;
  onRefresh: () => void;
}

type AccountFilter = 'all' | 'checking' | 'meal_benefit' | 'cash';

export const AccountsManager: React.FC<Props> = ({ accounts, householdId, currentUser, onRefresh }) => {
  const { householdMembers } = useAuth();
  const activeMembers = householdMembers.filter((member) => member.is_active);
  const memberName = (userId?: string | null) => householdMembers.find((member) => member.user_id === userId)?.user?.name || 'Conjunta';
  const [activeFilter, setActiveFilter] = useState<AccountFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  // Recharge Modal State (for VA/VR and other accounts)
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeAccount, setRechargeAccount] = useState<Account | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [rechargeNote, setRechargeNote] = useState('Recarga Mensal de Benefício');
  const [recharging, setRecharging] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [accountType, setAccountType] = useState<Account['account_type']>('checking');
  const [initialBalance, setInitialBalance] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [ownerUserId, setOwnerUserId] = useState<string>('joint');
  const [saving, setSaving] = useState(false);

  const openCreateModal = (typePreset?: Account['account_type']) => {
    setEditingAccount(null);
    setName('');
    setInstitution('');
    setAccountType(typePreset || 'checking');
    setInitialBalance('0');
    setCurrentBalance('0');
    setOwnerUserId('joint');
    setShowModal(true);
    triggerHaptic('impact-light');
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setName(account.name);
    setInstitution(account.institution || '');
    setAccountType(account.account_type);
    setInitialBalance(account.initial_balance.toString());
    setCurrentBalance(account.current_balance.toString());
    setOwnerUserId(account.owner_user_id || 'joint');
    setShowModal(true);
    triggerHaptic('selection');
  };

  const openRechargeModal = (account: Account) => {
    setRechargeAccount(account);
    setRechargeAmount('');
    setRechargeNote(account.account_type === 'meal_benefit' ? 'Recarga Mensal Vale-Alimentação' : 'Aporte de Saldo');
    setShowRechargeModal(true);
    triggerHaptic('selection');
  };

  const handleDelete = async (accountId: string) => {
    try {
      setSaving(true);
      await ApiService.deleteAccount(householdId, currentUser.id, accountId);
      triggerHaptic('success');
      setDeletingAccountId(null);
      if (editingAccount?.id === accountId) {
        setShowModal(false);
        setEditingAccount(null);
      }
      onRefresh();
    } catch (err) {
      console.error('Erro ao excluir conta:', err);
      triggerHaptic('error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    try {
      setSaving(true);
      const ownerId = ownerUserId === 'joint' ? null : ownerUserId;
      if (editingAccount) {
        // Update account
        await ApiService.updateAccount(householdId, currentUser.id, editingAccount.id, {
          name,
          institution: institution || 'Outro',
          account_type: accountType,
          initial_balance: parseFloat(initialBalance) || 0,
          current_balance: parseFloat(currentBalance) || 0,
          owner_user_id: ownerId
        });
      } else {
        // Create account
        await ApiService.createAccount(householdId, currentUser.id, {
          name,
          institution: institution || 'Outro',
          account_type: accountType,
          initial_balance: parseFloat(initialBalance) || 0,
          current_balance: parseFloat(currentBalance) || parseFloat(initialBalance) || 0,
          owner_user_id: ownerId
        });
      }
      triggerHaptic('success');
      setShowModal(false);
      setEditingAccount(null);
      onRefresh();
    } catch (err) {
      console.error('Erro ao salvar conta:', err);
      triggerHaptic('error');
    } finally {
      setSaving(false);
    }
  };

  const handleRechargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rechargeAccount) return;
    const amountVal = parseFloat(rechargeAmount.replace(',', '.')) || 0;
    if (amountVal <= 0) return;

    try {
      setRecharging(true);
      // Update balance directly
      const newBal = (rechargeAccount.current_balance || 0) + amountVal;
      await ApiService.updateAccount(householdId, currentUser.id, rechargeAccount.id, {
        current_balance: newBal
      });

      // Also record an income transaction for audit tracking
      await ApiService.createTransaction(householdId, currentUser.id, {
        description: rechargeNote.trim() || 'Recarga de Benefício',
        merchant: rechargeAccount.institution || 'Emissor Benefício',
        total_amount: amountVal,
        transaction_type: 'income',
        payment_method_id: rechargeAccount.account_type === 'meal_benefit' ? 'pm-va' : 'pm-pix',
        account_id: rechargeAccount.id,
        category_id: 'cat-salario',
        buyer_user_id: rechargeAccount.owner_user_id || currentUser.id,
        payer_user_id: rechargeAccount.owner_user_id || currentUser.id,
        beneficiary_type: rechargeAccount.owner_user_id === 'usr-wallace-001' ? 'wallace' : rechargeAccount.owner_user_id === 'usr-guilherme-002' ? 'guilherme' : 'both',
        transaction_date: new Date().toISOString().split('T')[0],
        installments_count: 1
      });

      triggerHaptic('success');
      setShowRechargeModal(false);
      setRechargeAccount(null);
      onRefresh();
    } catch (err) {
      console.error('Erro ao registrar recarga:', err);
      triggerHaptic('error');
    } finally {
      setRecharging(false);
    }
  };

  const getIcon = (type: Account['account_type']) => {
    switch (type) {
      case 'meal_benefit':
        return (
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0 shadow-2xs">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        );
      case 'cash':
        return (
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0 shadow-2xs">
            <Banknote className="w-5 h-5" />
          </div>
        );
      case 'savings':
      case 'other':
        return (
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0 shadow-2xs">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        );
      case 'digital_wallet':
        return (
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0 shadow-2xs">
            <Wallet className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0 shadow-2xs">
            <Building2 className="w-5 h-5" />
          </div>
        );
    }
  };

  const getTypeBadge = (type: Account['account_type']) => {
    switch (type) {
      case 'meal_benefit':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            Vale-Alimentação / VR
          </span>
        );
      case 'cash':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Dinheiro em Espécie
          </span>
        );
      case 'savings':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            Poupança / Reserva
          </span>
        );
      case 'digital_wallet':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            Carteira Digital
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Conta Corrente / Pix / Débito
          </span>
        );
    }
  };

  const filteredAccounts = accounts.filter((acc) => {
    if (activeFilter === 'checking') return acc.account_type === 'checking' || acc.account_type === 'digital_wallet' || acc.account_type === 'savings';
    if (activeFilter === 'meal_benefit') return acc.account_type === 'meal_benefit';
    if (activeFilter === 'cash') return acc.account_type === 'cash';
    return true;
  });

  const totalBalance = filteredAccounts.reduce((acc, curr) => acc + (curr.current_balance || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header with Filter Chips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <span>Contas, Carteiras & Benefícios</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
              {filteredAccounts.length}
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Saldo acumulado visível: <strong className="text-emerald-600 dark:text-emerald-400">R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreateModal()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nova Fonte</span>
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => {
            setActiveFilter('all');
            triggerHaptic('selection');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
            activeFilter === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Todas ({accounts.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveFilter('checking');
            triggerHaptic('selection');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
            activeFilter === 'checking'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Building2 className="w-3 h-3" />
          <span>Contas / Pix / Débito ({accounts.filter(a => a.account_type === 'checking' || a.account_type === 'digital_wallet').length})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveFilter('meal_benefit');
            triggerHaptic('selection');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
            activeFilter === 'meal_benefit'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <UtensilsCrossed className="w-3 h-3" />
          <span>VA / VR Benefícios ({accounts.filter(a => a.account_type === 'meal_benefit').length})</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveFilter('cash');
            triggerHaptic('selection');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
            activeFilter === 'cash'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Banknote className="w-3 h-3" />
          <span>Dinheiro Vivo ({accounts.filter(a => a.account_type === 'cash').length})</span>
        </button>
      </div>

      {/* Accounts List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredAccounts.map((acc) => {
          const ownerLabel = memberName(acc.owner_user_id);

          const isMealBenefit = acc.account_type === 'meal_benefit';

          return (
            <div
              key={acc.id}
              className="bg-slate-50/80 dark:bg-slate-850/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-blue-300 dark:hover:border-blue-800 transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {getIcon(acc.account_type)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{acc.name}</h4>
                      {getTypeBadge(acc.account_type)}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {acc.institution} • Titular: <span className="font-semibold text-slate-700 dark:text-slate-300">{ownerLabel}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(acc)}
                    className="w-7 h-7 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center transition-all shadow-2xs active:scale-90"
                    title="Editar Conta"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingAccountId(acc.id)}
                    className="w-7 h-7 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all shadow-2xs active:scale-90"
                    title="Excluir Fonte"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Bottom Row: Balance + Actions */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Saldo Atual</span>
                  <span className={`text-xs font-black tracking-tight ${acc.current_balance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                    R$ {acc.current_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {isMealBenefit && (
                  <button
                    type="button"
                    onClick={() => openRechargeModal(acc)}
                    className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold rounded-xl flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span>+ Recarregar Saldo</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingAccountId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Excluir Fonte de Saída?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Esta ação desativará a conta do domicílio.</p>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAccountId(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleDelete(deletingAccountId)}
                className="flex-1 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                {saving ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Recarregar Saldo / Benefício */}
      {showRechargeModal && rechargeAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Registrar Recarga de Benefício
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {rechargeAccount.name} ({rechargeAccount.institution})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRechargeModal(false);
                  setRechargeAccount(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleRechargeSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Valor da Recarga (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 650,00 ou 820,00"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="w-full text-base font-bold p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição / Identificação da Recarga
                </label>
                <input
                  type="text"
                  placeholder="Ex: Recarga Sodexo Junho 2026"
                  value={rechargeNote}
                  onChange={(e) => setRechargeNote(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
                <span>O saldo será somado imediatamente à conta e gerará registro de auditoria contábil.</span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRechargeModal(false);
                    setRechargeAccount(null);
                  }}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={recharging || !rechargeAmount}
                  className="flex-1 py-2.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 active:scale-98 rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {recharging ? 'Processando...' : 'Confirmar Recarga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Conta */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {editingAccount ? 'Editar Conta / Carteira' : 'Cadastrar Nova Conta'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editingAccount ? 'Ajuste os parâmetros da fonte' : 'Adicione uma conta bancária, vale ou dinheiro'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setEditingAccount(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Conta / Carteira
                </label>
                <input
                  type="text"
                  placeholder="Ex: Pix / Débito Nubank, Sodexo Alimentação, Carteira Wallace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Instituição / Emissor
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Nubank, Itaú, Sodexo, Carteira Física"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Fonte
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as Account['account_type'])}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="checking">Conta Corrente / Pix / Débito</option>
                    <option value="meal_benefit">Vale-Alimentação / Refeição (VA/VR)</option>
                    <option value="cash">Dinheiro em Espécie (Carteira física)</option>
                    <option value="savings">Poupança / Reserva</option>
                    <option value="digital_wallet">Carteira Digital</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {editingAccount ? 'Saldo Atual (R$)' : 'Saldo Inicial (R$)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={editingAccount ? currentBalance : initialBalance}
                    onChange={(e) => {
                      if (editingAccount) {
                        setCurrentBalance(e.target.value);
                      } else {
                        setInitialBalance(e.target.value);
                      }
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Titular da Fonte
                  </label>
                  <select
                    value={ownerUserId}
                    onChange={(e) => setOwnerUserId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="joint">Conjunta (Casa)</option>
                    {activeMembers.map((member) => <option key={member.id} value={member.user_id}>{member.user?.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                {editingAccount && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingAccountId(editingAccount.id);
                    }}
                    className="py-2.5 px-3 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingAccount(null);
                  }}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : editingAccount ? 'Atualizar' : 'Salvar Fonte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
