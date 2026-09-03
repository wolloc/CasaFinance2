import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import type {
  User,
  Household,
  HouseholdMember,
  Account,
  Card,
  PaymentMethod,
  Category,
  Transaction,
  TransactionSplit,
  InstallmentPlan,
  Installment,
  Invoice,
  Settlement,
  AuditLog,
  SettlementBalance,
  CoupleSettlementSummary,
  TransactionType,
  BeneficiaryType,
  RecurringBill,
  BillOccurrence,
  MonthlyCommitmentProjection,
  DashboardPerspective,
  DashboardFullResponse,
  DashboardSummaryData,
  DashboardCardItem,
  DashboardAccountItem,
  DashboardUpcomingCommitmentItem,
  DashboardSettlementData,
  DashboardCategoryBreakdown,
  DocumentImport,
  MerchantCategoryRule,
  ProtectedFund,
  ReserveDrainage
} from '../src/types/index.js';

// Database in-memory store with relational integrity and RLS controls
class DatabaseStore {
  public users: Map<string, User> = new Map();
  public households: Map<string, Household> = new Map();
  public householdMembers: Map<string, HouseholdMember> = new Map();
  public accounts: Map<string, Account> = new Map();
  public cards: Map<string, Card> = new Map();
  public paymentMethods: Map<string, PaymentMethod> = new Map();
  public categories: Map<string, Category> = new Map();
  public protectedFunds: Map<string, ProtectedFund> = new Map();
  public reserveDrainages: Map<string, ReserveDrainage> = new Map();
  public transactions: Map<string, Transaction> = new Map();
  public transactionSplits: Map<string, TransactionSplit> = new Map();
  public installmentPlans: Map<string, InstallmentPlan> = new Map();
  public installments: Map<string, Installment> = new Map();
  public invoices: Map<string, Invoice> = new Map();
  public settlements: Map<string, Settlement> = new Map();
  public recurringBills: Map<string, RecurringBill> = new Map();
  public billOccurrences: Map<string, BillOccurrence> = new Map();
  public documentImports: Map<string, DocumentImport> = new Map();
  public merchantCategoryRules: Map<string, MerchantCategoryRule> = new Map();
  public auditLogs: AuditLog[] = [];

  constructor() {
    this.seedInitialData();
  }

  public seedInitialData() {
    const now = new Date().toISOString();

    // 1. Users
    const wallace: User = {
      id: 'usr-wallace-001',
      name: 'Wallace',
      email: 'wallace@casafinance.app',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      created_at: now,
      updated_at: now,
      last_login_at: now
    };

    const guilherme: User = {
      id: 'usr-guilherme-002',
      name: 'Guilherme',
      email: 'guilherme@casafinance.app',
      avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
      is_active: true,
      created_at: now,
      updated_at: now,
      last_login_at: now
    };

    const externalUser: User = {
      id: 'usr-external-999',
      name: 'Usuário Externo (Invasor de Teste)',
      email: 'hacker@exemplo.com',
      avatar_url: '',
      is_active: true,
      created_at: now,
      updated_at: now
    };

    this.users.set(wallace.id, wallace);
    this.users.set(guilherme.id, guilherme);
    this.users.set(externalUser.id, externalUser);

    // 2. Households
    const mainHousehold: Household = {
      id: 'hh-wallace-gui-001',
      name: 'Casa Wallace & Guilherme',
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
      created_at: now,
      updated_at: now
    };

    const otherHousehold: Household = {
      id: 'hh-other-isolated-002',
      name: 'Grupo Isolado de Terceiros (Segurança)',
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
      created_at: now,
      updated_at: now
    };

    this.households.set(mainHousehold.id, mainHousehold);
    this.households.set(otherHousehold.id, otherHousehold);

    // 3. Household Members
    const memberW: HouseholdMember = {
      id: uuidv4(),
      household_id: mainHousehold.id,
      user_id: wallace.id,
      role: 'owner',
      joined_at: now,
      is_active: true,
      color: '#2563eb',
      avatar: wallace.avatar_url
    };

    const memberG: HouseholdMember = {
      id: uuidv4(),
      household_id: mainHousehold.id,
      user_id: guilherme.id,
      role: 'owner',
      joined_at: now,
      is_active: true,
      color: '#7c3aed',
      avatar: guilherme.avatar_url
    };

    const memberExt: HouseholdMember = {
      id: uuidv4(),
      household_id: otherHousehold.id,
      user_id: externalUser.id,
      role: 'member',
      joined_at: now,
      is_active: true,
      color: '#64748b',
      avatar: externalUser.avatar_url
    };

    this.householdMembers.set(memberW.id, memberW);
    this.householdMembers.set(memberG.id, memberG);
    this.householdMembers.set(memberExt.id, memberExt);

    // 4. Payment Methods
    const methods: PaymentMethod[] = [
      { id: 'pm-credit', code: 'credit_card', name: 'Cartão de Crédito', requires_card: true, requires_account: false },
      { id: 'pm-debit', code: 'debit_card', name: 'Cartão de Débito', requires_card: false, requires_account: true },
      { id: 'pm-pix', code: 'pix', name: 'Pix', requires_card: false, requires_account: true },
      { id: 'pm-cash', code: 'cash', name: 'Dinheiro', requires_card: false, requires_account: true },
      { id: 'pm-va', code: 'meal_benefit', name: 'Vale-Alimentação (VA)', requires_card: false, requires_account: true },
      { id: 'pm-boleto', code: 'bank_slip', name: 'Boleto', requires_card: false, requires_account: true }
    ];
    for (const m of methods) this.paymentMethods.set(m.id, m);

    // 5. Initial Accounts (Pix / Débito, VA, Carteira)
    const accNubank: Account = {
      id: 'acc-nubank-w',
      household_id: mainHousehold.id,
      owner_user_id: wallace.id,
      name: 'Pix / Débito Nubank Wallace',
      account_type: 'checking',
      institution: 'Nubank',
      initial_balance: 3500.0,
      current_balance: 3500.0,
      is_active: true,
      created_at: now,
      updated_at: now
    };

    const accItau: Account = {
      id: 'acc-itau-g',
      household_id: mainHousehold.id,
      owner_user_id: guilherme.id,
      name: 'Pix / Débito Itaú Guilherme',
      account_type: 'checking',
      institution: 'Itaú',
      initial_balance: 4200.0,
      current_balance: 4200.0,
      is_active: true,
      created_at: now,
      updated_at: now
    };

    const accVA: Account = {
      id: 'acc-va-w',
      household_id: mainHousehold.id,
      owner_user_id: wallace.id,
      name: 'VA Sodexo Wallace',
      account_type: 'meal_benefit',
      institution: 'Sodexo / Pluxee',
      initial_balance: 650.0,
      current_balance: 650.0,
      is_active: true,
      created_at: now,
      updated_at: now
    };

    const accVAGuilherme: Account = {
      id: 'acc-va-g',
      household_id: mainHousehold.id,
      owner_user_id: guilherme.id,
      name: 'VA / VR Alelo Guilherme',
      account_type: 'meal_benefit',
      institution: 'Alelo',
      initial_balance: 820.0,
      current_balance: 820.0,
      is_active: true,
      created_at: now,
      updated_at: now
    };

    this.accounts.set(accNubank.id, accNubank);
    this.accounts.set(accItau.id, accItau);
    this.accounts.set(accVA.id, accVA);
    this.accounts.set(accVAGuilherme.id, accVAGuilherme);

    // 6. Initial Cards (Porto, Infinity, Múltiplo, ITI)
    const cardPorto: Card = {
      id: 'card-porto-01',
      household_id: mainHousehold.id,
      owner_user_id: wallace.id,
      name: 'Porto',
      institution: 'Porto Seguro Bank',
      card_type: 'credit',
      credit_limit: 8000.0,
      closing_day: 10,
      due_day: 17,
      color: '#0284c7',
      is_active: true,
      created_at: now,
      updated_at: now
    };

    const cardInfinity: Card = {
      id: 'card-infinity-02',
      household_id: mainHousehold.id,
      owner_user_id: guilherme.id,
      name: 'Infinity',
      institution: 'Itaú Personnalité',
      card_type: 'credit',
      credit_limit: 20000.0,
      closing_day: 15,
      due_day: 23,
      color: '#0f172a',
      is_active: true,
      created_at: now,
      updated_at: now
    };

    const cardMultiplo: Card = {
      id: 'card-multiplo-03',
      household_id: mainHousehold.id,
      owner_user_id: wallace.id,
      name: 'Múltiplo',
      institution: 'Santander',
      card_type: 'credit',
      credit_limit: 6000.0,
      closing_day: 5,
      due_day: 12,
      color: '#dc2626',
      is_active: true,
      created_at: now,
      updated_at: now
    };

    const cardITI: Card = {
      id: 'card-iti-04',
      household_id: mainHousehold.id,
      owner_user_id: guilherme.id,
      name: 'ITI',
      institution: 'Iti Itaú',
      card_type: 'credit',
      credit_limit: 5000.0,
      closing_day: 20,
      due_day: 28,
      color: '#f97316',
      is_active: true,
      created_at: now,
      updated_at: now
    };

    this.cards.set(cardPorto.id, cardPorto);
    this.cards.set(cardInfinity.id, cardInfinity);
    this.cards.set(cardMultiplo.id, cardMultiplo);
    this.cards.set(cardITI.id, cardITI);

    // 7. Initial Categories
    const categoriesSeed = [
      { id: 'cat-fixa', name: 'Fixa', icon: 'repeat', color: '#8b5cf6' },
      { id: 'cat-casa', name: 'Casa', icon: 'home', color: '#3b82f6' },
      { id: 'cat-aluguel', name: 'Aluguel', icon: 'key', color: '#6366f1' },
      { id: 'cat-mercado', name: 'Mercado', icon: 'shopping-cart', color: '#10b981' },
      { id: 'cat-alimentacao', name: 'Alimentação', icon: 'utensils', color: '#f59e0b' },
      { id: 'cat-transporte', name: 'Transporte', icon: 'car', color: '#8b5cf6' },
      { id: 'cat-saude', name: 'Saúde', icon: 'activity', color: '#ef4444' },
      { id: 'cat-lazer', name: 'Lazer', icon: 'film', color: '#ec4899' },
      { id: 'cat-viagem', name: 'Viagem', icon: 'plane', color: '#14b8a6' },
      { id: 'cat-compras', name: 'Compras', icon: 'shopping-bag', color: '#64748b' },
      { id: 'cat-assinaturas', name: 'Assinaturas', icon: 'smartphone', color: '#a855f7' },
      { id: 'cat-educacao', name: 'Educação', icon: 'book-open', color: '#0ea5e9' },
      { id: 'cat-pessoal-w', name: 'Pessoal Wallace', icon: 'user', color: '#0284c7' },
      { id: 'cat-pessoal-g', name: 'Pessoal Guilherme', icon: 'user', color: '#7c3aed' },
      { id: 'cat-outros', name: 'Outros', icon: 'tag', color: '#94a3b8' }
    ];

    for (const c of categoriesSeed) {
      this.categories.set(c.id, {
        id: c.id,
        household_id: mainHousehold.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        type: 'expense',
        is_system: true,
        is_active: true,
        created_at: now
      });
    }

    const incomeCategoriesSeed = [
      { id: 'cat-salario', name: 'Salário & Proventos', icon: 'briefcase', color: '#10b981' },
      { id: 'cat-emprestimo', name: 'Empréstimos & Adiantamentos', icon: 'hand-coins', color: '#0ea5e9' },
      { id: 'cat-ajuda-familiar', name: 'Doações & Ajudas Familiares', icon: 'heart-handshake', color: '#f59e0b' },
      { id: 'cat-rendimentos', name: 'Rendimentos & Reservas', icon: 'trending-up', color: '#8b5cf6' },
      { id: 'cat-outras-receitas', name: 'Outras Receitas', icon: 'wallet', color: '#64748b' }
    ];

    for (const c of incomeCategoriesSeed) {
      this.categories.set(c.id, {
        id: c.id,
        household_id: mainHousehold.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        type: 'income',
        is_system: true,
        is_active: true,
        created_at: now
      });
    }

    // 8. Seed Realistic Initial Transactions
    this.seedInitialTransactions(mainHousehold.id, wallace.id, guilherme.id, now);

    // 9. Seed Recurring Bills (Despesas Fixas da Casa)
    this.seedInitialRecurringBills(mainHousehold.id, wallace.id, guilherme.id, now);

    // 10. Seed Initial Merchant Category Rules
    this.seedInitialMerchantRules(mainHousehold.id, now);

    // 11. Seed Protected Funds & Reserves
    this.seedInitialProtectedFunds(mainHousehold.id, wallace.id, guilherme.id, now);

    // Add Audit Log
    this.addAuditLog(mainHousehold.id, wallace.id, 'INSERT', 'households', mainHousehold.id, null, mainHousehold as unknown as Record<string, unknown>, 'Wallace');
  }

  private seedInitialRecurringBills(householdId: string, wallaceId: string, guilhermeId: string, now: string) {
    const currentMonth = new Date().toISOString().substring(0, 7);

    // 1. Aluguel & Condomínio (Despesa Conjunta 50/50, Débito/Pix Nubank Wallace, Vencimento dia 10)
    const bill1Id = 'bill-aluguel-001';
    const bill1: RecurringBill = {
      id: bill1Id,
      household_id: householdId,
      created_by_user_id: wallaceId,
      buyer_user_id: wallaceId,
      payer_user_id: wallaceId,
      description: 'Aluguel & Condomínio',
      merchant: 'Imobiliária QuintoAndar',
      expected_amount: 3400.0,
      due_day: 10,
      frequency: 'monthly',
      category_id: 'cat-moradia',
      payment_method_id: 'pm-pix',
      account_id: 'acc-nubank-w',
      beneficiary_type: 'both',
      is_active: true,
      auto_generate: true,
      notes: 'Aluguel do apartamento + cota condominial',
      created_at: now,
      updated_at: now
    };
    this.recurringBills.set(bill1Id, bill1);

    // 2. Internet Fibra 600MB (Despesa Conjunta 50/50, Cartão Porto Wallace, Vencimento dia 15)
    const bill2Id = 'bill-internet-002';
    const bill2: RecurringBill = {
      id: bill2Id,
      household_id: householdId,
      created_by_user_id: wallaceId,
      buyer_user_id: wallaceId,
      payer_user_id: wallaceId,
      description: 'Internet Fibra Vivo 600MB',
      merchant: 'Vivo Fibra',
      expected_amount: 149.90,
      due_day: 15,
      frequency: 'monthly',
      category_id: 'cat-moradia',
      payment_method_id: 'pm-credit',
      card_id: 'card-porto-01',
      beneficiary_type: 'both',
      is_active: true,
      auto_generate: true,
      notes: 'Banda larga de alta velocidade da casa',
      created_at: now,
      updated_at: now
    };
    this.recurringBills.set(bill2Id, bill2);

    // 3. Energia Elétrica Enel (Despesa Conjunta 50/50, Débito Itaú Guilherme, Vencimento dia 20)
    const bill3Id = 'bill-energia-003';
    const bill3: RecurringBill = {
      id: bill3Id,
      household_id: householdId,
      created_by_user_id: guilhermeId,
      buyer_user_id: guilhermeId,
      payer_user_id: guilhermeId,
      description: 'Energia Elétrica (Enel)',
      merchant: 'Enel Distribuição SP',
      expected_amount: 230.0,
      due_day: 20,
      frequency: 'monthly',
      category_id: 'cat-moradia',
      payment_method_id: 'pm-debit',
      account_id: 'acc-itau-g',
      beneficiary_type: 'both',
      is_active: true,
      auto_generate: true,
      notes: 'Conta de luz média mensal',
      created_at: now,
      updated_at: now
    };
    this.recurringBills.set(bill3Id, bill3);

    // 4. Streaming & Entretenimento (Netflix 4K + Spotify Duo, Crédito Infinity Guilherme, Vencimento dia 05)
    const bill4Id = 'bill-streaming-004';
    const bill4: RecurringBill = {
      id: bill4Id,
      household_id: householdId,
      created_by_user_id: guilhermeId,
      buyer_user_id: guilhermeId,
      payer_user_id: guilhermeId,
      description: 'Netflix 4K & Spotify Família',
      merchant: 'Netflix / Spotify',
      expected_amount: 94.80,
      due_day: 5,
      frequency: 'monthly',
      category_id: 'cat-lazer',
      payment_method_id: 'pm-credit',
      card_id: 'card-infinity-02',
      beneficiary_type: 'both',
      is_active: true,
      auto_generate: true,
      notes: 'Assinaturas conjuntas de streaming',
      created_at: now,
      updated_at: now
    };
    this.recurringBills.set(bill4Id, bill4);

    // 5. Plano de Saúde Wallace (100% Wallace, Vencimento dia 12)
    const bill5Id = 'bill-saude-w-005';
    const bill5: RecurringBill = {
      id: bill5Id,
      household_id: householdId,
      created_by_user_id: wallaceId,
      buyer_user_id: wallaceId,
      payer_user_id: wallaceId,
      description: 'Plano de Saúde Bradesco Wallace',
      merchant: 'Bradesco Saúde',
      expected_amount: 680.0,
      due_day: 12,
      frequency: 'monthly',
      category_id: 'cat-saude',
      payment_method_id: 'pm-pix',
      account_id: 'acc-nubank-w',
      beneficiary_type: 'wallace',
      is_active: true,
      auto_generate: true,
      notes: 'Convênio médico individual',
      created_at: now,
      updated_at: now
    };
    this.recurringBills.set(bill5Id, bill5);

    // Gerar ocorrências para o mês atual
    this.generateOccurrencesForMonth(householdId, currentMonth);
  }

  private seedInitialTransactions(householdId: string, wallaceId: string, guilhermeId: string, now: string) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split('T')[0];

    // Tx 1: Supermercado Zona Sul (Despesa Casal 50/50, Crédito Porto Wallace)
    const tx1Id = 'tx-seed-001';
    const tx1: Transaction = {
      id: tx1Id,
      household_id: householdId,
      created_by_user_id: wallaceId,
      buyer_user_id: wallaceId,
      payer_user_id: wallaceId,
      transaction_date: today,
      description: 'Supermercado Zona Sul (Compras do Mês)',
      merchant: 'Zona Sul Supermercados',
      total_amount: 468.90,
      transaction_type: 'expense',
      payment_method_id: 'pm-credit',
      card_id: 'card-porto-01',
      category_id: 'cat-mercado',
      beneficiary_type: 'both',
      status: 'completed',
      notes: 'Compras de mantimentos e limpeza para a casa',
      is_installment: false,
      created_at: now,
      updated_at: now
    };
    this.transactions.set(tx1Id, tx1);
    this.transactionSplits.set(`${tx1Id}-w`, {
      id: `${tx1Id}-w`,
      transaction_id: tx1Id,
      responsible_user_id: wallaceId,
      percentage: 50,
      amount: 234.45,
      created_at: now
    });
    this.transactionSplits.set(`${tx1Id}-g`, {
      id: `${tx1Id}-g`,
      transaction_id: tx1Id,
      responsible_user_id: guilhermeId,
      percentage: 50,
      amount: 234.45,
      created_at: now
    });

    // Tx 2: Almoço de Domingo Outback (Guilherme pagou no Infinity, 50/50)
    const tx2Id = 'tx-seed-002';
    const tx2: Transaction = {
      id: tx2Id,
      household_id: householdId,
      created_by_user_id: guilhermeId,
      buyer_user_id: guilhermeId,
      payer_user_id: guilhermeId,
      transaction_date: yesterday,
      description: 'Outback Steakhouse (Jantar Casal)',
      merchant: 'Outback Shopping',
      total_amount: 285.50,
      transaction_type: 'expense',
      payment_method_id: 'pm-credit',
      card_id: 'card-infinity-02',
      category_id: 'cat-alimentacao',
      beneficiary_type: 'both',
      status: 'completed',
      notes: 'Jantar especial de final de semana',
      is_installment: false,
      created_at: now,
      updated_at: now
    };
    this.transactions.set(tx2Id, tx2);
    this.transactionSplits.set(`${tx2Id}-w`, {
      id: `${tx2Id}-w`,
      transaction_id: tx2Id,
      responsible_user_id: wallaceId,
      percentage: 50,
      amount: 142.75,
      created_at: now
    });
    this.transactionSplits.set(`${tx2Id}-g`, {
      id: `${tx2Id}-g`,
      transaction_id: tx2Id,
      responsible_user_id: guilhermeId,
      percentage: 50,
      amount: 142.75,
      created_at: now
    });

    // Tx 3: Farmácia Panvel (Wallace pagou no Pix Nubank, Só Wallace 100%)
    const tx3Id = 'tx-seed-003';
    const tx3: Transaction = {
      id: tx3Id,
      household_id: householdId,
      created_by_user_id: wallaceId,
      buyer_user_id: wallaceId,
      payer_user_id: wallaceId,
      transaction_date: twoDaysAgo,
      description: 'Farmácia Panvel (Vitaminas & Medicamentos)',
      merchant: 'Panvel Farmácias',
      total_amount: 98.40,
      transaction_type: 'expense',
      payment_method_id: 'pm-pix',
      account_id: 'acc-nubank-w',
      category_id: 'cat-saude',
      beneficiary_type: 'wallace',
      status: 'completed',
      notes: 'Vitaminas pessoais Wallace',
      is_installment: false,
      created_at: now,
      updated_at: now
    };
    this.transactions.set(tx3Id, tx3);
    this.transactionSplits.set(`${tx3Id}-w`, {
      id: `${tx3Id}-w`,
      transaction_id: tx3Id,
      responsible_user_id: wallaceId,
      percentage: 100,
      amount: 98.40,
      created_at: now
    });

    // Tx 4: Almoço Executivo VA Sodexo Wallace (100% Wallace)
    const tx4Id = 'tx-seed-004';
    const tx4: Transaction = {
      id: tx4Id,
      household_id: householdId,
      created_by_user_id: wallaceId,
      buyer_user_id: wallaceId,
      payer_user_id: wallaceId,
      transaction_date: today,
      description: 'Almoço Restaurante Naturalle (VA)',
      merchant: 'Restaurante Naturalle',
      total_amount: 42.50,
      transaction_type: 'expense',
      payment_method_id: 'pm-va',
      account_id: 'acc-va-w',
      category_id: 'cat-alimentacao',
      beneficiary_type: 'wallace',
      status: 'completed',
      notes: 'Almoço no trabalho pago com Sodexo',
      is_installment: false,
      created_at: now,
      updated_at: now
    };
    this.transactions.set(tx4Id, tx4);
    this.transactionSplits.set(`${tx4Id}-w`, {
      id: `${tx4Id}-w`,
      transaction_id: tx4Id,
      responsible_user_id: wallaceId,
      percentage: 100,
      amount: 42.50,
      created_at: now
    });

    // Income Tx 1: Salário Wallace (Nubank)
    const inc1Id = 'inc-seed-001';
    const inc1: Transaction = {
      id: inc1Id,
      household_id: householdId,
      created_by_user_id: wallaceId,
      buyer_user_id: wallaceId,
      payer_user_id: wallaceId,
      transaction_date: today,
      description: 'Salário Mensal (Tech Solutions)',
      merchant: 'Tech Solutions Corp',
      total_amount: 8500.0,
      transaction_type: 'income',
      payment_method_id: 'pm-pix',
      account_id: 'acc-nubank-w',
      category_id: 'cat-salario',
      beneficiary_type: 'wallace',
      status: 'completed',
      notes: 'Crédito em conta salário Wallace',
      is_installment: false,
      created_at: now,
      updated_at: now
    };
    this.transactions.set(inc1Id, inc1);

    // Income Tx 2: Salário Guilherme (Itaú)
    const inc2Id = 'inc-seed-002';
    const inc2: Transaction = {
      id: inc2Id,
      household_id: householdId,
      created_by_user_id: guilhermeId,
      buyer_user_id: guilhermeId,
      payer_user_id: guilhermeId,
      transaction_date: today,
      description: 'Salário Mensal (Design Studio)',
      merchant: 'Design Studio Brasil',
      total_amount: 7200.0,
      transaction_type: 'income',
      payment_method_id: 'pm-pix',
      account_id: 'acc-itau-g',
      category_id: 'cat-salario',
      beneficiary_type: 'guilherme',
      status: 'completed',
      notes: 'Crédito em conta corrente Guilherme',
      is_installment: false,
      created_at: now,
      updated_at: now
    };
    this.transactions.set(inc2Id, inc2);

    // Income Tx 3: Rendimento Reserva de Emergência (CDI Nubank Wallace)
    const inc3Id = 'inc-seed-003';
    const inc3: Transaction = {
      id: inc3Id,
      household_id: householdId,
      created_by_user_id: wallaceId,
      buyer_user_id: wallaceId,
      payer_user_id: wallaceId,
      transaction_date: yesterday,
      description: 'Rendimento Caixinhas / Reserva CDI',
      merchant: 'Nu Pagamentos',
      total_amount: 142.80,
      transaction_type: 'income',
      payment_method_id: 'pm-debit',
      account_id: 'acc-nubank-w',
      category_id: 'cat-rendimentos',
      beneficiary_type: 'both',
      status: 'completed',
      notes: 'Rendimento mensal reserva financeira da casa',
      is_installment: false,
      created_at: now,
      updated_at: now
    };
    this.transactions.set(inc3Id, inc3);

    // Income Tx 4: PLR Anual Wallace (Fundo Apartamento - Protegido)
    const inc4Id = 'inc-seed-004';
    const inc4: Transaction = {
      id: inc4Id,
      household_id: householdId,
      created_by_user_id: wallaceId,
      buyer_user_id: wallaceId,
      payer_user_id: wallaceId,
      transaction_date: today,
      description: 'PLR Anual Tech Solutions (Fundo Apartamento)',
      merchant: 'Tech Solutions Corp',
      total_amount: 12000.0,
      transaction_type: 'income',
      payment_method_id: 'pm-pix',
      account_id: 'acc-nubank-w',
      category_id: 'cat-salario',
      beneficiary_type: 'wallace',
      status: 'completed',
      notes: 'PLR destinada 100% à reserva de entrada do imóvel',
      is_installment: false,
      is_protected_fund: true,
      protected_fund_tag: 'apartment',
      protected_fund_name: 'Fundo Apartamento',
      created_at: now,
      updated_at: now
    };
    this.transactions.set(inc4Id, inc4);

    // Income Tx 5: Doação Familiar Guilherme (Fundo Férias - Protegido)
    const inc5Id = 'inc-seed-005';
    const inc5: Transaction = {
      id: inc5Id,
      household_id: householdId,
      created_by_user_id: guilhermeId,
      buyer_user_id: guilhermeId,
      payer_user_id: guilhermeId,
      transaction_date: yesterday,
      description: 'Doação Pai do Guilherme (Fundo Férias)',
      merchant: 'Transferência Familiar',
      total_amount: 3500.0,
      transaction_type: 'income',
      payment_method_id: 'pm-pix',
      account_id: 'acc-itau-g',
      category_id: 'cat-ajuda-familiar',
      beneficiary_type: 'guilherme',
      status: 'completed',
      notes: 'Ajuda familiar para viagem de férias do casal',
      is_installment: false,
      is_protected_fund: true,
      protected_fund_tag: 'vacation',
      protected_fund_name: 'Fundo Férias',
      created_at: now,
      updated_at: now
    };
    this.transactions.set(inc5Id, inc5);
  }

  private seedInitialProtectedFunds(householdId: string, wallaceId: string, guilhermeId: string, now: string) {
    const today = new Date().toISOString().split('T')[0];

    const fundApt: ProtectedFund = {
      id: 'fund-apartment',
      household_id: householdId,
      name: 'Fundo Apartamento',
      icon: 'Building2',
      color: '#3b82f6',
      target_amount: 100000.0,
      current_balance: 38500.0,
      description: 'Poupança protegida para entrada e reforma do apartamento',
      created_at: now,
      updated_at: now
    };

    const fundVac: ProtectedFund = {
      id: 'fund-vacation',
      household_id: householdId,
      name: 'Fundo Férias',
      icon: 'Plane',
      color: '#10b981',
      target_amount: 15000.0,
      current_balance: 7200.0,
      description: 'Reserva para viagens de férias e passagens',
      created_at: now,
      updated_at: now
    };

    const fundInv: ProtectedFund = {
      id: 'fund-investments',
      household_id: householdId,
      name: 'Investimentos & CDI',
      icon: 'TrendingUp',
      color: '#8b5cf6',
      target_amount: 50000.0,
      current_balance: 14800.0,
      description: 'Reserva de liquidez, CDB e CDI',
      created_at: now,
      updated_at: now
    };

    this.protectedFunds.set(fundApt.id, fundApt);
    this.protectedFunds.set(fundVac.id, fundVac);
    this.protectedFunds.set(fundInv.id, fundInv);

    // Initial Drainage Seed
    const drain1: ReserveDrainage = {
      id: 'drain-seed-001',
      household_id: householdId,
      user_id: wallaceId,
      user_name: 'Wallace',
      fund_id: 'fund-vacation',
      fund_name: 'Fundo Férias',
      amount: 800.0,
      reason: 'Cobrir imprevisto na fatura de viagem',
      responsible_type: 'both',
      destination_account_id: 'acc-nubank-w',
      destination_account_name: 'Pix / Débito Nubank Wallace',
      drainage_date: today,
      created_at: now
    };
    this.reserveDrainages.set(drain1.id, drain1);
  }

  private seedInitialMerchantRules(householdId: string, now: string) {
    const defaultRules = [
      { pattern: 'mercado da serra', categoryId: 'cat-mercado' },
      { pattern: 'supermercado', categoryId: 'cat-mercado' },
      { pattern: 'pao de acucar', categoryId: 'cat-mercado' },
      { pattern: 'zona sul', categoryId: 'cat-mercado' },
      { pattern: 'carrefour', categoryId: 'cat-mercado' },
      { pattern: 'restaurante', categoryId: 'cat-alimentacao' },
      { pattern: 'ifood', categoryId: 'cat-alimentacao' },
      { pattern: 'rappi', categoryId: 'cat-alimentacao' },
      { pattern: 'uber', categoryId: 'cat-transporte' },
      { pattern: '99app', categoryId: 'cat-transporte' },
      { pattern: 'posto', categoryId: 'cat-transporte' },
      { pattern: 'drogaria', categoryId: 'cat-saude' },
      { pattern: 'farmacia', categoryId: 'cat-saude' },
      { pattern: 'bradesco saude', categoryId: 'cat-saude' },
      { pattern: 'cinema', categoryId: 'cat-lazer' },
      { pattern: 'ingresso.com', categoryId: 'cat-lazer' },
      { pattern: 'netflix', categoryId: 'cat-assinaturas' },
      { pattern: 'spotify', categoryId: 'cat-assinaturas' },
      { pattern: 'amazon prime', categoryId: 'cat-assinaturas' },
      { pattern: 'leroy merlin', categoryId: 'cat-casa' },
      { pattern: 'quintoandar', categoryId: 'cat-aluguel' },
      { pattern: 'enel', categoryId: 'cat-casa' },
      { pattern: 'vivo fibra', categoryId: 'cat-casa' }
    ];

    for (const rule of defaultRules) {
      const id = uuidv4();
      this.merchantCategoryRules.set(id, {
        id,
        household_id: householdId,
        merchant_pattern: rule.pattern.toLowerCase().trim(),
        category_id: rule.categoryId,
        created_at: now,
        updated_at: now
      });
    }
  }

  // Transactions Engine
  public getTransactionsForHousehold(householdId: string) {
    const list = Array.from(this.transactions.values()).filter(
      (t) => t.household_id === householdId
    );

    return list
      .map((t) => {
        const splits = Array.from(this.transactionSplits.values()).filter(
          (s) => s.transaction_id === t.id
        );
        const category = t.category_id ? this.categories.get(t.category_id) : null;
        const account = t.account_id ? this.accounts.get(t.account_id) : null;
        const card = t.card_id ? this.cards.get(t.card_id) : null;
        const paymentMethod = this.paymentMethods.get(t.payment_method_id);
        const buyerUser = this.users.get(t.buyer_user_id);
        const payerUser = this.users.get(t.payer_user_id);

        return {
          ...t,
          splits,
          category,
          account,
          card,
          payment_method: paymentMethod,
          buyer_user: buyerUser,
          payer_user: payerUser
        };
      })
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }

  public createTransaction(
    householdId: string,
    userId: string,
    data: {
      description: string;
      total_amount: number;
      transaction_type?: TransactionType;
      payment_method_id: string;
      account_id?: string | null;
      card_id?: string | null;
      category_id?: string | null;
      buyer_user_id: string;
      payer_user_id: string;
      beneficiary_type: BeneficiaryType;
      transaction_date?: string;
      merchant?: string;
      notes?: string;
      installments_count?: number;
      is_protected_fund?: boolean;
      protected_fund_tag?: string;
      protected_fund_name?: string;
      splits: Array<{
        responsible_user_id: string;
        percentage: number;
        amount: number;
      }>;
    }
  ) {
    if (!data.total_amount || data.total_amount <= 0) {
      throw new Error('O valor da movimentação deve ser maior que zero');
    }

    if (!data.description || data.description.trim() === '') {
      throw new Error('A descrição da movimentação é obrigatória');
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const date = data.transaction_date || now.split('T')[0];
    const isInstallment = !!(data.installments_count && data.installments_count > 1);
    const installmentCount = isInstallment ? Math.min(24, Math.max(1, data.installments_count || 1)) : 1;
    
    // Cálculo centavo a centavo exato com resíduo na 1ª parcela
    const totalCents = Math.round(Number(data.total_amount) * 100);
    const baseCents = isInstallment ? Math.floor(totalCents / installmentCount) : totalCents;
    const residueCents = isInstallment ? totalCents - (baseCents * installmentCount) : 0;
    const baseAmount = Number((baseCents / 100).toFixed(2));
    const firstInstallmentAmount = Number(((baseCents + residueCents) / 100).toFixed(2));

    const initialAmount = isInstallment ? firstInstallmentAmount : Number(data.total_amount);
    const initialDesc = isInstallment ? `${data.description.trim()} (1/${installmentCount})` : data.description.trim();

    const isProtected = !!(
      data.is_protected_fund ||
      (data.protected_fund_tag && data.protected_fund_tag !== 'free' && data.protected_fund_tag !== 'none')
    );
    const fundTag = isProtected ? (data.protected_fund_tag || 'apartment') : 'free';
    let resolvedFundName: string | undefined = undefined;

    if (isProtected) {
      const fund = Array.from(this.protectedFunds.values()).find(
        (f) =>
          f.household_id === householdId &&
          (f.id === `fund-${fundTag}` || f.id === fundTag || f.name.toLowerCase().includes(fundTag))
      );
      if (fund) {
        fund.current_balance = Number((fund.current_balance + initialAmount).toFixed(2));
        fund.updated_at = now;
        resolvedFundName = fund.name;
      } else {
        resolvedFundName =
          fundTag === 'apartment'
            ? 'Fundo Apartamento'
            : fundTag === 'vacation'
            ? 'Fundo Férias'
            : 'Investimentos & CDI';
      }
    }

    const newTx: Transaction = {
      id,
      household_id: householdId,
      created_by_user_id: userId,
      buyer_user_id: data.buyer_user_id || userId,
      payer_user_id: data.payer_user_id || userId,
      transaction_date: date,
      description: initialDesc,
      merchant: data.merchant || '',
      total_amount: initialAmount,
      transaction_type: data.transaction_type || 'expense',
      payment_method_id: data.payment_method_id,
      account_id: data.account_id || null,
      card_id: data.card_id || null,
      category_id: data.category_id || null,
      beneficiary_type: data.beneficiary_type || 'both',
      status: 'completed',
      notes: data.notes || '',
      is_installment: isInstallment,
      is_protected_fund: isProtected,
      protected_fund_tag: fundTag,
      protected_fund_name: resolvedFundName,
      created_at: now,
      updated_at: now
    };

    this.transactions.set(id, newTx);

    // Save splits for the initial transaction (1st installment or full payment)
    if (data.splits && data.splits.length > 0) {
      const calculatedSplits = this.allocateSplitsWithFirstResidue(
        initialAmount,
        data.splits.map((s) => ({ responsible_user_id: s.responsible_user_id, percentage: s.percentage }))
      );
      for (const s of calculatedSplits) {
        const splitId = uuidv4();
        const split: TransactionSplit = {
          id: splitId,
          transaction_id: id,
          responsible_user_id: s.responsible_user_id,
          percentage: Number(s.percentage),
          amount: Number(s.amount),
          created_at: now
        };
        this.transactionSplits.set(splitId, split);
      }
    } else {
      // Default 50/50 split with exact cent residue assigned to 1st responsible person (Wallace)
      const splits5050 = this.allocateSplitsWithFirstResidue(initialAmount, [
        { responsible_user_id: 'usr-wallace-001', percentage: 50 },
        { responsible_user_id: 'usr-guilherme-002', percentage: 50 }
      ]);
      for (const s of splits5050) {
        const splitId = uuidv4();
        const split: TransactionSplit = {
          id: splitId,
          transaction_id: id,
          responsible_user_id: s.responsible_user_id,
          percentage: s.percentage,
          amount: s.amount,
          created_at: now
        };
        this.transactionSplits.set(splitId, split);
      }
    }

    // Debit immediate account balance if paid via debit, pix, VA or cash (only first installment or single tx)
    if (data.account_id && this.accounts.has(data.account_id)) {
      const acc = this.accounts.get(data.account_id)!;
      if (newTx.transaction_type === 'expense') {
        acc.current_balance = Number((acc.current_balance - initialAmount).toFixed(2));
      } else if (newTx.transaction_type === 'income') {
        acc.current_balance = Number((acc.current_balance + initialAmount).toFixed(2));
      }
      acc.updated_at = now;
      this.accounts.set(acc.id, acc);
    }

    // Projeção automática de parcelas subsequentes (2/N até N/N) nos meses seguintes
    if (isInstallment && installmentCount > 1) {
      const planId = uuidv4();
      const [txYear, txMonth, txDay] = date.split('-').map(Number);
      
      const lastMonthDate = new Date(txYear, (txMonth - 1) + (installmentCount - 1), txDay || 1);
      const lastDateStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}-${String(Math.min(txDay || 1, new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0).getDate())).padStart(2, '0')}`;

      const plan: InstallmentPlan = {
        id: planId,
        transaction_id: id,
        total_amount: Number(data.total_amount),
        number_of_installments: installmentCount,
        installment_amount_base: baseAmount,
        first_installment_date: date,
        last_installment_date: lastDateStr,
        created_at: now
      };
      this.installmentPlans.set(planId, plan);

      // Parcela 1 no plano
      const inst1Id = uuidv4();
      this.installments.set(inst1Id, {
        id: inst1Id,
        installment_plan_id: planId,
        installment_number: 1,
        amount: firstInstallmentAmount,
        competence_date: date,
        due_date: date,
        status: 'billed',
        created_at: now
      });

      // Gerar parcelas 2 a N como transações com status 'pending' (Previsto) e registros de installment
      for (let i = 2; i <= installmentCount; i++) {
        const instTargetDate = new Date(txYear, (txMonth - 1) + (i - 1), txDay || 1);
        const instYear = instTargetDate.getFullYear();
        const instMonth = instTargetDate.getMonth() + 1;
        const maxDaysInInstMonth = new Date(instYear, instMonth, 0).getDate();
        const instDayClamped = Math.min(txDay || 1, maxDaysInInstMonth);
        const instDateStr = `${instYear}-${String(instMonth).padStart(2, '0')}-${String(instDayClamped).padStart(2, '0')}`;

        const instId = uuidv4();
        const inst: Installment = {
          id: instId,
          installment_plan_id: planId,
          installment_number: i,
          amount: baseAmount,
          competence_date: instDateStr,
          due_date: instDateStr,
          status: 'scheduled',
          created_at: now
        };
        this.installments.set(instId, inst);

        // Criar transação individual projetada para cada mês
        const subTxId = uuidv4();
        const subTx: Transaction = {
          id: subTxId,
          household_id: householdId,
          created_by_user_id: userId,
          buyer_user_id: data.buyer_user_id || userId,
          payer_user_id: data.payer_user_id || userId,
          transaction_date: instDateStr,
          description: `${data.description.trim()} (${i}/${installmentCount})`,
          merchant: data.merchant || '',
          total_amount: baseAmount,
          transaction_type: data.transaction_type || 'expense',
          payment_method_id: data.payment_method_id,
          account_id: data.account_id || null,
          card_id: data.card_id || null,
          category_id: data.category_id || null,
          beneficiary_type: data.beneficiary_type || 'both',
          status: 'pending', // Previsto nos meses subsequentes
          notes: `Parcela ${i}/${installmentCount} referente a ${data.description.trim()}`,
          is_installment: true,
          is_protected_fund: false,
          created_at: now,
          updated_at: now
        };
        this.transactions.set(subTxId, subTx);

        // Divisão de splits para a parcela futura projetada
        const subSplits = this.allocateSplitsWithFirstResidue(
          baseAmount,
          (data.splits && data.splits.length > 0)
            ? data.splits.map((s) => ({ responsible_user_id: s.responsible_user_id, percentage: s.percentage }))
            : [
                { responsible_user_id: 'usr-wallace-001', percentage: 50 },
                { responsible_user_id: 'usr-guilherme-002', percentage: 50 }
              ]
        );
        for (const s of subSplits) {
          const splitId = uuidv4();
          this.transactionSplits.set(splitId, {
            id: splitId,
            transaction_id: subTxId,
            responsible_user_id: s.responsible_user_id,
            percentage: Number(s.percentage),
            amount: Number(s.amount),
            created_at: now
          });
        }
      }
    }

    // Se marcado como Conta Fixa / Recorrente: registra regra recorrente automática
    if ((data as any).is_recurring) {
      try {
        const [, , d] = date.split('-').map(Number);
        this.createRecurringBill(householdId, userId, {
          description: data.description.trim(),
          merchant: data.merchant,
          expected_amount: Number(data.total_amount),
          due_day: d || 10,
          frequency: 'monthly',
          category_id: data.category_id || undefined,
          payment_method_id: data.payment_method_id,
          account_id: data.account_id || undefined,
          card_id: data.card_id || undefined,
          buyer_user_id: data.buyer_user_id,
          payer_user_id: data.payer_user_id,
          beneficiary_type: data.beneficiary_type,
          auto_generate: true
        });
      } catch (err) {
        console.warn('Erro ao configurar regra de conta fixa recorrente:', err);
      }
    }

    // Audit Log
    this.addAuditLog(
      householdId,
      userId,
      'INSERT',
      'transactions',
      id,
      null,
      newTx as unknown as Record<string, unknown>
    );

    return newTx;
  }

  public allocateSplitsWithFirstResidue(
    totalAmount: number,
    splitsData: Array<{ responsible_user_id: string; percentage: number }>
  ): Array<{ responsible_user_id: string; percentage: number; amount: number }> {
    const totalCents = Math.round(totalAmount * 100);
    const result: Array<{ responsible_user_id: string; percentage: number; amount: number }> = [];
    let allocatedCents = 0;

    for (let i = 0; i < splitsData.length; i++) {
      const s = splitsData[i];
      const userCents = Math.floor((totalCents * s.percentage) / 100);
      allocatedCents += userCents;
      result.push({
        responsible_user_id: s.responsible_user_id,
        percentage: s.percentage,
        amount: Number((userCents / 100).toFixed(2))
      });
    }

    // Residual cents (e.g. R$ 100.01 / 2 = 50.00 each + 0.01 residue) are assigned to the 1st responsible person
    const residueCents = totalCents - allocatedCents;
    if (residueCents > 0 && result.length > 0) {
      const firstPersonCents = Math.round(result[0].amount * 100) + residueCents;
      result[0].amount = Number((firstPersonCents / 100).toFixed(2));
    }

    return result;
  }

  public updateTransaction(
    householdId: string,
    userId: string,
    transactionId: string,
    data: {
      description?: string;
      merchant?: string;
      total_amount?: number;
      transaction_type?: TransactionType;
      payment_method_id?: string;
      account_id?: string | null;
      card_id?: string | null;
      category_id?: string | null;
      buyer_user_id?: string;
      payer_user_id?: string;
      beneficiary_type?: BeneficiaryType;
      transaction_date?: string;
      notes?: string;
      installments_count?: number;
      status?: 'completed' | 'pending' | 'cancelled';
      splits?: Array<{
        responsible_user_id: string;
        percentage: number;
        amount?: number;
      }>;
    }
  ) {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.household_id !== householdId) {
      throw new Error('Transação não encontrada ou sem permissão');
    }

    const oldTx = { ...tx };
    const now = new Date().toISOString();

    // 1. Revert old account balance impact (if account_id was set and was completed)
    if (oldTx.account_id && this.accounts.has(oldTx.account_id) && oldTx.status === 'completed') {
      const oldAcc = this.accounts.get(oldTx.account_id)!;
      if (oldTx.transaction_type === 'expense') {
        oldAcc.current_balance = Number((oldAcc.current_balance + oldTx.total_amount).toFixed(2));
      } else if (oldTx.transaction_type === 'income') {
        oldAcc.current_balance = Number((oldAcc.current_balance - oldTx.total_amount).toFixed(2));
      }
      oldAcc.updated_at = now;
      this.accounts.set(oldAcc.id, oldAcc);
    }

    // 2. Prepare updated fields
    const updatedAmount = data.total_amount !== undefined ? Number(data.total_amount) : tx.total_amount;
    const updatedType = data.transaction_type || tx.transaction_type;
    const updatedAccountId = data.account_id !== undefined ? data.account_id : tx.account_id;
    const updatedDate = data.transaction_date || tx.transaction_date;

    tx.description = data.description !== undefined ? data.description.trim() : tx.description;
    tx.merchant = data.merchant !== undefined ? data.merchant : tx.merchant;
    tx.total_amount = updatedAmount;
    tx.transaction_type = updatedType;
    tx.payment_method_id = data.payment_method_id || tx.payment_method_id;
    tx.account_id = updatedAccountId;
    tx.card_id = data.card_id !== undefined ? data.card_id : tx.card_id;
    tx.category_id = data.category_id !== undefined ? data.category_id : tx.category_id;
    tx.buyer_user_id = data.buyer_user_id || tx.buyer_user_id;
    tx.payer_user_id = data.payer_user_id || tx.payer_user_id;
    tx.beneficiary_type = data.beneficiary_type || tx.beneficiary_type;
    tx.transaction_date = updatedDate;
    tx.notes = data.notes !== undefined ? data.notes : tx.notes;
    if (data.status !== undefined) {
      tx.status = data.status;
    }
    tx.updated_at = now;

    // 3. Apply new account balance impact (if updatedAccountId is set and transaction is completed)
    if (updatedAccountId && this.accounts.has(updatedAccountId) && tx.status === 'completed') {
      const newAcc = this.accounts.get(updatedAccountId)!;
      if (updatedType === 'expense') {
        newAcc.current_balance = Number((newAcc.current_balance - updatedAmount).toFixed(2));
      } else if (updatedType === 'income') {
        newAcc.current_balance = Number((newAcc.current_balance + updatedAmount).toFixed(2));
      }
      newAcc.updated_at = now;
      this.accounts.set(newAcc.id, newAcc);
    }

    // 4. Recalculate and update splits
    for (const [sId, split] of this.transactionSplits.entries()) {
      if (split.transaction_id === transactionId) {
        this.transactionSplits.delete(sId);
      }
    }

    if (data.splits && data.splits.length > 0) {
      const calculatedSplits = this.allocateSplitsWithFirstResidue(
        updatedAmount,
        data.splits.map((s) => ({ responsible_user_id: s.responsible_user_id, percentage: s.percentage }))
      );
      for (const s of calculatedSplits) {
        const splitId = uuidv4();
        this.transactionSplits.set(splitId, {
          id: splitId,
          transaction_id: transactionId,
          responsible_user_id: s.responsible_user_id,
          percentage: s.percentage,
          amount: s.amount,
          created_at: now
        });
      }
    } else {
      // Default 50/50 split with 1st residue on Wallace
      const splits5050 = this.allocateSplitsWithFirstResidue(updatedAmount, [
        { responsible_user_id: 'usr-wallace-001', percentage: 50 },
        { responsible_user_id: 'usr-guilherme-002', percentage: 50 }
      ]);
      for (const s of splits5050) {
        const splitId = uuidv4();
        this.transactionSplits.set(splitId, {
          id: splitId,
          transaction_id: transactionId,
          responsible_user_id: s.responsible_user_id,
          percentage: s.percentage,
          amount: s.amount,
          created_at: now
        });
      }
    }

    this.transactions.set(transactionId, tx);

    // 5. Audit Log
    this.addAuditLog(
      householdId,
      userId,
      'UPDATE',
      'transactions',
      transactionId,
      oldTx as unknown as Record<string, unknown>,
      tx as unknown as Record<string, unknown>
    );

    return tx;
  }

  public refundTransaction(
    householdId: string,
    userId: string,
    transactionId: string,
    reason?: string
  ) {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.household_id !== householdId) {
      throw new Error('Transação não encontrada ou sem permissão');
    }

    if (tx.status === 'cancelled') {
      throw new Error('Esta movimentação já foi estornada/cancelada');
    }

    const oldTx = { ...tx };
    const now = new Date().toISOString();

    // 1. Revert account balance if applicable
    if (tx.account_id && this.accounts.has(tx.account_id) && tx.status === 'completed') {
      const acc = this.accounts.get(tx.account_id)!;
      if (tx.transaction_type === 'expense') {
        acc.current_balance = Number((acc.current_balance + tx.total_amount).toFixed(2));
      } else if (tx.transaction_type === 'income') {
        acc.current_balance = Number((acc.current_balance - tx.total_amount).toFixed(2));
      }
      acc.updated_at = now;
      this.accounts.set(acc.id, acc);
    }

    // 2. Mark as cancelled and add refund note
    tx.status = 'cancelled';
    tx.notes = `${tx.notes ? tx.notes + ' | ' : ''}[ESTORNADO em ${now.split('T')[0]}]: ${reason || 'Estorno solicitado pelo usuário'}`;
    tx.updated_at = now;
    this.transactions.set(transactionId, tx);

    // 3. Mark installments as cancelled if any
    for (const plan of this.installmentPlans.values()) {
      if (plan.transaction_id === transactionId) {
        for (const inst of this.installments.values()) {
          if (inst.installment_plan_id === plan.id) {
            inst.status = 'cancelled';
            this.installments.set(inst.id, inst);
          }
        }
      }
    }

    // 4. Audit Log
    this.addAuditLog(
      householdId,
      userId,
      'UPDATE',
      'transactions',
      transactionId,
      oldTx as unknown as Record<string, unknown>,
      tx as unknown as Record<string, unknown>
    );

    return tx;
  }

  public calculateCardInvoiceDates(
    cardId: string,
    purchaseDate: string
  ): {
    invoiceMonth: string;
    closingDate: string;
    dueDate: string;
    isAfterClosing: boolean;
  } {
    const card = this.cards.get(cardId);
    const [pYear, pMonth, pDay] = purchaseDate.split('-').map(Number);
    const closingDayConfig = card?.closing_day || 25;
    const dueDayConfig = card?.due_day || 5;

    // Max days in purchase month (e.g. Feb 28/29, Apr 30, May 31)
    const maxDaysInPurchaseMonth = new Date(pYear, pMonth, 0).getDate();
    const actualClosingDay = Math.min(closingDayConfig, maxDaysInPurchaseMonth);

    const isAfterClosing = pDay >= actualClosingDay;

    // Determine target invoice competence month
    let invYear = pYear;
    let invMonth = pMonth;
    if (isAfterClosing) {
      invMonth += 1;
      if (invMonth > 12) {
        invMonth = 1;
        invYear += 1;
      }
    }

    const invoiceMonth = `${invYear}-${String(invMonth).padStart(2, '0')}`;

    // Closing date for this invoice
    const maxDaysInInvMonth = new Date(invYear, invMonth, 0).getDate();
    const clampedClosingDay = Math.min(closingDayConfig, maxDaysInInvMonth);
    const closingDate = `${invYear}-${String(invMonth).padStart(2, '0')}-${String(clampedClosingDay).padStart(2, '0')}`;

    // Due date calculation
    let dueYear = invYear;
    let dueMonth = invMonth;
    if (dueDayConfig <= closingDayConfig) {
      dueMonth += 1;
      if (dueMonth > 12) {
        dueMonth = 1;
        dueYear += 1;
      }
    }
    const maxDaysInDueMonth = new Date(dueYear, dueMonth, 0).getDate();
    const clampedDueDay = Math.min(dueDayConfig, maxDaysInDueMonth);
    const dueDate = `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(clampedDueDay).padStart(2, '0')}`;

    return {
      invoiceMonth,
      closingDate,
      dueDate,
      isAfterClosing
    };
  }

  public deleteTransaction(householdId: string, userId: string, transactionId: string) {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.household_id !== householdId) {
      throw new Error('Transação não encontrada ou sem permissão');
    }

    // Revert account balance if applicable
    if (tx.account_id && this.accounts.has(tx.account_id)) {
      const acc = this.accounts.get(tx.account_id)!;
      if (tx.transaction_type === 'expense') {
        acc.current_balance = Number((acc.current_balance + tx.total_amount).toFixed(2));
      } else if (tx.transaction_type === 'income') {
        acc.current_balance = Number((acc.current_balance - tx.total_amount).toFixed(2));
      }
      this.accounts.set(acc.id, acc);
    }

    // Delete splits
    for (const [sId, split] of this.transactionSplits.entries()) {
      if (split.transaction_id === transactionId) {
        this.transactionSplits.delete(sId);
      }
    }

    this.transactions.delete(transactionId);

    // Audit Log
    this.addAuditLog(
      householdId,
      userId,
      'DELETE',
      'transactions',
      transactionId,
      tx as unknown as Record<string, unknown>,
      null
    );

    return { success: true };
  }

  // Security & RLS Helper
  public hasHouseholdAccess(userId: string, householdId: string): boolean {
    for (const member of this.householdMembers.values()) {
      if (member.user_id === userId && member.household_id === householdId && member.is_active) {
        return true;
      }
    }
    return false;
  }

  // Accounts CRUD
  public createAccount(householdId: string, userId: string, data: Partial<Account>): Account {
    const id = uuidv4();
    const now = new Date().toISOString();
    const initialBal = Number(data.initial_balance || 0);
    const newAccount: Account = {
      id,
      household_id: householdId,
      owner_user_id: data.owner_user_id || null,
      name: data.name || 'Nova Conta',
      account_type: data.account_type || 'checking',
      institution: data.institution || 'Outro',
      initial_balance: initialBal,
      current_balance: Number(data.current_balance !== undefined ? data.current_balance : initialBal),
      is_active: true,
      created_at: now,
      updated_at: now
    };
    this.accounts.set(id, newAccount);
    this.addAuditLog(householdId, userId, 'INSERT', 'accounts', id, null, newAccount as unknown as Record<string, unknown>);
    return newAccount;
  }

  public updateAccount(householdId: string, userId: string, accountId: string, data: Partial<Account>): Account {
    const acc = this.accounts.get(accountId);
    if (!acc || acc.household_id !== householdId) {
      throw new Error('Conta não encontrada ou sem permissão');
    }
    const oldAcc = { ...acc };
    const now = new Date().toISOString();
    const updatedAcc: Account = {
      ...acc,
      ...data,
      current_balance: data.current_balance !== undefined ? Number(data.current_balance) : acc.current_balance,
      initial_balance: data.initial_balance !== undefined ? Number(data.initial_balance) : acc.initial_balance,
      updated_at: now
    };
    this.accounts.set(accountId, updatedAcc);
    this.addAuditLog(householdId, userId, 'UPDATE', 'accounts', accountId, oldAcc as unknown as Record<string, unknown>, updatedAcc as unknown as Record<string, unknown>);
    return updatedAcc;
  }

  public deleteAccount(householdId: string, userId: string, accountId: string): { success: boolean } {
    const acc = this.accounts.get(accountId);
    if (!acc || acc.household_id !== householdId) {
      throw new Error('Conta não encontrada ou sem permissão');
    }
    const oldAcc = { ...acc };
    acc.is_active = false;
    acc.updated_at = new Date().toISOString();
    this.accounts.set(accountId, acc);
    this.addAuditLog(householdId, userId, 'DELETE', 'accounts', accountId, oldAcc as unknown as Record<string, unknown>, null);
    return { success: true };
  }

  // Cards CRUD
  public createCard(householdId: string, userId: string, data: Partial<Card>): Card {
    const id = uuidv4();
    const now = new Date().toISOString();
    const newCard: Card = {
      id,
      household_id: householdId,
      owner_user_id: data.owner_user_id || userId,
      name: data.name || 'Novo Cartão',
      institution: data.institution || 'Banco',
      card_type: 'credit',
      credit_limit: Number(data.credit_limit || 1000),
      closing_day: Number(data.closing_day || 10),
      due_day: Number(data.due_day || 17),
      color: data.color || '#2563eb',
      is_active: true,
      created_at: now,
      updated_at: now
    };
    this.cards.set(id, newCard);
    this.addAuditLog(householdId, userId, 'INSERT', 'cards', id, null, newCard as unknown as Record<string, unknown>);
    return newCard;
  }

  public updateCard(householdId: string, userId: string, cardId: string, data: Partial<Card>): Card {
    const card = this.cards.get(cardId);
    if (!card || card.household_id !== householdId) {
      throw new Error('Cartão não encontrado ou sem permissão');
    }
    const oldCard = { ...card };
    const now = new Date().toISOString();
    const updatedCard: Card = {
      ...card,
      ...data,
      credit_limit: data.credit_limit !== undefined ? Number(data.credit_limit) : card.credit_limit,
      closing_day: data.closing_day !== undefined ? Number(data.closing_day) : card.closing_day,
      due_day: data.due_day !== undefined ? Number(data.due_day) : card.due_day,
      updated_at: now
    };
    this.cards.set(cardId, updatedCard);
    this.addAuditLog(householdId, userId, 'UPDATE', 'cards', cardId, oldCard as unknown as Record<string, unknown>, updatedCard as unknown as Record<string, unknown>);
    return updatedCard;
  }

  public deleteCard(householdId: string, userId: string, cardId: string): { success: boolean } {
    const card = this.cards.get(cardId);
    if (!card || card.household_id !== householdId) {
      throw new Error('Cartão não encontrado ou sem permissão');
    }
    const oldCard = { ...card };
    card.is_active = false;
    card.updated_at = new Date().toISOString();
    this.cards.set(cardId, card);
    this.addAuditLog(householdId, userId, 'DELETE', 'cards', cardId, oldCard as unknown as Record<string, unknown>, null);
    return { success: true };
  }

  // Categories CRUD
  public createCategory(householdId: string, userId: string, data: Partial<Category>): Category {
    const id = uuidv4();
    const now = new Date().toISOString();
    const newCategory: Category = {
      id,
      household_id: householdId,
      parent_id: data.parent_id || null,
      name: data.name || 'Nova Categoria',
      icon: data.icon || 'tag',
      color: data.color || '#2563eb',
      type: data.type || 'expense',
      is_system: false,
      is_active: true,
      created_at: now
    };
    this.categories.set(id, newCategory);
    this.addAuditLog(householdId, userId, 'INSERT', 'categories', id, null, newCategory as unknown as Record<string, unknown>);
    return newCategory;
  }

  public updateCategory(householdId: string, userId: string, categoryId: string, data: Partial<Category>): Category {
    const cat = this.categories.get(categoryId);
    if (!cat || cat.household_id !== householdId) {
      throw new Error('Categoria não encontrada ou sem permissão');
    }
    const oldCat = { ...cat };
    const updatedCat: Category = {
      ...cat,
      ...data
    };
    this.categories.set(categoryId, updatedCat);
    this.addAuditLog(householdId, userId, 'UPDATE', 'categories', categoryId, oldCat as unknown as Record<string, unknown>, updatedCat as unknown as Record<string, unknown>);
    return updatedCat;
  }

  // Household Member Invitation
  public updateHousehold(householdId: string, userId: string, data: { name: string }): Household {
    const household = this.households.get(householdId);
    if (!household) throw new Error('Casa não encontrada.');
    const name = data.name?.trim();
    if (!name) throw new Error('Informe o nome da casa.');
    const updated = { ...household, name, updated_at: new Date().toISOString() };
    this.households.set(householdId, updated);
    this.addAuditLog(householdId, userId, 'UPDATE', 'households', householdId, household as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
    return updated;
  }

  public addHouseholdMember(householdId: string, userId: string, data: { name: string; email: string; role?: 'owner' | 'member'; color?: string; avatar?: string }): HouseholdMember {
    const activeMembers = [...this.householdMembers.values()].filter((member) => member.household_id === householdId && member.is_active);
    if (activeMembers.length >= 2) throw new Error('A experiência principal aceita no máximo dois membros ativos.');
    const now = new Date().toISOString();
    const newUserId = uuidv4();
    const newUser: User = {
      id: newUserId,
      name: data.name,
      email: data.email,
      avatar_url: data.avatar || '',
      is_active: true,
      created_at: now,
      updated_at: now,
      last_login_at: now
    };
    this.users.set(newUserId, newUser);

    const memberId = uuidv4();
    const newMember: HouseholdMember = {
      id: memberId,
      household_id: householdId,
      user_id: newUserId,
      role: data.role || 'member',
      joined_at: now,
      is_active: true,
      color: data.color || '#0f766e',
      avatar: data.avatar || '',
      user: newUser
    };
    this.householdMembers.set(memberId, newMember);
    this.addAuditLog(householdId, userId, 'INSERT', 'household_members', memberId, null, newMember as unknown as Record<string, unknown>);
    return newMember;
  }

  public updateHouseholdMember(householdId: string, userId: string, memberId: string, data: { name?: string; role?: 'owner' | 'member'; color?: string; avatar?: string; is_active?: boolean }): HouseholdMember {
    const member = this.householdMembers.get(memberId);
    if (!member || member.household_id !== householdId) throw new Error('Membro não encontrado.');
    if (data.is_active === true && !member.is_active) {
      const activeCount = [...this.householdMembers.values()].filter((item) => item.household_id === householdId && item.is_active).length;
      if (activeCount >= 2) throw new Error('Desative um membro antes de ativar outro.');
    }
    const user = this.users.get(member.user_id);
    if (!user) throw new Error('Usuário do membro não encontrado.');
    const updatedUser = { ...user, name: data.name?.trim() || user.name, avatar_url: data.avatar ?? user.avatar_url, is_active: data.is_active ?? user.is_active, updated_at: new Date().toISOString() };
    const updated = { ...member, role: data.role ?? member.role, color: data.color ?? member.color, avatar: data.avatar ?? member.avatar, is_active: data.is_active ?? member.is_active, user: updatedUser };
    this.users.set(user.id, updatedUser);
    this.householdMembers.set(memberId, updated);
    this.addAuditLog(householdId, userId, 'UPDATE', 'household_members', memberId, member as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
    return updated;
  }

  public calculateInvoiceMonth(purchaseDate: string, closingDay: number): string {
    const parts = purchaseDate.split('-');
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    // If purchase was made on or after closing day, it belongs to next month invoice
    if (day >= closingDay) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  public addAuditLog(
    householdId: string,
    userId: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'SWITCH_USER',
    entityName: string,
    entityId: string,
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null,
    userName?: string
  ) {
    const log: AuditLog = {
      id: uuidv4(),
      household_id: householdId,
      user_id: userId,
      user_name: userName || this.users.get(userId)?.name || 'Sistema',
      action,
      entity_name: entityName,
      entity_id: entityId,
      table_name: entityName,
      record_id: entityId,
      old_values: oldValues,
      new_values: newValues,
      old_data: oldValues,
      new_data: newValues,
      created_at: new Date().toISOString()
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
  }

  // ==========================================================================
  // SPRINT 7: COUPLE SETTLEMENT MODULE & ACCOUNTING COMPENSATION ALGORITHM
  // ==========================================================================

  // Calculate settlement balance between Wallace and Guilherme
  public calculateSettlement(householdId: string): SettlementBalance[] {
    const detailed = this.getDetailedCoupleSettlement(householdId);
    return [detailed.wallace, detailed.guilherme];
  }

  public getDetailedCoupleSettlement(householdId: string, competenceMonth?: string): CoupleSettlementSummary {
    const wallaceUser = this.users.get('usr-wallace-001') || {
      id: 'usr-wallace-001',
      name: 'Wallace',
      email: 'wallace@casafinance.app',
      pix_key: 'wallace@casafinance.app'
    };
    const guilhermeUser = this.users.get('usr-guilherme-002') || {
      id: 'usr-guilherme-002',
      name: 'Guilherme',
      email: 'guilherme@casafinance.app',
      pix_key: '11999887766'
    };

    const wallaceBalance: SettlementBalance = {
      user_id: wallaceUser.id,
      user_name: wallaceUser.name,
      total_paid: 0,
      total_responsibility: 0,
      net_balance: 0
    };

    const guilhermeBalance: SettlementBalance = {
      user_id: guilhermeUser.id,
      user_name: guilhermeUser.name,
      total_paid: 0,
      total_responsibility: 0,
      net_balance: 0
    };

    const contributingTxs: Array<{
      id: string;
      transaction_date: string;
      description: string;
      merchant?: string;
      category_name: string;
      category_color: string;
      payer_name: string;
      payer_user_id: string;
      buyer_name: string;
      total_amount: number;
      beneficiary_type: BeneficiaryType;
      wallace_share: number;
      guilherme_share: number;
    }> = [];

    // 1. Iterate completed expense transactions (STRICTLY excluding 'transfer' and 'invoice_payment')
    for (const t of this.transactions.values()) {
      if (
        t.household_id === householdId &&
        t.status === 'completed' &&
        t.transaction_type === 'expense'
      ) {
        // Filter by competence month if specified
        if (competenceMonth && !t.transaction_date.startsWith(competenceMonth)) {
          continue;
        }

        // Sum paid amounts
        if (t.payer_user_id === wallaceUser.id) {
          wallaceBalance.total_paid += t.total_amount;
        } else if (t.payer_user_id === guilhermeUser.id) {
          guilhermeBalance.total_paid += t.total_amount;
        }

        // Get splits for this transaction
        const splits = Array.from(this.transactionSplits.values()).filter(
          (s) => s.transaction_id === t.id
        );

        let wShare = 0;
        let gShare = 0;

        for (const s of splits) {
          if (s.responsible_user_id === wallaceUser.id) {
            wallaceBalance.total_responsibility += s.amount;
            wShare += s.amount;
          } else if (s.responsible_user_id === guilhermeUser.id) {
            guilhermeBalance.total_responsibility += s.amount;
            gShare += s.amount;
          }
        }

        // Add to contributing transactions list for auditability
        const cat = t.category_id ? this.categories.get(t.category_id) : null;
        const payer = this.users.get(t.payer_user_id);
        const buyerOpt = this.users.get(t.buyer_user_id);

        contributingTxs.push({
          id: t.id,
          transaction_date: t.transaction_date,
          description: t.description,
          merchant: t.merchant,
          category_name: cat?.name || 'Geral',
          category_color: cat?.color || '#64748b',
          payer_name: payer?.name || 'Wallace',
          payer_user_id: t.payer_user_id,
          buyer_name: buyerOpt?.name || 'Wallace',
          total_amount: t.total_amount,
          beneficiary_type: t.beneficiary_type,
          wallace_share: Number(wShare.toFixed(2)),
          guilherme_share: Number(gShare.toFixed(2))
        });
      }
    }

    // 2. Apply completed settlements (Liquidações do período ou acumuladas)
    const settlementHistory: any[] = [];
    for (const set of this.settlements.values()) {
      if (set.household_id === householdId && set.status === 'completed') {
        if (!competenceMonth || set.settlement_date.startsWith(competenceMonth)) {
          if (set.payer_user_id === wallaceUser.id) {
            wallaceBalance.total_paid += set.settled_amount;
            guilhermeBalance.total_responsibility += set.settled_amount;
          } else if (set.payer_user_id === guilhermeUser.id) {
            guilhermeBalance.total_paid += set.settled_amount;
            wallaceBalance.total_responsibility += set.settled_amount;
          }
        }

        const payer = this.users.get(set.payer_user_id);
        const receiver = this.users.get(set.receiver_user_id);
        settlementHistory.push({
          id: set.id,
          settlement_date: set.settlement_date,
          payer_id: set.payer_user_id,
          payer_name: payer?.name || 'Wallace',
          receiver_id: set.receiver_user_id,
          receiver_name: receiver?.name || 'Guilherme',
          settled_amount: set.settled_amount,
          status: set.status,
          notes: set.notes,
          created_at: set.created_at
        });
      }
    }

    // 3. Final Net Balances ($Pagos - Devidos$)
    wallaceBalance.total_paid = Number(wallaceBalance.total_paid.toFixed(2));
    wallaceBalance.total_responsibility = Number(wallaceBalance.total_responsibility.toFixed(2));
    wallaceBalance.net_balance = Number((wallaceBalance.total_paid - wallaceBalance.total_responsibility).toFixed(2));

    guilhermeBalance.total_paid = Number(guilhermeBalance.total_paid.toFixed(2));
    guilhermeBalance.total_responsibility = Number(guilhermeBalance.total_responsibility.toFixed(2));
    guilhermeBalance.net_balance = Number((guilhermeBalance.total_paid - guilhermeBalance.total_responsibility).toFixed(2));

    // 4. Compensation Direction & Amount
    let compensationStatus: 'settled' | 'guilherme_owes_wallace' | 'wallace_owes_guilherme' = 'settled';
    let amountToPay = 0;
    let debtorId: string | null = null;
    let debtorName: string | null = null;
    let creditorId: string | null = null;
    let creditorName: string | null = null;
    let pixKey: string | null = null;
    let summaryText = 'Contas perfeitamente equilibradas! Ninguém deve nada no momento.';

    if (wallaceBalance.net_balance > 0.01) {
      compensationStatus = 'guilherme_owes_wallace';
      amountToPay = Number(wallaceBalance.net_balance.toFixed(2));
      debtorId = guilhermeUser.id;
      debtorName = guilhermeUser.name;
      creditorId = wallaceUser.id;
      creditorName = wallaceUser.name;
      pixKey = wallaceUser.pix_key || 'wallace@casafinance.app';
      summaryText = `Guilherme deve transferir R$ ${amountToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para Wallace via Pix para zerar as contas.`;
    } else if (guilhermeBalance.net_balance > 0.01) {
      compensationStatus = 'wallace_owes_guilherme';
      amountToPay = Number(guilhermeBalance.net_balance.toFixed(2));
      debtorId = wallaceUser.id;
      debtorName = wallaceUser.name;
      creditorId = guilhermeUser.id;
      creditorName = guilhermeUser.name;
      pixKey = guilhermeUser.pix_key || '11999887766';
      summaryText = `Wallace deve transferir R$ ${amountToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para Guilherme via Pix para zerar as contas.`;
    }

    return {
      household_id: householdId,
      competence_month: competenceMonth,
      wallace: wallaceBalance,
      guilherme: guilhermeBalance,
      compensation: {
        status: compensationStatus,
        amount_to_pay: amountToPay,
        debtor_id: debtorId,
        debtor_name: debtorName,
        creditor_id: creditorId,
        creditor_name: creditorName,
        pix_key: pixKey,
        summary_text: summaryText
      },
      contributing_transactions: contributingTxs.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
      settlement_history: settlementHistory.sort((a, b) => b.settlement_date.localeCompare(a.settlement_date))
    };
  }

  public recordCoupleSettlement(
    householdId: string,
    userId: string,
    data: {
      payer_user_id: string;
      receiver_user_id: string;
      settled_amount: number;
      notes?: string;
      payment_method_id?: string;
    }
  ) {
    if (data.settled_amount <= 0) {
      throw new Error('O valor do acerto deve ser maior que zero.');
    }

    const now = new Date().toISOString();
    const id = uuidv4();
    const settlementDate = now.split('T')[0];

    const settlement: Settlement = {
      id,
      household_id: householdId,
      settlement_date: settlementDate,
      payer_user_id: data.payer_user_id,
      receiver_user_id: data.receiver_user_id,
      settled_amount: Number(data.settled_amount),
      status: 'completed',
      notes: data.notes || 'Acerto de contas entre o casal realizado via Pix',
      created_at: now
    };

    this.settlements.set(id, settlement);

    const user = this.users.get(userId);
    this.addAuditLog(
      householdId,
      userId,
      'INSERT',
      'settlements',
      id,
      null,
      settlement as unknown as Record<string, unknown>,
      user?.name
    );

    const updatedSummary = this.getDetailedCoupleSettlement(householdId);
    return { settlement, summary: updatedSummary };
  }

  // ==========================================================================
  // SPRINT 6: RECURRING BILLS, OCCURRENCES & FUTURE COMMITMENT PROJECTION
  // ==========================================================================

  public getRecurringBillsForHousehold(householdId: string) {
    return Array.from(this.recurringBills.values())
      .filter((b) => b.household_id === householdId)
      .map((bill) => {
        const cat = bill.category_id ? this.categories.get(bill.category_id) : null;
        const buyer = this.users.get(bill.buyer_user_id);
        const payer = this.users.get(bill.payer_user_id);
        const card = bill.card_id ? this.cards.get(bill.card_id) : null;
        const acc = bill.account_id ? this.accounts.get(bill.account_id) : null;

        return {
          ...bill,
          category_name: cat?.name || 'Geral',
          category_color: cat?.color || '#64748b',
          category_icon: cat?.icon || 'FileText',
          buyer_name: buyer?.name || 'Wallace',
          payer_name: payer?.name || 'Wallace',
          card_name: card?.name,
          account_name: acc?.name
        };
      })
      .sort((a, b) => a.due_day - b.due_day);
  }

  public createRecurringBill(
    householdId: string,
    userId: string,
    data: {
      description: string;
      merchant?: string;
      expected_amount: number;
      due_day: number;
      frequency?: 'monthly' | 'yearly' | 'weekly';
      category_id?: string;
      payment_method_id: string;
      account_id?: string;
      card_id?: string;
      buyer_user_id: string;
      payer_user_id: string;
      beneficiary_type: BeneficiaryType;
      wallace_percentage?: number;
      auto_generate?: boolean;
      projection_months?: number;
      notes?: string;
    }
  ) {
    const description = data.description?.trim();
    const expectedAmount = Number(data.expected_amount);
    const dueDay = Math.trunc(Number(data.due_day));
    const buyerUserId = data.buyer_user_id || userId;
    const payerUserId = data.payer_user_id || userId;
    const validBeneficiaryTypes: BeneficiaryType[] = ['both', 'wallace', 'guilherme', 'custom'];

    if (!description) throw new Error('Descrição da conta fixa é obrigatória');
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      throw new Error('Valor da conta fixa deve ser maior que zero');
    }
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      throw new Error('Dia de vencimento deve estar entre 1 e 31');
    }
    if (!this.paymentMethods.has(data.payment_method_id)) {
      throw new Error('Meio de pagamento inválido');
    }
    if (!this.hasHouseholdAccess(buyerUserId, householdId) || !this.hasHouseholdAccess(payerUserId, householdId)) {
      throw new Error('Comprador e pagador devem pertencer à casa');
    }
    if (data.category_id) {
      const category = this.categories.get(data.category_id);
      if (!category || category.household_id !== householdId || !category.is_active) {
        throw new Error('Categoria inválida para esta casa');
      }
    }
    if (data.account_id) {
      const account = this.accounts.get(data.account_id);
      if (!account || account.household_id !== householdId || !account.is_active) {
        throw new Error('Conta inválida para esta casa');
      }
    }
    if (data.card_id) {
      const card = this.cards.get(data.card_id);
      if (!card || card.household_id !== householdId || !card.is_active) {
        throw new Error('Cartão inválido para esta casa');
      }
    }
    if (!validBeneficiaryTypes.includes(data.beneficiary_type)) {
      throw new Error('Divisão de responsabilidade inválida');
    }

    const now = new Date().toISOString();
    const id = uuidv4();
    const bill: RecurringBill = {
      id,
      household_id: householdId,
      created_by_user_id: userId,
      buyer_user_id: buyerUserId,
      payer_user_id: payerUserId,
      description,
      merchant: data.merchant,
      expected_amount: expectedAmount,
      due_day: dueDay,
      frequency: data.frequency || 'monthly',
      category_id: data.category_id || null,
      payment_method_id: data.payment_method_id,
      account_id: data.account_id || null,
      card_id: data.card_id || null,
      beneficiary_type: data.beneficiary_type || 'both',
      wallace_percentage:
        data.beneficiary_type === 'custom'
          ? Math.min(100, Math.max(0, Number(data.wallace_percentage) || 50))
          : undefined,
      is_active: true,
      auto_generate: data.auto_generate !== false,
      notes: data.notes,
      created_at: now,
      updated_at: now
    };

    this.recurringBills.set(id, bill);

    // Automatically generate occurrence for the current month AND projected future months
    const requestedProjectionMonths = Number(data.projection_months);
    const projectionMonths = Number.isFinite(requestedProjectionMonths)
      ? Math.min(60, Math.max(1, Math.trunc(requestedProjectionMonths)))
      : 12;
    const householdTimeZone = this.households.get(householdId)?.timezone || 'America/Sao_Paulo';
    const competenceParts = new Intl.DateTimeFormat('en-US', {
      timeZone: householdTimeZone,
      year: 'numeric',
      month: '2-digit'
    }).formatToParts(new Date());
    const curYearStr = competenceParts.find((part) => part.type === 'year')?.value || String(new Date().getUTCFullYear());
    const curMonthStr = competenceParts.find((part) => part.type === 'month')?.value || String(new Date().getUTCMonth() + 1);
    let curYear = parseInt(curYearStr, 10);
    let curMonth = parseInt(curMonthStr, 10);

    for (let i = 0; i < projectionMonths; i++) {
      let m = curMonth + i;
      let y = curYear;
      while (m > 12) {
        m -= 12;
        y += 1;
      }
      const monthKey = `${y}-${String(m).padStart(2, '0')}`;
      this.generateOccurrencesForMonth(householdId, monthKey, id);
    }

    const user = this.users.get(userId);
    this.addAuditLog(householdId, userId, 'INSERT', 'recurring_bills', id, null, bill as unknown as Record<string, unknown>, user?.name);

    return bill;
  }

  public toggleRecurringBillActive(householdId: string, userId: string, billId: string) {
    const bill = this.recurringBills.get(billId);
    if (!bill || bill.household_id !== householdId) {
      throw new Error('Conta recorrente não encontrada');
    }

    const oldData = { ...bill };
    bill.is_active = !bill.is_active;
    bill.updated_at = new Date().toISOString();

    const user = this.users.get(userId);
    this.addAuditLog(householdId, userId, 'UPDATE', 'recurring_bills', billId, oldData as unknown as Record<string, unknown>, bill as unknown as Record<string, unknown>, user?.name);

    return bill;
  }

  public deleteRecurringBill(householdId: string, userId: string, billId: string) {
    const bill = this.recurringBills.get(billId);
    if (!bill || bill.household_id !== householdId) {
      throw new Error('Conta recorrente não encontrada');
    }

    this.recurringBills.delete(billId);

    // Delete future uncompleted occurrences
    for (const [occId, occ] of this.billOccurrences.entries()) {
      if (occ.recurring_bill_id === billId && occ.status === 'pending') {
        this.billOccurrences.delete(occId);
      }
    }

    const user = this.users.get(userId);
    this.addAuditLog(householdId, userId, 'DELETE', 'recurring_bills', billId, bill as unknown as Record<string, unknown>, null, user?.name);

    return { success: true };
  }

  public generateOccurrencesForMonth(householdId: string, monthYear: string, recurringBillId?: string) {
    const now = new Date().toISOString();
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    let createdCount = 0;
    const bills = Array.from(this.recurringBills.values()).filter(
      (b) =>
        b.household_id === householdId &&
        b.is_active &&
        b.auto_generate &&
        (!recurringBillId || b.id === recurringBillId)
    );

    for (const bill of bills) {
      // Check if already exists for this month
      const exists = Array.from(this.billOccurrences.values()).some(
        (o) => o.recurring_bill_id === bill.id && o.competence_month === monthYear
      );

      if (!exists) {
        const occId = uuidv4();
        // Handle max days in month (e.g. Feb 28/29, Apr 30)
        const maxDaysInMonth = new Date(year, month, 0).getDate();
        const dueDayClamped = Math.min(bill.due_day, maxDaysInMonth);
        const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(dueDayClamped).padStart(2, '0')}`;

        const occ: BillOccurrence = {
          id: occId,
          recurring_bill_id: bill.id,
          household_id: householdId,
          competence_month: monthYear,
          due_date: dueDate,
          amount: bill.expected_amount,
          status: 'pending',
          payment_method_id: bill.payment_method_id,
          account_id: bill.account_id,
          card_id: bill.card_id,
          payer_user_id: bill.payer_user_id,
          buyer_user_id: bill.buyer_user_id,
          beneficiary_type: bill.beneficiary_type,
          wallace_percentage: bill.wallace_percentage,
          category_id: bill.category_id,
          description: bill.description,
          created_at: now
        };

        this.billOccurrences.set(occId, occ);
        createdCount++;
      }
    }

    return createdCount;
  }

  public getOccurrencesForMonth(householdId: string, monthYear: string) {
    // Ensure occurrences are generated for this month
    this.generateOccurrencesForMonth(householdId, monthYear);

    const occurrences = Array.from(this.billOccurrences.values())
      .filter((o) => o.household_id === householdId && o.competence_month === monthYear)
      .map((occ) => {
        const bill = this.recurringBills.get(occ.recurring_bill_id);
        const catId = occ.category_id || bill?.category_id;
        const cat = catId ? this.categories.get(catId) : null;
        const buyerId = occ.buyer_user_id || bill?.buyer_user_id || 'usr-wallace-001';
        const payerId = occ.payer_user_id || bill?.payer_user_id || 'usr-wallace-001';
        const buyer = this.users.get(buyerId);
        const payer = this.users.get(payerId);

        return {
          ...occ,
          recurring_bill: bill,
          description: occ.description || bill?.description || 'Conta Fixa',
          title: occ.description || bill?.description || bill?.merchant || 'Conta Fixa',
          merchant: bill?.merchant || occ.description || 'Conta Fixa',
          category_id: catId,
          category_name: cat?.name || 'Fixa',
          category_color: cat?.color || '#8b5cf6',
          buyer_name: buyer?.name || 'Wallace',
          payer_name: payer?.name || 'Wallace',
          buyer_user_id: buyerId,
          payer_user_id: payerId,
          beneficiary_type: occ.beneficiary_type || bill?.beneficiary_type || 'both',
          payment_method_id: occ.payment_method_id || bill?.payment_method_id || 'pm-pix',
          account_id: occ.account_id !== undefined ? occ.account_id : bill?.account_id,
          card_id: occ.card_id !== undefined ? occ.card_id : bill?.card_id
        };
      })
      .sort((a, b) => a.due_date.localeCompare(b.due_date));

    return occurrences;
  }

  public updateBillOccurrence(
    householdId: string,
    userId: string,
    occurrenceId: string,
    data: Partial<BillOccurrence>
  ): BillOccurrence {
    const occ = this.billOccurrences.get(occurrenceId);
    if (!occ || occ.household_id !== householdId) {
      throw new Error('Ocorrência de conta fixa não encontrada');
    }
    const oldOcc = { ...occ };
    const now = new Date().toISOString();

    if (data.amount !== undefined) occ.amount = Number(data.amount);
    if (data.due_date !== undefined) occ.due_date = data.due_date;
    if (data.status !== undefined) occ.status = data.status;
    if (data.payment_method_id !== undefined) occ.payment_method_id = data.payment_method_id;
    if (data.account_id !== undefined) occ.account_id = data.account_id;
    if (data.card_id !== undefined) occ.card_id = data.card_id;
    if (data.payer_user_id !== undefined) occ.payer_user_id = data.payer_user_id;
    if (data.buyer_user_id !== undefined) occ.buyer_user_id = data.buyer_user_id;
    if (data.beneficiary_type !== undefined) occ.beneficiary_type = data.beneficiary_type;
    if (data.wallace_percentage !== undefined) {
      occ.wallace_percentage = Math.min(100, Math.max(0, Number(data.wallace_percentage) || 50));
    }
    if (data.description !== undefined) occ.description = data.description;
    if (data.category_id !== undefined) occ.category_id = data.category_id;

    // Se já foi marcada como paga e possui transação correspondente, atualiza a transação também
    if (occ.paid_transaction_id && this.transactions.has(occ.paid_transaction_id)) {
      const tx = this.transactions.get(occ.paid_transaction_id)!;
      tx.total_amount = occ.amount;
      if (occ.due_date) tx.transaction_date = occ.due_date;
      if (occ.payment_method_id) tx.payment_method_id = occ.payment_method_id;
      if (occ.account_id !== undefined) tx.account_id = occ.account_id;
      if (occ.card_id !== undefined) tx.card_id = occ.card_id;
      if (occ.payer_user_id) tx.payer_user_id = occ.payer_user_id;
      if (occ.buyer_user_id) tx.buyer_user_id = occ.buyer_user_id;
      if (occ.beneficiary_type) tx.beneficiary_type = occ.beneficiary_type;
      if (occ.description) tx.description = `[Conta Fixa] ${occ.description}`;
      if (occ.category_id) tx.category_id = occ.category_id;
      tx.updated_at = now;
      this.transactions.set(tx.id, tx);
    }

    const user = this.users.get(userId);
    this.addAuditLog(
      householdId,
      userId,
      'UPDATE',
      'bill_occurrences',
      occurrenceId,
      oldOcc as unknown as Record<string, unknown>,
      occ as unknown as Record<string, unknown>,
      user?.name
    );

    return occ;
  }

  public markOccurrenceAsPaid(householdId: string, userId: string, occurrenceId: string) {
    const occ = this.billOccurrences.get(occurrenceId);
    if (!occ || occ.household_id !== householdId) {
      throw new Error('Ocorrência não encontrada');
    }

    if (occ.status === 'paid' || occ.paid_transaction_id) {
      throw new Error('Esta ocorrência já foi paga');
    }

    const bill = this.recurringBills.get(occ.recurring_bill_id);
    const now = new Date().toISOString();

    const finalAmount = occ.amount;
    const finalPaymentMethod = occ.payment_method_id || bill?.payment_method_id || 'pm-pix';
    const finalAccountId = occ.account_id !== undefined ? occ.account_id : bill?.account_id;
    const finalCardId = occ.card_id !== undefined ? occ.card_id : bill?.card_id;
    const finalBuyer = occ.buyer_user_id || bill?.buyer_user_id || userId;
    const finalPayer = occ.payer_user_id || bill?.payer_user_id || userId;
    const finalBeneficiary = occ.beneficiary_type || bill?.beneficiary_type || 'both';
    const finalWallacePercentage = Math.min(
      100,
      Math.max(0, Number(occ.wallace_percentage ?? bill?.wallace_percentage) || 50)
    );
    const finalCategoryId = occ.category_id !== undefined ? occ.category_id : bill?.category_id;
    const finalDescription = occ.description || bill?.description || 'Conta Fixa';

    // 1. Create completed transaction in ledger
    const txId = uuidv4();
    const tx: Transaction = {
      id: txId,
      household_id: householdId,
      created_by_user_id: userId,
      buyer_user_id: finalBuyer,
      payer_user_id: finalPayer,
      transaction_date: occ.due_date,
      description: `[Conta Fixa] ${finalDescription}`,
      merchant: bill?.merchant || finalDescription,
      total_amount: finalAmount,
      transaction_type: 'expense',
      payment_method_id: finalPaymentMethod,
      account_id: finalAccountId,
      card_id: finalCardId,
      category_id: finalCategoryId,
      beneficiary_type: finalBeneficiary,
      status: 'completed',
      notes: `Ocorrência referente ao mês de competência ${occ.competence_month}`,
      is_installment: false,
      created_at: now,
      updated_at: now
    };
    this.transactions.set(txId, tx);

    // Create splits
    const wallaceId = 'usr-wallace-001';
    const guilhermeId = 'usr-guilherme-002';
    if (finalBeneficiary === 'both') {
      const half = Number((finalAmount / 2).toFixed(2));
      this.transactionSplits.set(`${txId}-w`, {
        id: `${txId}-w`,
        transaction_id: txId,
        responsible_user_id: wallaceId,
        percentage: 50,
        amount: half,
        created_at: now
      });
      this.transactionSplits.set(`${txId}-g`, {
        id: `${txId}-g`,
        transaction_id: txId,
        responsible_user_id: guilhermeId,
        percentage: 50,
        amount: Number((finalAmount - half).toFixed(2)),
        created_at: now
      });
    } else if (finalBeneficiary === 'custom') {
      const totalCents = Math.round(finalAmount * 100);
      const wallaceCents = Math.round((totalCents * finalWallacePercentage) / 100);
      const guilhermeCents = totalCents - wallaceCents;

      this.transactionSplits.set(`${txId}-w`, {
        id: `${txId}-w`,
        transaction_id: txId,
        responsible_user_id: wallaceId,
        percentage: finalWallacePercentage,
        amount: wallaceCents / 100,
        created_at: now
      });
      this.transactionSplits.set(`${txId}-g`, {
        id: `${txId}-g`,
        transaction_id: txId,
        responsible_user_id: guilhermeId,
        percentage: 100 - finalWallacePercentage,
        amount: guilhermeCents / 100,
        created_at: now
      });
    } else {
      const respId = finalBeneficiary === 'guilherme' ? guilhermeId : wallaceId;
      this.transactionSplits.set(`${txId}-resp`, {
        id: `${txId}-resp`,
        transaction_id: txId,
        responsible_user_id: respId,
        percentage: 100,
        amount: finalAmount,
        created_at: now
      });
    }

    // Update occurrence state
    occ.status = 'paid';
    occ.paid_transaction_id = txId;
    occ.paid_at = now;

    // Deduct account balance if paid from debit/pix/cash
    if (finalAccountId) {
      const acc = this.accounts.get(finalAccountId);
      if (acc) {
        acc.current_balance = Number((acc.current_balance - occ.amount).toFixed(2));
        acc.updated_at = now;
      }
    }

    const user = this.users.get(userId);
    this.addAuditLog(householdId, userId, 'UPDATE', 'bill_occurrences', occurrenceId, { status: 'pending' }, { status: 'paid', txId }, user?.name);

    return { occurrence: occ, transaction: tx };
  }

  // Multi-Month Future Commitment Projections (+1m, +3m, +6m, +12m)
  public getFutureCommitmentsProjection(
    householdId: string,
    monthsAhead: number = 12,
    targetUserId?: string | null,
    startMonthYear?: string
  ) {
    const baseDate = startMonthYear
      ? new Date(parseInt(startMonthYear.split('-')[0], 10), parseInt(startMonthYear.split('-')[1], 10) - 1, 1)
      : new Date('2026-05-01');

    const result: MonthlyCommitmentProjection[] = [];

    const activeBills = Array.from(this.recurringBills.values()).filter(
      (b) => b.household_id === householdId && b.is_active
    );

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    for (let i = 0; i <= monthsAhead; i++) {
      const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
      const year = targetDate.getFullYear();
      const monthIndex = targetDate.getMonth();
      const monthYearStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const monthName = monthNames[monthIndex];
      const shortYear = String(year).slice(-2);

      let label = `${monthName}/${shortYear}`;
      if (i === 0) label += ' (Atual)';
      else label += ` (+${i}m)`;

      // Filter and compute fixed bills for target user/couple
      const filteredBills = activeBills.filter((b) => {
        if (!targetUserId) return true;
        return b.payer_user_id === targetUserId || b.beneficiary_type === 'both' || b.beneficiary_type === (targetUserId === 'usr-wallace-001' ? 'wallace' : 'guilherme');
      });

      let fixedTotalPerMonth = 0;
      const fixedDetails: Array<{ id: string; description: string; amount: number; due_date: string; category?: string }> = [];

      for (const b of filteredBills) {
        const cat = b.category_id ? this.categories.get(b.category_id) : null;
        let amount = b.expected_amount;
        if (targetUserId && b.beneficiary_type === 'both') {
          amount = Number((b.expected_amount / 2).toFixed(2));
        }
        fixedTotalPerMonth += amount;
        fixedDetails.push({
          id: b.id,
          description: b.description,
          amount,
          due_date: `${monthYearStr}-${String(b.due_day).padStart(2, '0')}`,
          category: cat?.name || 'Moradia'
        });
      }
      fixedTotalPerMonth = Number(fixedTotalPerMonth.toFixed(2));

      // Calculate credit installments falling into this competence month
      const matchingInstallments = Array.from(this.installments.values()).filter((inst) => {
        if (!inst.competence_date.startsWith(monthYearStr) || inst.status === 'paid') return false;
        if (!targetUserId) return true;
        const plan = this.installmentPlans.get(inst.installment_plan_id);
        const tx = plan ? this.transactions.get(plan.transaction_id) : null;
        if (!tx) return true;
        if (tx.beneficiary_type === 'both') return true;
        return tx.buyer_user_id === targetUserId || tx.payer_user_id === targetUserId;
      });

      let installmentsSum = 0;
      const installmentDetails: Array<{ id: string; description: string; installment_info: string; amount: number; due_date: string; card_name?: string }> = [];

      for (const inst of matchingInstallments) {
        const plan = this.installmentPlans.get(inst.installment_plan_id);
        const tx = plan ? this.transactions.get(plan.transaction_id) : null;
        const card = tx?.card_id ? this.cards.get(tx.card_id) : null;
        let instAmount = inst.amount;
        if (targetUserId && tx && tx.beneficiary_type === 'both') {
          instAmount = Number((inst.amount / 2).toFixed(2));
        }
        installmentsSum += instAmount;
        installmentDetails.push({
          id: inst.id,
          description: tx?.description || 'Compra Parcelada',
          installment_info: `${inst.installment_number}/${plan?.number_of_installments || 1}`,
          amount: instAmount,
          due_date: inst.due_date,
          card_name: card?.name || 'Cartão de Crédito'
        });
      }
      installmentsSum = Number(installmentsSum.toFixed(2));

      const totalCommitted = Number((fixedTotalPerMonth + installmentsSum).toFixed(2));

      result.push({
        month_year: monthYearStr,
        label,
        fixed_bills_total: fixedTotalPerMonth,
        credit_installments_total: installmentsSum,
        expected_income_total: 0,
        total_committed: totalCommitted,
        projected_cashflow: -totalCommitted,
        fixed_bills_count: filteredBills.length,
        installments_count: matchingInstallments.length,
        details: {
          fixed_bills: fixedDetails,
          installments: installmentDetails
        }
      });
    }

    return result;
  }

  public getStructuredDashboardData(
    householdId: string,
    perspective: DashboardPerspective = 'couple',
    selectedMonth?: string
  ): DashboardFullResponse {
    const wallaceId = 'usr-wallace-001';
    const guilhermeId = 'usr-guilherme-002';
    const targetUserId = perspective === 'wallace' ? wallaceId : perspective === 'guilherme' ? guilhermeId : null;

    // 1. Determine Current and Previous Competence Month
    const competenceMonth = selectedMonth || '2026-05';
    const [cYear, cMonth] = competenceMonth.split('-').map((v) => parseInt(v, 10));
    let prevYear = cYear;
    let prevMonthNum = cMonth - 1;
    if (prevMonthNum < 1) {
      prevMonthNum = 12;
      prevYear -= 1;
    }
    const prevCompetenceMonth = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthLabel = `${monthNames[cMonth - 1]} de ${cYear}`;

    // 2. Compute Expenses and Incomes based on Perspective
    const allTxs = Array.from(this.transactions.values()).filter(
      (t) => t.household_id === householdId && t.status === 'completed'
    );

    let currentMonthSpent = 0;
    let prevMonthSpent = 0;
    let monthIncome = 0;

    for (const tx of allTxs) {
      const txMonth = tx.transaction_date.substring(0, 7);
      if (tx.transaction_type === 'expense') {
        if (targetUserId) {
          // Individual perspective: calculate user's responsibility from splits
          const splits = Array.from(this.transactionSplits.values()).filter(
            (s) => s.transaction_id === tx.id && s.responsible_user_id === targetUserId
          );
          const userShare = splits.reduce((sum, s) => sum + s.amount, 0);
          if (txMonth === competenceMonth) currentMonthSpent += userShare;
          if (txMonth === prevCompetenceMonth) prevMonthSpent += userShare;
        } else {
          // Couple perspective: full expense amount
          if (txMonth === competenceMonth) currentMonthSpent += tx.total_amount;
          if (txMonth === prevCompetenceMonth) prevMonthSpent += tx.total_amount;
        }
      } else if (tx.transaction_type === 'income') {
        if (!targetUserId || tx.payer_user_id === targetUserId || tx.buyer_user_id === targetUserId) {
          // PROTECTED FUNDS SHIELD: Only unshielded / free income adds to month free balance!
          if (!tx.is_protected_fund) {
            if (txMonth === competenceMonth) monthIncome += tx.total_amount;
          }
        }
      }
    }

    // Add reserve drainages (reclassified funds) into monthIncome for the month
    for (const drainage of this.reserveDrainages.values()) {
      if (drainage.household_id === householdId) {
        const dMonth = drainage.drainage_date.substring(0, 7);
        if (dMonth === competenceMonth) {
          if (!targetUserId || drainage.responsible_type === 'both' || drainage.user_id === targetUserId) {
            monthIncome += drainage.amount;
          }
        }
      }
    }

    currentMonthSpent = Number(currentMonthSpent.toFixed(2));
    prevMonthSpent = Number(prevMonthSpent.toFixed(2));
    monthIncome = Number(monthIncome.toFixed(2));

    let percentageChange = 0;
    if (prevMonthSpent > 0) {
      percentageChange = Number((((currentMonthSpent - prevMonthSpent) / prevMonthSpent) * 100).toFixed(1));
    }

    // 3. Accounts overview & liquid balance
    const householdAccounts = Array.from(this.accounts.values()).filter(
      (a) => a.household_id === householdId && a.is_active
    );

    const filteredAccounts = targetUserId
      ? householdAccounts.filter((a) => !a.owner_user_id || a.owner_user_id === targetUserId)
      : householdAccounts;

    let totalLiquidBalance = 0;
    const accountItems: DashboardAccountItem[] = [];

    for (const acc of filteredAccounts) {
      const owner = acc.owner_user_id ? this.users.get(acc.owner_user_id) : null;
      totalLiquidBalance += acc.current_balance;
      accountItems.push({
        id: acc.id,
        name: acc.name,
        account_type: acc.account_type,
        institution: acc.institution || 'Banco',
        current_balance: Number(acc.current_balance.toFixed(2)),
        owner_user_id: acc.owner_user_id,
        owner_name: owner?.name || 'Conta Compartilhada'
      });
    }

    // 4. Cards Overview with Open Invoices
    const householdCards = Array.from(this.cards.values()).filter(
      (c) => c.household_id === householdId && c.is_active
    );

    const cardItems: DashboardCardItem[] = [];
    for (const card of householdCards) {
      const owner = this.users.get(card.owner_user_id);
      
      // Calculate current open invoice amount for this card
      const cardTxs = allTxs.filter(
        (t) => t.card_id === card.id && t.transaction_type === 'expense'
      );
      const invoiceTotal = cardTxs.reduce((sum, t) => sum + t.total_amount, 0);
      const roundedInvoice = Number(invoiceTotal.toFixed(2));
      const availableLimit = Number(Math.max(0, card.credit_limit - roundedInvoice).toFixed(2));

      // Calculate next due month
      const currentInvoiceMonth = `${cYear}-${String(cMonth).padStart(2, '0')}`;

      cardItems.push({
        id: card.id,
        name: card.name,
        institution: card.institution,
        color: card.color,
        owner_user_id: card.owner_user_id,
        owner_name: owner?.name || 'Casal',
        credit_limit: card.credit_limit,
        closing_day: card.closing_day,
        due_day: card.due_day,
        current_invoice_amount: roundedInvoice,
        current_invoice_month: currentInvoiceMonth,
        available_limit: availableLimit,
        status: 'open'
      });
    }

    // Filter cards if user perspective
    const filteredCards = targetUserId
      ? cardItems.filter((c) => c.owner_user_id === targetUserId)
      : cardItems;

    // 5. Upcoming commitments (Recurring Bills + Future Installments)
    const upcomingCommitments: DashboardUpcomingCommitmentItem[] = [];
    const recurringList = Array.from(this.recurringBills.values()).filter(
      (r) => r.household_id === householdId && r.is_active
    );

    for (const bill of recurringList) {
      const payer = this.users.get(bill.payer_user_id);
      const category = bill.category_id ? this.categories.get(bill.category_id) : null;
      
      // Formulate due date in current month
      const dayStr = String(bill.due_day).padStart(2, '0');
      const dueDate = `${competenceMonth}-${dayStr}`;

      if (!targetUserId || bill.payer_user_id === targetUserId || bill.beneficiary_type === 'both') {
        upcomingCommitments.push({
          id: bill.id,
          type: 'recurring_bill',
          description: bill.description,
          due_date: dueDate,
          amount: bill.expected_amount,
          beneficiary_type: bill.beneficiary_type,
          payer_name: payer?.name || 'Casal',
          category_name: category?.name || 'Despesa Fixa',
          status: 'pending'
        });
      }
    }

    // Sort commitments by due date
    upcomingCommitments.sort((a, b) => a.due_date.localeCompare(b.due_date));

    // 6. Couple Settlement Summary
    const detailedSettlement = this.getDetailedCoupleSettlement(householdId);
    const comp = detailedSettlement.compensation;

    const settlementData: DashboardSettlementData = {
      status: comp.status,
      payer_id: comp.debtor_id || undefined,
      payer_name: comp.debtor_name || undefined,
      receiver_id: comp.creditor_id || undefined,
      receiver_name: comp.creditor_name || undefined,
      amount: comp.amount_to_pay,
      pix_key: comp.pix_key || (comp.creditor_id === wallaceId ? 'w.luiz76@gmail.com' : 'guilherme.pix@casafinance.app'),
      summary_text: comp.summary_text,
      wallace_paid: detailedSettlement.wallace.total_paid,
      wallace_responsibility: detailedSettlement.wallace.total_responsibility,
      guilherme_paid: detailedSettlement.guilherme.total_paid,
      guilherme_responsibility: detailedSettlement.guilherme.total_responsibility
    };

    // 7. Category Breakdown for current month
    const categoryTotals = new Map<string, { name: string; color: string; icon: string; total: number; count: number }>();

    for (const tx of allTxs) {
      if (tx.transaction_type !== 'expense') continue;
      const txMonth = tx.transaction_date.substring(0, 7);
      if (txMonth !== competenceMonth) continue;

      let amount = tx.total_amount;
      if (targetUserId) {
        const splits = Array.from(this.transactionSplits.values()).filter(
          (s) => s.transaction_id === tx.id && s.responsible_user_id === targetUserId
        );
        amount = splits.reduce((sum, s) => sum + s.amount, 0);
      }
      if (amount <= 0) continue;

      const catId = tx.category_id || 'cat-outros';
      const cat = this.categories.get(catId);
      const catName = cat?.name || 'Outras Despesas';
      const catColor = cat?.color || '#64748b';
      const catIcon = cat?.icon || 'tag';

      const existing = categoryTotals.get(catId) || {
        name: catName,
        color: catColor,
        icon: catIcon,
        total: 0,
        count: 0
      };
      existing.total += amount;
      existing.count += 1;
      categoryTotals.set(catId, existing);
    }

    const categoryBreakdown: DashboardCategoryBreakdown[] = [];
    const totalCategorySpent = Array.from(categoryTotals.values()).reduce((sum, c) => sum + c.total, 0);

    for (const [catId, data] of categoryTotals.entries()) {
      const percentage = totalCategorySpent > 0 ? Number(((data.total / totalCategorySpent) * 100).toFixed(1)) : 0;
      categoryBreakdown.push({
        category_id: catId,
        category_name: data.name,
        color: data.color,
        icon: data.icon,
        total_spent: Number(data.total.toFixed(2)),
        percentage,
        transaction_count: data.count
      });
    }

    // Sort categories by highest spent
    categoryBreakdown.sort((a, b) => b.total_spent - a.total_spent);

    // Ensure occurrences are generated for this month
    this.generateOccurrencesForMonth(householdId, competenceMonth);

    // Calculate Fixed Recurring Expenses for the month
    const activeRecurringBills = Array.from(this.recurringBills.values()).filter(
      (r) => r.household_id === householdId && r.is_active
    );
    let gastosFixosRecorrentes = 0;
    for (const bill of activeRecurringBills) {
      if (!targetUserId || bill.payer_user_id === targetUserId || bill.beneficiary_type === 'both') {
        const share = (targetUserId && bill.beneficiary_type === 'both') ? bill.expected_amount / 2 : bill.expected_amount;
        gastosFixosRecorrentes += share;
      }
    }
    gastosFixosRecorrentes = Number(gastosFixosRecorrentes.toFixed(2));

    // Calculate Projected Card Invoices and Installments for the month
    let faturasEParcelasProjetadas = 0;
    for (const card of filteredCards) {
      faturasEParcelasProjetadas += card.current_invoice_amount;
    }
    faturasEParcelasProjetadas = Number(faturasEParcelasProjetadas.toFixed(2));

    // Despesas fixas e lançamentos com status Previsto no mês selecionado
    const monthOccurrences = this.getOccurrencesForMonth(householdId, competenceMonth);
    let pendingOccurrencesTotal = 0;
    for (const occ of monthOccurrences) {
      if (occ.status === 'pending') {
        let amount = occ.amount;
        if (targetUserId) {
          if (occ.beneficiary_type === 'both') amount = Number((occ.amount / 2).toFixed(2));
          else if (occ.payer_user_id !== targetUserId && occ.beneficiary_type !== (targetUserId === 'usr-wallace-001' ? 'wallace' : 'guilherme')) {
            amount = 0;
          }
        }
        pendingOccurrencesTotal += amount;
      }
    }

    const pendingTxs = Array.from(this.transactions.values()).filter(
      (t) => t.household_id === householdId && t.status === 'pending' && t.transaction_date.startsWith(competenceMonth)
    );
    let pendingTxsTotal = 0;
    for (const tx of pendingTxs) {
      if (tx.transaction_type === 'expense') {
        let amount = tx.total_amount;
        if (targetUserId) {
          const splits = Array.from(this.transactionSplits.values()).filter(
            (s) => s.transaction_id === tx.id && s.responsible_user_id === targetUserId
          );
          amount = splits.reduce((sum, s) => sum + s.amount, 0);
        }
        pendingTxsTotal += amount;
      }
    }

    const contasPrevistasMes = Number((pendingOccurrencesTotal > 0 ? pendingOccurrencesTotal : gastosFixosRecorrentes).toFixed(2));
    const faturasMes = faturasEParcelasProjetadas;
    // Comprometimento Total do Mês: Fatura do mês atual + contas Previstas
    const comprometimentoTotalMes = Number((faturasMes + contasPrevistasMes + pendingTxsTotal).toFixed(2));
    // Saldo Real / Consolidado: Apenas receitas e despesas com status Pago/Recebido (saldo líquido disponível nas contas)
    const saldoRealConsolidado = Number(totalLiquidBalance.toFixed(2));
    const resultadoRealMes = Number((monthIncome - currentMonthSpent).toFixed(2));
    // Saldo Projetado ao Fim do Mês: Saldo Real menos comprometimento total do mês
    const saldoProjetadoFimMes = Number((saldoRealConsolidado - comprometimentoTotalMes).toFixed(2));

    // Calculate Valor Disponivel Livre Real: (Receitas Livres do Mês - Despesas Realizadas - Contas Fixas)
    // Protected funds are strictly shielded and excluded from monthIncome
    const valorDisponivelLivre = Number((monthIncome - currentMonthSpent - gastosFixosRecorrentes).toFixed(2));

    // Calculate Payment Methods Commitment (Comprometimento dos Meios de Pagamento)
    const paymentMethodSpent = new Map<string, { id: string; name: string; type: 'credit_card' | 'account' | 'meal_benefit' | 'cash'; institution?: string; total: number; color?: string; owner_name?: string }>();

    for (const tx of allTxs) {
      if (tx.transaction_type !== 'expense') continue;
      const txMonth = tx.transaction_date.substring(0, 7);
      if (txMonth !== competenceMonth) continue;

      let txAmount = tx.total_amount;
      if (targetUserId) {
        const splits = Array.from(this.transactionSplits.values()).filter(
          (s) => s.transaction_id === tx.id && s.responsible_user_id === targetUserId
        );
        txAmount = splits.reduce((sum, s) => sum + s.amount, 0);
      }
      if (txAmount <= 0) continue;

      if (tx.card_id) {
        const card = this.cards.get(tx.card_id);
        const key = `card-${tx.card_id}`;
        const owner = card?.owner_user_id ? this.users.get(card.owner_user_id) : null;
        const current = paymentMethodSpent.get(key) || {
          id: tx.card_id,
          name: card?.name || 'Cartão de Crédito',
          type: 'credit_card',
          institution: card?.institution || 'Cartão',
          total: 0,
          color: card?.color || '#3b82f6',
          owner_name: owner?.name || 'Casal'
        };
        current.total += txAmount;
        paymentMethodSpent.set(key, current);
      } else if (tx.account_id) {
        const acc = this.accounts.get(tx.account_id);
        const key = `acc-${tx.account_id}`;
        const owner = acc?.owner_user_id ? this.users.get(acc.owner_user_id) : null;
        const isMeal = acc?.account_type === 'meal_benefit';
        const current = paymentMethodSpent.get(key) || {
          id: tx.account_id,
          name: acc?.name || 'Conta Bancária',
          type: isMeal ? 'meal_benefit' : 'account',
          institution: acc?.institution || 'Banco',
          total: 0,
          color: isMeal ? '#10b981' : '#6366f1',
          owner_name: owner?.name || 'Casal'
        };
        current.total += txAmount;
        paymentMethodSpent.set(key, current);
      } else {
        const key = 'pm-outros';
        const current = paymentMethodSpent.get(key) || {
          id: 'pm-outros',
          name: 'Pix / Dinheiro / Outros',
          type: 'cash',
          institution: 'Direto',
          total: 0,
          color: '#8b5cf6',
          owner_name: 'Casal'
        };
        current.total += txAmount;
        paymentMethodSpent.set(key, current);
      }
    }

    const totalPmSpent = Array.from(paymentMethodSpent.values()).reduce((sum, p) => sum + p.total, 0);
    const comprometimentoMeiosPagamento = Array.from(paymentMethodSpent.values())
      .map((pm) => ({
        id: pm.id,
        name: pm.name,
        type: pm.type,
        institution: pm.institution,
        total_spent: Number(pm.total.toFixed(2)),
        percentage: totalPmSpent > 0 ? Number(((pm.total / totalPmSpent) * 100).toFixed(1)) : 0,
        color: pm.color,
        owner_name: pm.owner_name
      }))
      .sort((a, b) => b.total_spent - a.total_spent);

    // Future Commitments Projection (+1m, +3m, +6m)
    const projecaoFutura = this.getFutureCommitmentsProjection(householdId, 6, targetUserId, competenceMonth);

    // Protected funds & Reserve Drainages for this household
    const protectedFundsList = Array.from(this.protectedFunds.values()).filter(
      (f) => f.household_id === householdId
    );
    const totalInvestido = protectedFundsList.reduce((sum, f) => sum + f.current_balance, 0);
    const totalFaturasAbertas = filteredCards.reduce((sum, c) => sum + c.current_invoice_amount, 0);
    const saldoLiquidoPatrimonio = Number((totalLiquidBalance + totalInvestido - totalFaturasAbertas).toFixed(2));

    const patrimonioAcumulado = {
      saldo_contas: Number(totalLiquidBalance.toFixed(2)),
      total_faturas_abertas: Number(totalFaturasAbertas.toFixed(2)),
      saldo_liquido_patrimonio: saldoLiquidoPatrimonio,
      total_investido: Number(totalInvestido.toFixed(2))
    };

    const reserveDrainagesList = Array.from(this.reserveDrainages.values())
      .filter((d) => d.household_id === householdId)
      .sort((a, b) => b.drainage_date.localeCompare(a.drainage_date));

    return {
      summary: {
        // Indicadores cruciais de Saldo Real vs Saldo Projetado
        saldoRealConsolidado,
        resultadoRealMes,
        faturasMes,
        contasPrevistasMes,
        comprometimentoTotalMes,
        saldoProjetadoFimMes,

        // Unified dashboard fields
        valorDisponivelLivre,
        entradasDoMes: monthIncome,
        gastosDoMes: currentMonthSpent,
        gastosFixosRecorrentes,
        faturasEParcelasProjetadas,
        // Legacy & compatibility
        current_month_spent: currentMonthSpent,
        previous_month_spent: prevMonthSpent,
        percentage_change: percentageChange,
        month_income: monthIncome,
        household_net_balance: Number(totalLiquidBalance.toFixed(2)),
        perspective,
        month_label: monthLabel,
        competence_month: competenceMonth
      },
      cards: filteredCards,
      accounts: accountItems,
      upcoming_commitments: upcomingCommitments,
      settlement: settlementData,
      category_breakdown: categoryBreakdown,
      // Novos campos estruturados para o dashboard
      gastosPorCategoria: categoryBreakdown,
      comprometimentoMeiosPagamento,
      projecaoFutura,
      patrimonioAcumulado,
      protected_funds: protectedFundsList,
      reserve_drainages: reserveDrainagesList
    };
  }

  // ==========================================
  // PROMPT 6: IA, OCR & RECONCILIAÇÃO CONTÁBIL
  // ==========================================

  public normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public cleanMerchantName(text: string): string {
    if (!text) return '';
    let clean = this.normalizeText(text);
    // Remove payment processors & common business suffixes
    const stopwords = [
      'ltda', 'me', 'epp', 'eireli', 'sa', 's a', 'cia',
      'pag', 'pagseguro', 'mercadopago', 'mercadolivre', 'mp',
      'pay', 'stone', 'cielo', 'getnet', 'rede', 'sumup',
      'ifood', 'uber', '99app', '99pay', 'picpay'
    ];
    for (const word of stopwords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      clean = clean.replace(regex, ' ');
    }
    return clean.replace(/\s+/g, ' ').trim();
  }

  public calculateFingerprint(amount: number, date: string, description: string, cardId?: string | null): string {
    const cleanMerchant = this.cleanMerchantName(description) || this.normalizeText(description);
    const amtStr = Number(amount).toFixed(2);
    const cardStr = cardId || 'none';
    return crypto.createHash('md5').update(`${amtStr}|${date}|${cleanMerchant}|${cardStr}`).digest('hex');
  }

  public findMerchantRule(householdId: string, merchantOrDesc: string): { rule: MerchantCategoryRule; category: Category } | null {
    const normalizedQuery = this.normalizeText(merchantOrDesc);
    if (!normalizedQuery) return null;

    const rules = Array.from(this.merchantCategoryRules.values()).filter(
      (r) => r.household_id === householdId
    );

    // 1. Exact or substring match (longest pattern first)
    rules.sort((a, b) => b.merchant_pattern.length - a.merchant_pattern.length);

    for (const r of rules) {
      const normPattern = this.normalizeText(r.merchant_pattern);
      if (normalizedQuery.includes(normPattern) || normPattern.includes(normalizedQuery)) {
        const cat = this.categories.get(r.category_id);
        if (cat) {
          return {
            rule: {
              ...r,
              category_name: cat.name
            },
            category: cat
          };
        }
      }
    }

    return null;
  }

  public getMerchantRules(householdId: string): MerchantCategoryRule[] {
    const list = Array.from(this.merchantCategoryRules.values()).filter(
      (r) => r.household_id === householdId
    );

    return list.map((r) => {
      const cat = this.categories.get(r.category_id);
      return {
        ...r,
        category_name: cat?.name || 'Desconhecida'
      };
    });
  }

  public saveMerchantRule(householdId: string, merchantPattern: string, categoryId: string): MerchantCategoryRule {
    const cleanPattern = this.normalizeText(merchantPattern);
    const now = new Date().toISOString();

    const existing = Array.from(this.merchantCategoryRules.values()).find(
      (r) => r.household_id === householdId && this.normalizeText(r.merchant_pattern) === cleanPattern
    );

    if (existing) {
      existing.category_id = categoryId;
      existing.updated_at = now;
      this.merchantCategoryRules.set(existing.id, existing);
      const cat = this.categories.get(categoryId);
      return { ...existing, category_name: cat?.name };
    }

    const id = uuidv4();
    const newRule: MerchantCategoryRule = {
      id,
      household_id: householdId,
      merchant_pattern: merchantPattern.trim(),
      category_id: categoryId,
      created_at: now,
      updated_at: now
    };
    this.merchantCategoryRules.set(id, newRule);
    const cat = this.categories.get(categoryId);
    return { ...newRule, category_name: cat?.name };
  }

  public deleteMerchantRule(ruleId: string, householdId: string): boolean {
    const rule = this.merchantCategoryRules.get(ruleId);
    if (!rule || rule.household_id !== householdId) return false;
    return this.merchantCategoryRules.delete(ruleId);
  }

  public checkDuplicateTransaction(
    householdId: string,
    amount: number,
    transactionDate: string,
    description: string,
    cardId?: string | null
  ): {
    isDuplicate: boolean;
    type: 'EXACT' | 'FUZZY' | 'NONE';
    matchedTransaction?: Transaction;
    reason?: string;
    confidence: number;
  } {
    const transactions = Array.from(this.transactions.values()).filter(
      (t) => t.household_id === householdId && t.status !== 'cancelled'
    );

    const normTargetDesc = this.normalizeText(description);
    const targetAmt = Number(amount);
    const targetDateObj = new Date(transactionDate + 'T00:00:00');

    // 1. Exact Fingerprint & Match
    const targetFingerprint = this.calculateFingerprint(targetAmt, transactionDate, description, cardId);

    for (const tx of transactions) {
      const txAmt = Number(tx.total_amount);
      const txFingerprint = this.calculateFingerprint(txAmt, tx.transaction_date, tx.description, tx.card_id);

      if (txFingerprint === targetFingerprint) {
        return {
          isDuplicate: true,
          type: 'EXACT',
          matchedTransaction: tx,
          reason: `Lançamento idêntico encontrado (${tx.description} em ${tx.transaction_date} no valor de R$ ${tx.total_amount.toFixed(2)})`,
          confidence: 1.0
        };
      }
    }

    // 2. Fuzzy Matching: Same exact amount, card match (or both within same household), and date within ±3 days
    for (const tx of transactions) {
      const txAmt = Number(tx.total_amount);
      const diffAmt = Math.abs(txAmt - targetAmt);

      if (diffAmt < 0.01) {
        const txDateObj = new Date(tx.transaction_date + 'T00:00:00');
        const diffTime = Math.abs(targetDateObj.getTime() - txDateObj.getTime());
        const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

        if (diffDays <= 3) {
          const normTxDesc = this.normalizeText(tx.description);
          const sameCard = cardId && tx.card_id === cardId;
          const descOverlap = normTargetDesc.includes(normTxDesc) || normTxDesc.includes(normTargetDesc) || normTxDesc.slice(0, 5) === normTargetDesc.slice(0, 5);

          if (sameCard || descOverlap || diffDays === 0) {
            return {
              isDuplicate: true,
              type: 'FUZZY',
              matchedTransaction: tx,
              reason: `Possível duplicata: compra de R$ ${txAmt.toFixed(2)} em ${tx.transaction_date} ("${tx.description}") lançada com diferença de ${diffDays} dia(s)`,
              confidence: sameCard ? 0.95 : 0.85
            };
          }
        }
      }
    }

    return {
      isDuplicate: false,
      type: 'NONE',
      confidence: 0
    };
  }

  public saveDocumentImport(data: {
    household_id: string;
    uploaded_by: string;
    document_type: 'RECEIPT' | 'INVOICE';
    file_url?: string;
    status: 'PROCESSING' | 'SUCCESS' | 'FAILED';
    raw_ocr_response?: any;
  }): DocumentImport {
    const id = uuidv4();
    const doc: DocumentImport = {
      id,
      household_id: data.household_id,
      uploaded_by: data.uploaded_by,
      file_url: data.file_url,
      document_type: data.document_type,
      status: data.status,
      raw_ocr_response: data.raw_ocr_response,
      created_at: new Date().toISOString()
    };
    this.documentImports.set(id, doc);
    return doc;
  }

  public updateDocumentImport(id: string, updates: Partial<DocumentImport>): DocumentImport | null {
    const doc = this.documentImports.get(id);
    if (!doc) return null;
    const updated = { ...doc, ...updates };
    this.documentImports.set(id, updated);
    return updated;
  }

  public getDocumentImports(householdId: string): DocumentImport[] {
    return Array.from(this.documentImports.values())
      .filter((d) => d.household_id === householdId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // ==========================================================================
  // SPRINT 8: PROTECTED FUNDS & RESERVE DRAINAGE TRACKING
  // ==========================================================================

  public getProtectedFunds(householdId: string): ProtectedFund[] {
    return Array.from(this.protectedFunds.values())
      .filter((f) => f.household_id === householdId)
      .sort((a, b) => b.current_balance - a.current_balance);
  }

  public getReserveDrainages(householdId: string): ReserveDrainage[] {
    return Array.from(this.reserveDrainages.values())
      .filter((d) => d.household_id === householdId)
      .sort((a, b) => b.drainage_date.localeCompare(a.drainage_date));
  }

  public recordReserveDrainage(
    householdId: string,
    userId: string,
    data: {
      fund_id: string;
      amount: number;
      reason: string;
      responsible_type?: BeneficiaryType;
      destination_account_id?: string | null;
      drainage_date?: string;
    }
  ): { drainage: ReserveDrainage; updatedFund: ProtectedFund } {
    if (data.amount <= 0) {
      throw new Error('O valor de resgate deve ser maior que zero.');
    }

    const fund = this.protectedFunds.get(data.fund_id);
    if (!fund || fund.household_id !== householdId) {
      throw new Error('Fundo protegido não encontrado ou sem permissão.');
    }

    if (fund.current_balance < data.amount) {
      throw new Error(`Saldo insuficiente no ${fund.name}. Saldo disponível: R$ ${fund.current_balance.toFixed(2)}`);
    }

    const now = new Date().toISOString();
    const id = uuidv4();
    const date = data.drainage_date || now.split('T')[0];
    const user = this.users.get(userId);

    // 1. Deduct from fund
    fund.current_balance = Number((fund.current_balance - data.amount).toFixed(2));
    fund.updated_at = now;
    this.protectedFunds.set(fund.id, fund);

    // 2. Deposit into destination account if selected
    let destAccName: string | undefined = undefined;
    if (data.destination_account_id && this.accounts.has(data.destination_account_id)) {
      const destAcc = this.accounts.get(data.destination_account_id)!;
      destAcc.current_balance = Number((destAcc.current_balance + data.amount).toFixed(2));
      destAcc.updated_at = now;
      this.accounts.set(destAcc.id, destAcc);
      destAccName = destAcc.name;
    }

    // 3. Create drainage record
    const drainage: ReserveDrainage = {
      id,
      household_id: householdId,
      user_id: userId,
      user_name: user?.name || 'Wallace',
      fund_id: fund.id,
      fund_name: fund.name,
      amount: Number(data.amount),
      reason: data.reason?.trim() || 'Cobrir despesas e compromissos do mês',
      responsible_type: data.responsible_type || 'both',
      destination_account_id: data.destination_account_id || null,
      destination_account_name: destAccName,
      drainage_date: date,
      created_at: now
    };
    this.reserveDrainages.set(id, drainage);

    // 4. Audit Log
    this.addAuditLog(
      householdId,
      userId,
      'INSERT',
      'reserve_drainages',
      id,
      null,
      drainage as unknown as Record<string, unknown>,
      user?.name
    );

    return { drainage, updatedFund: fund };
  }
}

export const db = new DatabaseStore();
