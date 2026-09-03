import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Header } from './components/common/Header.js';
import { ApiService } from './services/api.js';
import type { Account, Card, Category, Transaction, PaymentMethod } from './types/index.js';
import { NewTransactionModal } from './components/sprint3/NewTransactionModal.js';
import { QuickAddModal } from './components/common/QuickAddModal.js';
import { TransactionsTimeline } from './components/sprint3/TransactionsTimeline.js';
import { IncomeManager } from './components/income/IncomeManager.js';
import { SettingsAndHouseholdManager } from './components/sprint2/SettingsAndHouseholdManager.js';
import { HomeDashboard } from './components/dashboard/HomeDashboard.js';
import { DraggableFloatingActions } from './components/common/DraggableFloatingActions.js';
import { triggerHaptic } from './utils/haptics.js';
import { PwaUpdateNotice } from './components/common/PwaUpdateNotice.js';
import { SupabaseAuthProvider, useSupabaseAuth } from './context/SupabaseAuthContext.js';
import { AuthScreen } from './components/auth/AuthScreen.js';
import { PendingHouseholdScreen } from './components/auth/PendingHouseholdScreen.js';
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Settings,
  Shield
} from 'lucide-react';

export type MainAppTab = 'dashboard' | 'transactions' | 'income' | 'settings';

const AppContent: React.FC = () => {
  const { currentUser, activeHousehold, isLoading, error } = useAuth();
  const [activeTab, setActiveTab] = useState<MainAppTab>('dashboard');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState<boolean>(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  // Global shared filters across Dashboard & Extrato (Lançamentos)
  const [globalMonth, setGlobalMonth] = useState<string>(() => new Intl.DateTimeFormat('en-CA', {
    timeZone: activeHousehold?.timezone || 'America/Sao_Paulo', year: 'numeric', month: '2-digit'
  }).format(new Date()));
  const [globalResponsible, setGlobalResponsible] = useState<'all' | 'wallace' | 'guilherme'>('all');
  const [globalCategory, setGlobalCategory] = useState<string>('all');

  const mainContainerRef = useRef<HTMLDivElement>(null);

  const refreshData = async () => {
    if (!currentUser || !activeHousehold) return;
    try {
      setDataLoading(true);
      const [accRes, cardRes, catRes, txRes, pmRes] = await Promise.all([
        ApiService.getAccounts(activeHousehold.id, currentUser.id),
        ApiService.getCards(activeHousehold.id, currentUser.id),
        ApiService.getCategories(activeHousehold.id, currentUser.id),
        ApiService.getTransactions(activeHousehold.id, currentUser.id),
        ApiService.getPaymentMethods()
      ]);
      setAccounts(accRes.accounts);
      setCards(cardRes.cards);
      setCategories(catRes.categories);
      setTransactions(txRes.transactions);
      setPaymentMethods(pmRes.payment_methods);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [currentUser, activeHousehold]);

  const handleTabChange = (tab: MainAppTab) => {
    triggerHaptic('selection');
    setActiveTab(tab);
  };

  if (isLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center animate-bounce shadow-lg">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <p className="text-sm font-semibold text-slate-300">Inicializando Casa Finance & RLS...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-1 sm:p-4 font-sans antialiased">
      {/* iOS Mobile-First Frame / Native App Shell */}
      <main
        ref={mainContainerRef}
        className="w-full max-w-md sm:max-w-xl md:max-w-2xl bg-slate-950 sm:rounded-[44px] sm:shadow-2xl overflow-hidden sm:border-[6px] sm:border-slate-800 flex flex-col min-h-[100dvh] sm:min-h-[920px] relative transition-all"
      >
        {/* Dynamic Island / Notch */}
        <div aria-hidden="true" className="hidden sm:flex w-full justify-center pt-2.5 pb-1 bg-slate-900 z-20">
          <div className="w-32 h-5 bg-black rounded-full shadow-inner flex items-center justify-between px-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-800"></span>
            <span className="w-2 h-2 rounded-full bg-blue-500/80 animate-pulse"></span>
          </div>
        </div>

        {/* App Header with Active User & Settings/Family Dropdown */}
        <Header onOpenSettings={() => handleTabChange('settings')} />

        {/* Scrollable Content Body with Spring Transitions */}
        <div className="flex-1 p-3 sm:p-5 space-y-4 overflow-y-auto bg-slate-950 pb-36 no-scrollbar">
          {error && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-2xl text-xs flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {/* 1. DASHBOARD: Visão geral, gráficos de categoria, balanço do casal e indicadores */}
              {activeTab === 'dashboard' && activeHousehold && currentUser && (
                <HomeDashboard
                  householdId={activeHousehold.id}
                  userId={currentUser.id}
                  selectedMonth={globalMonth}
                  onMonthChange={setGlobalMonth}
                  selectedResponsible={globalResponsible}
                  onResponsibleChange={setGlobalResponsible}
                  selectedCategory={globalCategory}
                  onCategoryChange={setGlobalCategory}
                  categories={categories}
                  onNavigateTab={(tab) => {
                    if (tab === 'transactions') handleTabChange('transactions');
                    else if (tab === 'income') handleTabChange('income');
                    else if (tab === 'settings') handleTabChange('settings');
                  }}
                />
              )}

              {/* 2. LANÇAMENTOS: Histórico de gastos e despesas unificadas */}
              {activeTab === 'transactions' && activeHousehold && currentUser && (
                <TransactionsTimeline
                  transactions={transactions}
                  onOpenNewModal={() => setIsNewTxModalOpen(true)}
                  onRefresh={refreshData}
                  householdId={activeHousehold.id}
                  userId={currentUser.id}
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  paymentMethods={paymentMethods}
                  selectedMonth={globalMonth}
                  onMonthChange={setGlobalMonth}
                  selectedResponsible={globalResponsible}
                  onResponsibleChange={setGlobalResponsible}
                  selectedCategory={globalCategory}
                  onCategoryChange={setGlobalCategory}
                />
              )}

              {/* 3. ENTRADAS: Menu dedicado exclusivamente ao cadastro e gerenciamento de receitas */}
              {activeTab === 'income' && activeHousehold && currentUser && (
                <IncomeManager
                  householdId={activeHousehold.id}
                  currentUser={currentUser}
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  transactions={transactions}
                  paymentMethods={paymentMethods}
                  onRefresh={refreshData}
                />
              )}

              {/* 4. AJUSTES: Configurações de família, contas, meios de pagamento e categorias */}
              {activeTab === 'settings' && activeHousehold && currentUser && (
                <SettingsAndHouseholdManager
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  householdId={activeHousehold.id}
                  currentUser={currentUser}
                  onRefresh={refreshData}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* BOTÕES FLUTUANTES DINÂMICOS E ARRASTÁVEIS (QUICK ACTIONS) */}
        {activeHousehold && currentUser && (
          <DraggableFloatingActions
            containerRef={mainContainerRef}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onOpenNewTransaction={() => setIsNewTxModalOpen(true)}
          />
        )}

        {/* BARRA DE NAVEGAÇÃO INFERIOR EXCLUSIVA (4 ABAS OBJETIVAS) */}
        {activeHousehold && (
          <nav
            id="bottom-tab-bar"
            aria-label="Navegação Principal"
            className="absolute bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 px-4 pt-2 pb-5 z-20 shadow-2xl"
          >
            <div className="grid grid-cols-4 items-center">
              {/* 1. 📊 Dashboard */}
              <button
                type="button"
                id="tab-btn-dashboard"
                onClick={() => handleTabChange('dashboard')}
                className={`flex flex-col items-center justify-center py-1 min-h-[44px] transition-all cursor-pointer ${
                  activeTab === 'dashboard' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <LayoutDashboard className="w-5 h-5 mb-0.5" />
                  {activeTab === 'dashboard' && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-xs shadow-blue-400/50"
                    />
                  )}
                </div>
                <span className="text-[10px] tracking-tight">Casa</span>
              </button>

              {/* 2. 📝 Despesas */}
              <button
                type="button"
                id="tab-btn-transactions"
                onClick={() => handleTabChange('transactions')}
                className={`flex flex-col items-center justify-center py-1 min-h-[44px] transition-all cursor-pointer ${
                  activeTab === 'transactions' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Receipt className="w-5 h-5 mb-0.5" />
                  {activeTab === 'transactions' && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-xs shadow-blue-400/50"
                    />
                  )}
                </div>
                <span className="text-[10px] tracking-tight">Despesas</span>
              </button>

              {/* 3. 💰 Entradas */}
              <button
                type="button"
                id="tab-btn-income"
                onClick={() => handleTabChange('income')}
                className={`flex flex-col items-center justify-center py-1 min-h-[44px] transition-all cursor-pointer ${
                  activeTab === 'income' ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Wallet className="w-5 h-5 mb-0.5" />
                  {activeTab === 'income' && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400/50"
                    />
                  )}
                </div>
                <span className="text-[10px] tracking-tight">Receitas</span>
              </button>

              {/* 4. ⚙️ Ajustes */}
              <button
                type="button"
                id="tab-btn-settings"
                onClick={() => handleTabChange('settings')}
                className={`flex flex-col items-center justify-center py-1 min-h-[44px] transition-all cursor-pointer ${
                  activeTab === 'settings' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Settings className="w-5 h-5 mb-0.5" />
                  {activeTab === 'settings' && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-xs shadow-purple-400/50"
                    />
                  )}
                </div>
                <span className="text-[10px] tracking-tight">Ajustes</span>
              </button>
            </div>

            {/* iOS Home Indicator Bar */}
            <div className="w-full flex justify-center pt-2">
              <div className="w-32 h-1 bg-slate-600 rounded-full opacity-60"></div>
            </div>
          </nav>
        )}

        {/* Modal Nova Movimentação (Completo / Detalhado) */}
        {activeHousehold && currentUser && (
          <NewTransactionModal
            isOpen={isNewTxModalOpen}
            onClose={() => setIsNewTxModalOpen(false)}
            onSuccess={refreshData}
            householdId={activeHousehold.id}
            currentUser={currentUser}
            accounts={accounts}
            cards={cards}
            categories={categories}
            paymentMethods={paymentMethods}
          />
        )}

        {/* Modal Lançamento Rápido (<5s Flow) */}
        {activeHousehold && currentUser && (
          <QuickAddModal
            isOpen={isQuickAddOpen}
            onClose={() => setIsQuickAddOpen(false)}
            onSuccess={refreshData}
            householdId={activeHousehold.id}
            currentUser={currentUser}
            accounts={accounts}
            cards={cards}
            categories={categories}
            paymentMethods={paymentMethods}
          />
        )}
      </main>
      <PwaUpdateNotice />
    </div>
  );
};

function AuthenticatedAppBoundary() {
  const { user, isLoading } = useSupabaseAuth();

  if (isLoading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-sm font-semibold text-slate-300">Recuperando sessão segura…</div>;
  }

  if (!user) return <AuthScreen />;

  // Deliberately do not mount the legacy AuthProvider here. It initializes the
  // in-memory demo identity, which must never be confused with a Supabase user.
  return <PendingHouseholdScreen />;
}

export default function App() {
  return (
    <SupabaseAuthProvider>
      <AuthenticatedAppBoundary />
    </SupabaseAuthProvider>
  );
}
