import React, { useState } from 'react';
import type { Account, Card, Category, User } from '../../types/index.js';
import { AccountsManager } from './AccountsManager.js';
import { CardsManager } from './CardsManager.js';
import { CategoriesManager } from './CategoriesManager.js';
import { SqlSchemaViewer } from './SqlSchemaViewer.js';
import { CreditCard, Wallet, Tag, ShieldCheck, Layers, Code, Database } from 'lucide-react';

interface Props {
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  householdId: string;
  currentUser: User;
  onRefresh: () => void;
}

export const Sprint2FullManager: React.FC<Props> = ({
  accounts,
  cards,
  categories,
  householdId,
  currentUser,
  onRefresh
}) => {
  const [subTab, setSubTab] = useState<'cards' | 'accounts' | 'categories' | 'sql'>('cards');

  // Relational & Totals calculations
  const totalCreditLimit = cards.reduce((sum, c) => sum + (c.credit_limit || 0), 0);
  const totalAccountBalance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const vaAccount = accounts.find((a) => a.account_type === 'meal_benefit');

  return (
    <div className="space-y-4">
      {/* Sprint 2 Banner & Overview Metrics */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white p-5 rounded-2xl border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">Sprint 2 • Entidades Financeiras</span>
              <h2 className="text-sm font-bold text-white">Cartões, Contas & Categorias</h2>
            </div>
          </div>
          <span className="text-[11px] bg-emerald-500/20 text-emerald-300 font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            RLS Protegido
          </span>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-medium">Limite Total Cartões</span>
            <span className="text-xs font-bold text-sky-400">
              R$ {totalCreditLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-medium">Saldo em Contas</span>
            <span className="text-xs font-bold text-emerald-400">
              R$ {totalAccountBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-medium">Carteira VA</span>
            <span className="text-xs font-bold text-amber-400">
              {vaAccount ? `R$ ${vaAccount.current_balance.toFixed(2)}` : 'Não conf.'}
            </span>
          </div>
        </div>
      </div>

      {/* Internal Sub-navigation for Sprint 2 */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/80 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setSubTab('cards')}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            subTab === 'cards'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Cartões
        </button>

        <button
          onClick={() => setSubTab('accounts')}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            subTab === 'accounts'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          Contas
        </button>

        <button
          onClick={() => setSubTab('categories')}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            subTab === 'categories'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          Categorias
        </button>

        <button
          onClick={() => setSubTab('sql')}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
            subTab === 'sql'
              ? 'bg-slate-800 text-indigo-300 shadow-sm border border-indigo-500/40'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          SQL DDL
        </button>
      </div>

      {/* Dynamic Sub-tab rendering */}
      {subTab === 'cards' && (
        <CardsManager
          cards={cards}
          householdId={householdId}
          currentUser={currentUser}
          onRefresh={onRefresh}
        />
      )}

      {subTab === 'accounts' && (
        <AccountsManager
          accounts={accounts}
          householdId={householdId}
          currentUser={currentUser}
          onRefresh={onRefresh}
        />
      )}

      {subTab === 'categories' && (
        <CategoriesManager
          categories={categories}
          householdId={householdId}
          currentUser={currentUser}
          onRefresh={onRefresh}
        />
      )}

      {subTab === 'sql' && (
        <SqlSchemaViewer />
      )}
    </div>
  );
};
