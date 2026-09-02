import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { ApiService } from '../../services/api.js';
import type { Account, Card, Category } from '../../types/index.js';
import { Users, CreditCard, Wallet, Tag, ShieldCheck, CheckCircle2, Lock } from 'lucide-react';

export const HouseholdOverview: React.FC = () => {
  const { currentUser, activeHousehold, householdMembers } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || !activeHousehold) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [accRes, cardRes, catRes] = await Promise.all([
          ApiService.getAccounts(activeHousehold.id, currentUser.id),
          ApiService.getCards(activeHousehold.id, currentUser.id),
          ApiService.getCategories(activeHousehold.id, currentUser.id)
        ]);
        setAccounts(accRes.accounts);
        setCards(cardRes.cards);
        setCategories(catRes.categories);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, activeHousehold]);

  if (!activeHousehold) {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-4 rounded-2xl text-center">
        <Lock className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">Acesso Restrito pelo RLS</h3>
        <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
          O usuário logado ({currentUser?.name}) não possui associação neste Household.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Household Identity Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white p-5 rounded-2xl shadow-sm border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-600/30 rounded-xl flex items-center justify-center border border-blue-500/30">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-blue-300 font-semibold">Grupo Financeiro do Casal</span>
              <h2 className="text-lg font-bold text-white">{activeHousehold.name}</h2>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Sincronizado
          </span>
        </div>

        {/* Members Pills */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <div className="text-xs text-slate-300 font-medium">Membros Autorizados:</div>
          <div className="flex items-center gap-2">
            {householdMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 text-xs"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="font-semibold text-white">{m.user?.name}</span>
                <span className="text-[10px] text-slate-400 uppercase">({m.role})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Seed Entities configured in Sprint 1 */}
      <div className="grid grid-cols-2 gap-3">
        {/* Contas */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold text-xs mb-2">
            <Wallet className="w-4 h-4 text-emerald-500" />
            <span>Contas Bancárias & VA ({accounts.length})</span>
          </div>
          <div className="space-y-1.5">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[110px]">{acc.name}</span>
                <span className="font-semibold text-slate-900 dark:text-white">R$ {acc.current_balance.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cartões */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold text-xs mb-2">
            <CreditCard className="w-4 h-4 text-blue-500" />
            <span>Cartões Iniciais ({cards.length})</span>
          </div>
          <div className="space-y-1.5">
            {cards.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                <span className="font-semibold" style={{ color: c.color }}>{c.name}</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Fecha dia {c.closing_day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categorias Seed */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold text-xs">
            <Tag className="w-4 h-4 text-indigo-500" />
            <span>Categorias do Casal ({categories.length} cadastradas)</span>
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Marco Zero Ativo
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <span
              key={cat.id}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700/60"
            >
              {cat.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
