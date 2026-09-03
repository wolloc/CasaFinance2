import type { DocumentType, PaymentMethodDetected } from '../types/index.js';

export interface RawOcrItem {
  description?: unknown;
  amount?: unknown;
  transaction_date?: unknown;
  suggested_category?: unknown;
  installment_info?: { current_installment?: unknown; total_installments?: unknown };
}

export interface RawOcrResult {
  document_type?: unknown;
  issuer_name?: unknown;
  transaction_date?: unknown;
  total_amount?: unknown;
  suggested_category?: unknown;
  payment_method_detected?: unknown;
  confidence_score?: unknown;
  invoice_competence?: unknown;
  invoice_due_date?: unknown;
  items?: unknown;
}

export interface ValidatedOcrResult {
  document_type: DocumentType;
  issuer_name: string;
  transaction_date: string;
  total_amount: number;
  suggested_category: string;
  payment_method_detected: PaymentMethodDetected;
  confidence_score: number;
  invoice_competence?: string;
  invoice_due_date?: string;
  items: Array<{
    description: string;
    amount: number;
    transaction_date: string;
    suggested_category: string;
    installment_info: { current_installment: number; total_installments: number };
    review_reasons: string[];
  }>;
}

const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const competencePattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const methods: PaymentMethodDetected[] = ['PORTO', 'INFINITY', 'MULTIPLO', 'ITI', 'PIX', 'DEBIT', 'UNKNOWN'];

const text = (value: unknown, fallback: string, max = 160) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback;
const positiveMoney = (value: unknown) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? Number(number.toFixed(2)) : 0;
};

/** Treat Gemini output as untrusted input and return only bounded financial fields. */
export function validateOcrResult(raw: RawOcrResult, today = new Date().toISOString().slice(0, 10)): ValidatedOcrResult {
  const documentType: DocumentType = raw.document_type === 'INVOICE' ? 'INVOICE' : 'RECEIPT';
  const issuer = text(raw.issuer_name, 'Estabelecimento não identificado');
  const transactionDate = typeof raw.transaction_date === 'string' && datePattern.test(raw.transaction_date) ? raw.transaction_date : today;
  const inputItems: RawOcrItem[] = Array.isArray(raw.items) ? raw.items.filter((item): item is RawOcrItem => Boolean(item && typeof item === 'object')) : [];
  const fallbackAmount = positiveMoney(raw.total_amount);
  const items = (inputItems.length ? inputItems : [{ description: issuer, amount: fallbackAmount }]).slice(0, 500).map((item) => {
    const amount = positiveMoney(item.amount);
    const itemDate = typeof item.transaction_date === 'string' && datePattern.test(item.transaction_date) ? item.transaction_date : transactionDate;
    const current = Math.max(1, Math.trunc(Number(item.installment_info?.current_installment) || 1));
    const total = Math.max(current, Math.min(120, Math.trunc(Number(item.installment_info?.total_installments) || 1)));
    const reviewReasons: string[] = [];
    if (!amount) reviewReasons.push('Valor ausente ou inválido');
    if (!item.description || typeof item.description !== 'string') reviewReasons.push('Descrição não identificada');
    if (!item.transaction_date || itemDate !== item.transaction_date) reviewReasons.push('Data inferida');
    return {
      description: text(item.description, issuer), amount, transaction_date: itemDate,
      suggested_category: text(item.suggested_category, text(raw.suggested_category, 'Outros'), 80),
      installment_info: { current_installment: current, total_installments: total }, review_reasons: reviewReasons
    };
  });
  const calculatedTotal = Number(items.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
  const method = typeof raw.payment_method_detected === 'string' && methods.includes(raw.payment_method_detected as PaymentMethodDetected)
    ? raw.payment_method_detected as PaymentMethodDetected : 'UNKNOWN';
  return {
    document_type: documentType, issuer_name: issuer, transaction_date: transactionDate,
    total_amount: documentType === 'INVOICE' ? calculatedTotal : (fallbackAmount || calculatedTotal),
    suggested_category: text(raw.suggested_category, 'Outros', 80), payment_method_detected: method,
    confidence_score: Math.min(1, Math.max(0, Number(raw.confidence_score) || 0)), items,
    invoice_competence: typeof raw.invoice_competence === 'string' && competencePattern.test(raw.invoice_competence) ? raw.invoice_competence : undefined,
    invoice_due_date: typeof raw.invoice_due_date === 'string' && datePattern.test(raw.invoice_due_date) ? raw.invoice_due_date : undefined
  };
}

