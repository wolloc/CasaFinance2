export * from './database';

export type AccountType = 'checking' | 'savings' | 'cash' | 'investment' | 'meal_benefit' | 'digital_wallet' | 'other';
export type TransactionType = 'expense' | 'income' | 'transfer' | 'invoice_payment' | 'adjustment';
export type BeneficiaryType = 'wallace' | 'guilherme' | 'both' | 'custom';
export type InvoiceStatus = 'open' | 'closed' | 'paid' | 'overdue';
export type InstallmentStatus = 'scheduled' | 'billed' | 'paid' | 'cancelled';
export type SettlementStatus = 'draft' | 'completed';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  pix_key?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface Household {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: 'owner' | 'member' | 'viewer';
  joined_at: string;
  is_active: boolean;
  user?: User;
}

export interface Account {
  id: string;
  household_id: string;
  owner_user_id?: string | null;
  name: string;
  account_type: AccountType;
  institution?: string;
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  household_id: string;
  owner_user_id: string;
  name: string;
  institution: string;
  card_type: 'credit' | 'debit' | 'multiple';
  credit_limit: number;
  closing_day: number;
  due_day: number;
  default_payment_account_id?: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  requires_card: boolean;
  requires_account: boolean;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  parent_id?: string | null;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  household_id: string;
  created_by_user_id: string;
  buyer_user_id: string;
  payer_user_id: string;
  transaction_date: string;
  description: string;
  merchant?: string;
  total_amount: number;
  transaction_type: TransactionType;
  payment_method_id: string;
  account_id?: string | null;
  card_id?: string | null;
  category_id?: string | null;
  beneficiary_type: BeneficiaryType;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  is_installment: boolean;
  is_protected_fund?: boolean;
  protected_fund_tag?: 'free' | 'apartment' | 'vacation' | 'investments' | string;
  protected_fund_name?: string;
  created_at: string;
  updated_at: string;
  splits?: TransactionSplit[];
}

export interface ProtectedFund {
  id: string;
  household_id: string;
  name: string;
  icon: string;
  color: string;
  target_amount?: number;
  current_balance: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ReserveDrainage {
  id: string;
  household_id: string;
  user_id: string;
  user_name: string;
  fund_id: string;
  fund_name: string;
  amount: number;
  reason: string;
  responsible_type: BeneficiaryType;
  destination_account_id?: string | null;
  destination_account_name?: string;
  drainage_date: string;
  created_at: string;
}

export interface TransactionSplit {
  id: string;
  transaction_id: string;
  responsible_user_id: string;
  percentage: number;
  amount: number;
  created_at: string;
}

export interface InstallmentPlan {
  id: string;
  transaction_id: string;
  total_amount: number;
  number_of_installments: number;
  installment_amount_base: number;
  first_installment_date: string;
  last_installment_date: string;
  created_at: string;
}

export interface Installment {
  id: string;
  installment_plan_id: string;
  installment_number: number;
  amount: number;
  competence_date: string;
  due_date: string;
  status: InstallmentStatus;
  created_at: string;
}

export interface Invoice {
  id: string;
  card_id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  total_amount: number;
  status: InvoiceStatus;
  paid_at?: string | null;
  created_at: string;
}

export interface Settlement {
  id: string;
  household_id: string;
  settlement_date: string;
  payer_user_id: string;
  receiver_user_id: string;
  settled_amount: number;
  status: SettlementStatus;
  notes?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  household_id: string;
  user_id: string;
  user_name?: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'SWITCH_USER';
  entity_name: string;
  entity_id: string;
  table_name?: string;
  record_id?: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  created_at: string;
}

export interface SettlementBalance {
  user_id: string;
  user_name: string;
  total_paid: number;
  total_responsibility: number;
  net_balance: number; // positive = has credit to receive, negative = has debt to pay
}

export interface CoupleSettlementSummary {
  household_id: string;
  competence_month?: string;
  wallace: SettlementBalance;
  guilherme: SettlementBalance;
  compensation: {
    status: 'settled' | 'guilherme_owes_wallace' | 'wallace_owes_guilherme';
    amount_to_pay: number;
    debtor_id: string | null;
    debtor_name: string | null;
    creditor_id: string | null;
    creditor_name: string | null;
    pix_key: string | null;
    summary_text: string;
  };
  contributing_transactions: Array<{
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
  }>;
  settlement_history: Array<{
    id: string;
    settlement_date: string;
    payer_id: string;
    payer_name: string;
    receiver_id: string;
    receiver_name: string;
    settled_amount: number;
    status: SettlementStatus;
    notes?: string;
    created_at: string;
  }>;
}

export type RecurrenceFrequency = 'monthly' | 'yearly' | 'weekly';

export interface RecurringBill {
  id: string;
  household_id: string;
  created_by_user_id: string;
  buyer_user_id: string;
  payer_user_id: string;
  description: string;
  merchant?: string;
  expected_amount: number;
  due_day: number; // 1-31
  frequency: RecurrenceFrequency;
  category_id?: string | null;
  payment_method_id: string;
  account_id?: string | null;
  card_id?: string | null;
  beneficiary_type: BeneficiaryType;
  wallace_percentage?: number;
  is_active: boolean;
  auto_generate: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  splits?: TransactionSplit[];
}

export interface BillOccurrence {
  id: string;
  recurring_bill_id: string;
  household_id: string;
  competence_month: string; // 'YYYY-MM'
  due_date: string; // 'YYYY-MM-DD'
  amount: number;
  status: 'pending' | 'paid' | 'skipped';
  paid_transaction_id?: string | null;
  paid_at?: string | null;
  created_at: string;
  payment_method_id?: string;
  account_id?: string | null;
  card_id?: string | null;
  payer_user_id?: string;
  buyer_user_id?: string;
  beneficiary_type?: BeneficiaryType;
  wallace_percentage?: number;
  description?: string;
  category_id?: string | null;
  recurring_bill?: RecurringBill;
}

export interface MonthlyCommitmentProjection {
  month_year: string; // 'YYYY-MM'
  label: string; // 'Setembro/26 (+1m)'
  fixed_bills_total: number;
  credit_installments_total: number;
  expected_income_total: number;
  total_committed: number;
  projected_cashflow: number;
  fixed_bills_count: number;
  installments_count: number;
  details: {
    fixed_bills: Array<{ id: string; description: string; amount: number; due_date: string; category?: string }>;
    installments: Array<{ id: string; description: string; installment_info: string; amount: number; due_date: string; card_name?: string }>;
  };
}

export type DashboardPerspective = 'couple' | 'wallace' | 'guilherme';

export interface DashboardPaymentCommitmentItem {
  id: string;
  name: string;
  type: 'credit_card' | 'account' | 'meal_benefit' | 'cash';
  institution?: string;
  total_spent: number;
  percentage: number;
  color?: string;
  owner_name?: string;
}

export interface DashboardPatrimonio {
  saldo_contas: number;
  total_faturas_abertas: number;
  saldo_liquido_patrimonio: number;
  total_investido?: number;
}

export interface DashboardSummaryData {
  // Indicadores de Saldo Real vs Saldo Projetado (Regras de Negócio Cruciais)
  saldoRealConsolidado?: number; // Apenas receitas e despesas com status Pago/Recebido
  resultadoRealMes?: number; // Receitas Pagas - Despesas Pagas do mês
  faturasMes?: number; // Parcelas de cartão do mês atual e gastos faturados
  contasPrevistasMes?: number; // Contas fixas e despesas com status Previsto
  comprometimentoTotalMes?: number; // Faturas do mês + Contas Previstas
  saldoProjetadoFimMes?: number; // Saldo Real - Comprometimento Total do Mês
  receitasPrevistasMes?: number;

  // Dados fundamentais unificados do novo dashboard
  valorDisponivelLivre: number;
  entradasDoMes: number;
  gastosDoMes: number;
  gastosFixosRecorrentes: number;
  faturasEParcelasProjetadas: number;

  // Legado & compatibilidade
  current_month_spent: number;
  previous_month_spent: number;
  percentage_change: number;
  month_income: number;
  household_net_balance: number;
  perspective: DashboardPerspective;
  month_label: string;
  competence_month: string;
}

export interface DashboardCardItem {
  id: string;
  name: string;
  institution: string;
  color: string;
  owner_user_id: string;
  owner_name: string;
  credit_limit: number;
  closing_day: number;
  due_day: number;
  current_invoice_amount: number;
  current_invoice_month: string;
  available_limit: number;
  status: 'open' | 'closed' | 'paid';
}

export interface DashboardAccountItem {
  id: string;
  name: string;
  account_type: string;
  institution: string;
  current_balance: number;
  owner_user_id?: string | null;
  owner_name?: string;
}

export interface DashboardUpcomingCommitmentItem {
  id: string;
  type: 'recurring_bill' | 'credit_installment';
  description: string;
  due_date: string;
  amount: number;
  beneficiary_type: BeneficiaryType;
  payer_name: string;
  category_name?: string;
  status: 'pending' | 'paid' | 'overdue';
}

export interface DashboardSettlementData {
  status: 'settled' | 'guilherme_owes_wallace' | 'wallace_owes_guilherme';
  payer_id?: string;
  payer_name?: string;
  receiver_id?: string;
  receiver_name?: string;
  amount: number;
  pix_key?: string;
  summary_text: string;
  wallace_paid: number;
  wallace_responsibility: number;
  guilherme_paid: number;
  guilherme_responsibility: number;
}

export interface DashboardCategoryBreakdown {
  category_id: string;
  category_name: string;
  color: string;
  icon: string;
  total_spent: number;
  percentage: number;
  transaction_count: number;
}

export interface DashboardFullResponse {
  summary: DashboardSummaryData;
  cards: DashboardCardItem[];
  accounts: DashboardAccountItem[];
  upcoming_commitments: DashboardUpcomingCommitmentItem[];
  settlement: DashboardSettlementData;
  category_breakdown: DashboardCategoryBreakdown[];
  // Novos campos preparados para o dashboard simplificado
  gastosPorCategoria: DashboardCategoryBreakdown[];
  comprometimentoMeiosPagamento: DashboardPaymentCommitmentItem[];
  projecaoFutura: MonthlyCommitmentProjection[];
  patrimonioAcumulado: DashboardPatrimonio;
  protected_funds?: ProtectedFund[];
  reserve_drainages?: ReserveDrainage[];
}

// ==========================================
// PROMPT 6: IA, OCR & IMPORTAÇÃO DE FATURAS
// ==========================================

export type DocumentType = 'RECEIPT' | 'INVOICE';
export type PaymentMethodDetected = 'PORTO' | 'INFINITY' | 'MULTIPLO' | 'ITI' | 'PIX' | 'DEBIT' | 'UNKNOWN';

export interface InvoiceParsedItem {
  description: string;
  amount: number;
  transaction_date?: string;
  suggested_category?: string;
  suggested_category_id?: string;
  installment_info?: {
    current_installment: number;
    total_installments: number;
  };
  reconciliation_status?: 'NEW' | 'ALREADY_REGISTERED' | 'POSSIBLE_DUPLICATE';
  matched_transaction_id?: string;
  match_confidence?: number;
  match_reason?: string;
}

export interface StandardizedOcrResponse {
  document_type: DocumentType;
  issuer_name: string;
  transaction_date: string;
  total_amount: number;
  suggested_category: string;
  suggested_category_id?: string;
  payment_method_detected: PaymentMethodDetected;
  suggested_card_id?: string;
  suggested_account_id?: string;
  confidence_score?: number;
  items: InvoiceParsedItem[];
  raw_text?: string;
}

export interface DocumentImport {
  id: string;
  household_id: string;
  uploaded_by: string;
  file_url?: string;
  document_type: DocumentType;
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED';
  raw_ocr_response?: StandardizedOcrResponse;
  created_at: string;
}

export interface MerchantCategoryRule {
  id: string;
  household_id: string;
  merchant_pattern: string;
  category_id: string;
  category_name?: string;
  created_at: string;
  updated_at: string;
}
