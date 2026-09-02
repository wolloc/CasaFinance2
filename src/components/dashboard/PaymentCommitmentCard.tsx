import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  CreditCard,
  Building2,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  Wallet,
  UtensilsCrossed,
  Banknote,
  TrendingDown,
  BarChart3
} from 'lucide-react';
import type { DashboardCardItem, DashboardAccountItem, DashboardPaymentCommitmentItem } from '../../types/index.js';
import { triggerHaptic } from '../../utils/haptics.js';

interface PaymentCommitmentCardProps {
  cards: DashboardCardItem[];
  accounts: DashboardAccountItem[];
  commitmentItems?: DashboardPaymentCommitmentItem[];
}

export const PaymentCommitmentCard: React.FC<PaymentCommitmentCardProps> = ({
  cards = [],
  accounts = [],
  commitmentItems = []
}) => {
  const [activeTab, setActiveTab] = useState<'ranking' | 'cards' | 'accounts'>('ranking');

  const handleTabChange = (tab: 'ranking' | 'cards' | 'accounts') => {
    triggerHaptic('selection');
    setActiveTab(tab);
  };

  // Sort cards by highest invoice
  const sortedCards = [...cards].sort((a, b) => b.current_invoice_amount - a.current_invoice_amount);
  const totalOpenInvoices = cards.reduce((sum, c) => sum + c.current_invoice_amount, 0);
  const totalAccountBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  // Sorted commitment items (highest spent to lowest)
  const sortedCommitments = [...commitmentItems].sort((a, b) => b.total_spent - a.total_spent);
  const totalSpentAllMethods = sortedCommitments.reduce((sum, item) => sum + item.total_spent, 0);

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'credit_card':
        return <CreditCard className="w-4 h-4" />;
      case 'meal_benefit':
        return <UtensilsCrossed className="w-4 h-4" />;
      case 'cash':
        return <Banknote className="w-4 h-4" />;
      default:
        return <Wallet className="w-4 h-4" />;
    }
  };

  const getMethodTypeName = (type: string) => {
    switch (type) {
      case 'credit_card':
        return 'Cartão de Crédito';
      case 'meal_benefit':
        return 'Vale-Alimentação/Refeição';
      case 'cash':
        return 'Dinheiro em Espécie';
      default:
        return 'Conta / Débito / Pix';
    }
  };

  return (
    <div id="card-payment-commitment" className="bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-800 shadow-xl overflow-hidden p-5 sm:p-6 space-y-4">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/25 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-white">Meios de Pagamento & Cartões</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranking de saídas por fonte, comprometimento de limites e saldos disponíveis
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center p-1 bg-slate-950 rounded-2xl border border-slate-800/90 relative self-start sm:self-auto text-xs font-bold">
          <button
            type="button"
            onClick={() => handleTabChange('ranking')}
            className={`relative px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors z-10 min-h-touch ${
              activeTab === 'ranking' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {activeTab === 'ranking' && (
              <motion.div
                layoutId="active-pm-tab"
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="absolute inset-0 bg-sky-600 rounded-xl shadow-md shadow-sky-500/20 -z-10"
              />
            )}
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Ranking de Saídas</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('cards')}
            className={`relative px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors z-10 min-h-touch ${
              activeTab === 'cards' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {activeTab === 'cards' && (
              <motion.div
                layoutId="active-pm-tab"
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="absolute inset-0 bg-blue-600 rounded-xl shadow-md shadow-blue-500/20 -z-10"
              />
            )}
            <CreditCard className="w-3.5 h-3.5" />
            <span>Cartões ({cards.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('accounts')}
            className={`relative px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors z-10 min-h-touch ${
              activeTab === 'accounts' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {activeTab === 'accounts' && (
              <motion.div
                layoutId="active-pm-tab"
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="absolute inset-0 bg-emerald-600 rounded-xl shadow-md shadow-emerald-500/20 -z-10"
              />
            )}
            <Wallet className="w-3.5 h-3.5" />
            <span>Contas & VA/VR</span>
          </button>
        </div>
      </div>

      {/* 1. Ranking de Saídas por Meio de Pagamento */}
      {activeTab === 'ranking' && (
        <div className="space-y-3">
          {sortedCommitments.length === 0 ? (
            <div className="p-6 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80">
              <TrendingDown className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-400">Nenhum gasto registrado nos meios de pagamento neste mês</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedCommitments.map((pm, index) => {
                return (
                  <div
                    key={pm.id}
                    className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-2 hover:border-slate-700/80 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                          style={{ backgroundColor: pm.color || '#3b82f6' }}
                        >
                          {getMethodIcon(pm.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-white">{pm.name}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                              {getMethodTypeName(pm.type)}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                            Titular: {pm.owner_name || 'Casal'} {pm.institution ? `• ${pm.institution}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-white block">
                          R$ {pm.total_spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] font-bold text-sky-400">{pm.percentage}% do total</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/80">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(3, pm.percentage))}%`,
                          backgroundColor: pm.color || '#3b82f6'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Cards View (Cartões de Crédito) */}
      {activeTab === 'cards' && (
        <div className="space-y-3">
          {sortedCards.length === 0 ? (
            <div className="p-6 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80">
              <CreditCard className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-400">Nenhum cartão cadastrado nesta perspectiva</p>
            </div>
          ) : (
            sortedCards.map((card) => {
              const usagePercent = card.credit_limit > 0
                ? Math.min(100, (card.current_invoice_amount / card.credit_limit) * 100)
                : 0;

              return (
                <div
                  key={card.id}
                  className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-3 hover:border-slate-700/80 transition-all"
                >
                  {/* Card Title & Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md"
                        style={{ backgroundColor: card.color || '#3b82f6' }}
                      >
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white">{card.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                            {card.institution}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-slate-500" />
                          Titular: {card.owner_name}
                        </span>
                      </div>
                    </div>

                    {/* Closing day badge */}
                    <div className="text-right">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Fecha dia {card.closing_day}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        Vence dia {card.due_day}
                      </span>
                    </div>
                  </div>

                  {/* Invoice and Limit Progress */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-900">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">
                        Fatura Aberta: <strong className="text-white">R$ {card.current_invoice_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        Limite: R$ {card.credit_limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({usagePercent.toFixed(0)}%)
                      </span>
                    </div>

                    {/* Limit Progress Bar */}
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/80">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usagePercent > 80 ? 'bg-rose-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.max(2, usagePercent)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. Accounts View (Contas, Pix, VA/VR) */}
      {activeTab === 'accounts' && (
        <div className="space-y-3">
          {accounts.length === 0 ? (
            <div className="p-6 text-center bg-slate-950/50 rounded-2xl border border-slate-800/80">
              <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-400">Nenhuma conta cadastrada</p>
            </div>
          ) : (
            accounts.map((acc) => {
              const isMeal = acc.account_type === 'meal_benefit';
              const isCash = acc.account_type === 'cash';
              return (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex items-center justify-between hover:border-slate-700/80 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                        isMeal ? 'bg-emerald-600' : isCash ? 'bg-amber-600' : 'bg-indigo-600'
                      }`}
                    >
                      {isMeal ? <UtensilsCrossed className="w-4 h-4" /> : isCash ? <Banknote className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{acc.name}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {isMeal ? 'Benefício VA/VR' : isCash ? 'Dinheiro' : 'Conta / Pix'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <User className="w-2.5 h-2.5 text-slate-500" />
                        {acc.owner_name} • {acc.institution}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-emerald-400 block">
                      R$ {acc.current_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-400">Saldo Disponível</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
