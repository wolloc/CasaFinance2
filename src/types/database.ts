/** ISO-8601 values returned by PostgreSQL/Supabase. */
export type UUID = string;
export type DateString = string;
export type TimestampString = string;

/** NUMERIC is represented as a decimal string at the persistence boundary. */
export type Money = string;
export type Percentage = string;

export type AccountKind = 'cash' | 'checking' | 'savings' | 'investment' | 'meal_benefit' | 'digital_wallet';
export type CategoryKind = 'expense' | 'income';
export type TransactionKind = 'expense' | 'income' | 'transfer' | 'invoice_payment' | 'adjustment';
export type TransactionState = 'planned' | 'pending' | 'paid' | 'received' | 'cancelled' | 'refunded';
export type PaymentInstrumentKind = 'account' | 'card';
export type InvoiceState = 'open' | 'closed' | 'paid' | 'cancelled';

export interface LedgerTransaction {
  id: UUID;
  household_id: UUID;
  created_by_member_id: UUID;
  buyer_member_id: UUID | null;
  category_id: UUID | null;
  invoice_id: UUID | null;
  type: TransactionKind;
  status: TransactionState;
  description: string;
  merchant: string | null;
  amount: Money;
  transaction_date: DateString;
  competence_date: DateString;
  due_date: DateString | null;
  settled_at: TimestampString | null;
  notes: string | null;
  refunded_transaction_id: UUID | null;
  created_at: TimestampString;
  updated_at: TimestampString;
  deleted_at: TimestampString | null;
}

export interface TransactionPaymentInstrument {
  id: UUID;
  household_id: UUID;
  transaction_id: UUID;
  kind: PaymentInstrumentKind;
  account_id: UUID | null;
  card_id: UUID | null;
  created_at: TimestampString;
}

export interface EconomicResponsibilitySplit {
  id: UUID;
  household_id: UUID;
  transaction_id: UUID;
  responsible_member_id: UUID;
  percentage: Percentage;
  amount: Money;
  created_at: TimestampString;
}

export interface FundingEvent {
  id: UUID;
  household_id: UUID;
  financed_transaction_id: UUID;
  funding_transaction_id: UUID;
  funder_member_id: UUID;
  source_account_id: UUID;
  amount: Money;
  funded_at: TimestampString;
  created_at: TimestampString;
}

export interface CardInvoice {
  id: UUID;
  household_id: UUID;
  card_id: UUID;
  competence_date: DateString;
  closing_date: DateString;
  due_date: DateString;
  status: InvoiceState;
  total_amount: Money;
  settled_amount: Money;
  settled_at: TimestampString | null;
  created_at: TimestampString;
  updated_at: TimestampString;
}

export interface CardInvoicePayment {
  id: UUID;
  household_id: UUID;
  invoice_id: UUID;
  payment_transaction_id: UUID;
  source_account_id: UUID;
  amount: Money;
  paid_at: TimestampString;
  created_at: TimestampString;
}

export interface TransferRecord {
  id: UUID;
  household_id: UUID;
  transaction_id: UUID;
  source_account_id: UUID;
  destination_account_id: UUID;
  settled_at: TimestampString | null;
  created_at: TimestampString;
}

export interface Database {
  public: {
    Tables: {
      transactions: { Row: LedgerTransaction };
      transaction_payment_instruments: { Row: TransactionPaymentInstrument };
      transaction_splits: { Row: EconomicResponsibilitySplit };
      funding_events: { Row: FundingEvent };
      card_invoices: { Row: CardInvoice };
      card_invoice_payments: { Row: CardInvoicePayment };
      transfers: { Row: TransferRecord };
    };
  };
}
