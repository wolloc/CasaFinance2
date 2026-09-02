import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard,
  Wallet,
  ChevronDown,
  ChevronUp,
  Utensils,
  User,
  Layers
} from 'lucide-react';
import type { DashboardCardItem, DashboardAccountItem } from '../../types/index.js';
import { triggerHaptic } from '../../utils/haptics.js';

interface CardsOverviewCarouselProps {
  cards: DashboardCardItem[];
  accounts: DashboardAccountItem[];
}

export const CardsOverviewCarousel: React.FC<CardsOverviewCarouselProps> = ({
  cards,
  accounts
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'cards' | 'accounts'>('cards');

  const totalInvoice = cards.reduce((sum, c) => sum + (c.current_invoice_amount || 0), 0);
  const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);

  const toggleAccordion = () => {
    triggerHaptic('selection');
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-800 shadow-xl overflow-hidden transition-all">
      {/* 1. Resumo Consolidado (Tocar para expandir) */}
      <button
        type="button"
        onClick={toggleAccordion}
        className="w-full p-4.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors min-h-touch cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center border border-blue-500/25">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Contas & Cartões
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                {cards.length} cartões • {accounts.length} contas
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-white mt-0.5">
              <span>Faturas: <strong className="text-sky-400">R$ {totalInvoice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
              <span className="text-slate-600">•</span>
              <span>Saldo: <strong className="text-emerald-400">R$ {totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-blue-400 font-bold bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20">
          <span>{isExpanded ? 'Recolher' : 'Ver Detalhes'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* 2. Conteúdo Expandido (Sanfona Suave) */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="border-t border-slate-800/80 p-4 space-y-4 bg-slate-950/40"
          >
            {/* Seletor Cartões vs Contas */}
            <div className="flex items-center p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveTab('cards');
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-h-touch ${
                  activeTab === 'cards'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Cartões ({cards.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveTab('accounts');
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-h-touch ${
                  activeTab === 'accounts'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Contas & VA ({accounts.length})</span>
              </button>
            </div>

            {/* TAB CARTÕES */}
            {activeTab === 'cards' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cards.length === 0 ? (
                  <p className="text-xs text-slate-500 col-span-2 text-center py-4">
                    Nenhum cartão cadastrado.
                  </p>
                ) : (
                  cards.map((card) => {
                    const usagePercent = card.credit_limit > 0
                      ? Math.min(100, Math.round((card.current_invoice_amount / card.credit_limit) * 100))
                      : 0;

                    return (
                      <div
                        key={card.id}
                        className="bg-slate-900/90 rounded-2xl border border-slate-800 p-3.5 shadow-sm relative overflow-hidden"
                      >
                        <div
                          className="absolute top-0 left-0 right-0 h-1"
                          style={{ backgroundColor: card.color || '#3b82f6' }}
                        />

                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h4 className="font-bold text-white text-xs leading-tight">
                              {card.name}
                            </h4>
                            <span className="text-[10px] text-slate-400">{card.institution}</span>
                          </div>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <User className="w-2.5 h-2.5 text-slate-400" />
                            {card.owner_name.split(' ')[0]}
                          </span>
                        </div>

                        {/* Valor Fatura & Progresso de Limite */}
                        <div className="my-2">
                          <div className="flex items-baseline justify-between">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">Fatura Aberta</span>
                            <span className="text-sm font-black text-white">
                              R$ {card.current_invoice_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          <div className="w-full bg-slate-950 rounded-full h-1.5 my-2 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${usagePercent}%`,
                                backgroundColor: usagePercent > 80 ? '#ef4444' : card.color || '#3b82f6'
                              }}
                            />
                          </div>
                        </div>

                        {/* Metadados: Limite Disponível & Fechamento */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                          <span>Fecha dia <strong className="text-slate-200">{card.closing_day}</strong></span>
                          <span className="text-emerald-400 font-semibold">
                            Disp: R$ {card.available_limit.toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB CONTAS */}
            {activeTab === 'accounts' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {accounts.map((acc) => {
                  const isVA = acc.account_type === 'meal_benefit';

                  return (
                    <div
                      key={acc.id}
                      className="bg-slate-900/90 rounded-2xl border border-slate-800 p-3.5 shadow-sm flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-xl border ${
                            isVA
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {isVA ? <Utensils className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-xs">{acc.name}</h4>
                          <span className="text-[10px] text-slate-400">{acc.owner_name}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase block font-semibold">Saldo</span>
                        <span className="text-xs font-black text-emerald-400">
                          R$ {acc.current_balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
