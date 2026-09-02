import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { Account, Card, Category, User } from '../../types/index.js';
import { useAuth } from '../../context/AuthContext.js';
import { ApiService } from '../../services/api.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { AccountsManager } from './AccountsManager.js';
import { CardsManager } from './CardsManager.js';
import { CategoriesManager } from './CategoriesManager.js';
import { SqlSchemaViewer } from './SqlSchemaViewer.js';
import { SecurityAndEdgeTestSuite } from '../sprint8/SecurityAndEdgeTestSuite.js';
import { AuditLogExplorer } from '../sprint8/AuditLogExplorer.js';
import {
  Settings,
  Users,
  CreditCard,
  Wallet,
  Tag,
  ShieldCheck,
  UserPlus,
  Mail,
  Shield,
  CheckCircle2,
  Terminal,
  Database,
  FileText,
  ChevronRight,
  Sparkles,
  X,
  Lock,
  Layers,
  Check
} from 'lucide-react';

interface Props {
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  householdId: string;
  currentUser: User;
  onRefresh: () => void;
}

export const SettingsAndHouseholdManager: React.FC<Props> = ({
  accounts,
  cards,
  categories,
  householdId,
  currentUser,
  onRefresh
}) => {
  const { activeHousehold, householdMembers, refreshHousehold } = useAuth();

  // Section 2 Segmented Control: 'accounts' | 'cards'
  const [financialSection, setFinancialSection] = useState<'accounts' | 'cards'>('accounts');

  // Section 4 Dev Mode Toggle & Sub-tab
  const [devModeEnabled, setDevModeEnabled] = useState<boolean>(false);
  const [devTab, setDevTab] = useState<'tests' | 'audit' | 'sql'>('tests');

  // Invite Member Modal State
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'member'>('member');
  const [isInviting, setIsInviting] = useState<boolean>(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    try {
      setIsInviting(true);
      await ApiService.inviteHouseholdMember(householdId, currentUser.id, {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole
      });

      triggerHaptic('success');
      setInviteSuccessMsg(`Convite enviado com sucesso para ${inviteName}!`);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('member');

      await refreshHousehold();
      onRefresh();

      setTimeout(() => {
        setInviteSuccessMsg(null);
        setShowInviteModal(false);
      }, 1400);
    } catch (err: unknown) {
      console.error('Erro ao convidar membro:', err);
      triggerHaptic('error');
    } finally {
      setIsInviting(false);
    }
  };

  // Metrics for quick summary
  const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0);
  const totalLimit = cards.reduce((sum, c) => sum + (c.credit_limit || 0), 0);

  return (
    <div id="settings-household-screen" className="space-y-6 pb-12">
      {/* 0. iOS Large Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Ajustes & Contas</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Gerenciamento de família, meios de pagamento, categorias e parâmetros
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>RLS Multi-Tenant Ativo</span>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 1: DOMICÍLIO & COMPOSIÇÃO FAMILIAR                                   */}
      {/* ========================================================================= */}
      <section id="section-household" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              1. Domicílio & Composição Familiar
            </h2>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            {householdMembers.length} {householdMembers.length === 1 ? 'membro' : 'membros'}
          </span>
        </div>

        {/* Card do Domicílio */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20">
                🏡
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Grupo Familiar Ativo
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {activeHousehold?.name || 'Casa Wallace & Guilherme'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Fuso: America/Sao_Paulo (GMT-3) • Moeda: Real Brasileiro (BRL)
                </p>
              </div>
            </div>

            <button
              type="button"
              id="btn-invite-member"
              onClick={() => {
                setShowInviteModal(true);
                triggerHaptic('impact-light');
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-xs shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Convidar / Adicionar Membro</span>
            </button>
          </div>

          {/* Lista de Membros da Família */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Participantes Cadastrados
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {householdMembers.length > 0 ? (
                householdMembers.map((member) => {
                  const isWallace = member.user?.id === 'usr-wallace-001';
                  const isGuilherme = member.user?.id === 'usr-guilherme-002';
                  const initial = member.user?.name?.charAt(0) || 'M';
                  const isCurrentUser = member.user_id === currentUser.id;

                  return (
                    <div
                      key={member.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isCurrentUser
                          ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60'
                          : 'bg-slate-50/80 dark:bg-slate-850/60 border-slate-200/80 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm text-white shadow-xs shrink-0 ${
                            isWallace
                              ? 'bg-blue-600'
                              : isGuilherme
                              ? 'bg-purple-600'
                              : 'bg-slate-700'
                          }`}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {member.user?.name || 'Membro'}
                            </h4>
                            {isCurrentUser && (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-blue-600 text-white rounded-md">
                                Você
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {member.user?.email || 'membro@casafinance.app'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            member.role === 'owner'
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {member.role === 'owner' ? 'Admin / Proprietário' : 'Membro'}
                        </span>
                        <span className="block text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                          ● Ativo
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-2xl text-xs text-slate-500">
                  Carregando membros do domicílio...
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SEÇÃO 2: ENTRADAS & SAÍDAS (MEIOS DE PAGAMENTO & CONTAS)                  */}
      {/* ========================================================================= */}
      <section id="section-financial-entities" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              2. Entradas & Saídas (Fontes de Receita e Meios de Pagamento)
            </h2>
          </div>
        </div>

        {/* Card Container com Segmented Control no estilo iOS */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-5">
          {/* Segmented Control iOS */}
          <div className="flex bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl">
            <button
              type="button"
              id="tab-btn-accounts"
              onClick={() => {
                setFinancialSection('accounts');
                triggerHaptic('selection');
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                financialSection === 'accounts'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 text-blue-500" />
              <span>Contas & Carteiras ({accounts.length})</span>
            </button>

            <button
              type="button"
              id="tab-btn-cards"
              onClick={() => {
                setFinancialSection('cards');
                triggerHaptic('selection');
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                financialSection === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
              <span>Cartões de Crédito ({cards.length})</span>
            </button>
          </div>

          {/* Renderização condicional da sub-aba */}
          <AnimatePresence mode="wait">
            {financialSection === 'accounts' ? (
              <motion.div
                key="accounts-tab"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <AccountsManager
                  accounts={accounts}
                  householdId={householdId}
                  currentUser={currentUser}
                  onRefresh={onRefresh}
                />
              </motion.div>
            ) : (
              <motion.div
                key="cards-tab"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                <CardsManager
                  cards={cards}
                  householdId={householdId}
                  currentUser={currentUser}
                  onRefresh={onRefresh}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SEÇÃO 3: CATEGORIAS DE GASTOS E RECEITAS                                 */}
      {/* ========================================================================= */}
      <section id="section-categories" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              3. Categorias de Gastos e Receitas
            </h2>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            {categories.length} cadastradas
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <CategoriesManager
            categories={categories}
            householdId={householdId}
            currentUser={currentUser}
            onRefresh={onRefresh}
          />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* SEÇÃO 4: CONFIGURAÇÕES AVANÇADAS / MODO DEV (OCULTO / RESERVADO)          */}
      {/* ========================================================================= */}
      <section id="section-dev-mode" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              4. Configurações Avançadas & Diagnóstico
            </h2>
          </div>
          <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
            Ambiente Seguro
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
          {/* iOS Toggle Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Ferramentas Avançadas / Modo Desenvolvedor
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Suíte de testes de RLS, logs de auditoria contábil e DDL do banco SQL
                </p>
              </div>
            </div>

            {/* iOS Switch */}
            <button
              type="button"
              id="toggle-dev-mode"
              role="switch"
              aria-checked={devModeEnabled}
              onClick={() => {
                setDevModeEnabled(!devModeEnabled);
                triggerHaptic('impact-medium');
              }}
              className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-hidden ${
                devModeEnabled ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                  devModeEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Painel Expansível de Ferramentas Técnicas */}
          <AnimatePresence>
            {devModeEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4 overflow-hidden"
              >
                {/* Sub-tabs técnicas */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDevTab('tests');
                      triggerHaptic('selection');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      devTab === 'tests'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Suíte de Testes RLS (12)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDevTab('audit');
                      triggerHaptic('selection');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      devTab === 'audit'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Logs de Auditoria</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDevTab('sql');
                      triggerHaptic('selection');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      devTab === 'sql'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Tabelas do Banco (SQL DDL)</span>
                  </button>
                </div>

                {/* Conteúdo da ferramenta selecionada */}
                <div className="pt-2">
                  {devTab === 'tests' && <SecurityAndEdgeTestSuite />}
                  {devTab === 'audit' && (
                    <AuditLogExplorer householdId={householdId} userId={currentUser.id} />
                  )}
                  {devTab === 'sql' && <SqlSchemaViewer />}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODAL: CONVIDAR / ADICIONAR NOVO MEMBRO NA FAMÍLIA                         */}
      {/* ========================================================================= */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Convidar Novo Membro
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Adicionar participante ao domicílio "{activeHousehold?.name}"
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {inviteSuccessMsg ? (
              <div className="py-6 text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Membro Adicionado!</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{inviteSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleInviteMember} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Beatriz Lima, Carlos Silva"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    E-mail de Acesso
                  </label>
                  <input
                    type="email"
                    placeholder="membro@exemplo.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Papel no Domicílio
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInviteRole('member')}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        inviteRole === 'member'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="block text-xs font-bold">Membro</span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                        Lança e visualiza gastos
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInviteRole('owner')}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        inviteRole === 'owner'
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="block text-xs font-bold">Administrador</span>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                        Acesso total às configurações
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="flex-1 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 rounded-xl transition-all shadow-xs disabled:opacity-50"
                  >
                    {isInviting ? 'Adicionando...' : 'Adicionar Membro'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
