import type { SupabaseClient } from '@supabase/supabase-js';
import { getRetryStableRequestKey, releaseRetryStableRequestKey } from './retryIdempotency.js';

export type FutureInvoiceTarget = { invoice_id: string; invoice_month: string; due_date: string; outstanding: number | string };
export type RefundResponsibilityAllocation = { member_id: string; amount: number | string; percentage: number | string };
export type OriginalFundingRoute = { funder_member_id: string; source_account_id: string; amount: number | string; funded_at: string };
export type RefundBenefitAllocationInput = { memberId: string; percentage: number };

type RefundBenefitAllocationPayload = { member_id: string; percentage: number; amount: number };

export type PostPaymentCardRefundPosition = {
  household_id: string;
  transaction_id: string;
  description: string;
  transaction_date: string;
  original_amount: number | string;
  refunded_amount: number | string;
  remaining_refundable_amount: number | string;
  card_id: string;
  card_name: string;
  responsibility_allocations: RefundResponsibilityAllocation[];
  original_funding_routes: OriginalFundingRoute[];
  future_invoice_targets: FutureInvoiceTarget[];
};

export async function listPostPaymentCardRefundPositions(client: SupabaseClient, householdId: string) {
  const result = await client.from('financial_shared_post_payment_card_refund_positions')
    .select('*').eq('household_id', householdId).order('transaction_date', { ascending: false });
  if (result.error) throw result.error;
  return (result.data ?? []) as PostPaymentCardRefundPosition[];
}

export function buildRefundBenefitAllocations(amount: string, allocations: RefundBenefitAllocationInput[]): RefundBenefitAllocationPayload[] {
  const totalCents = Math.round(Number(amount) * 100);
  const active = allocations.filter((allocation) => allocation.percentage > 0);
  const percentageTotal = active.reduce((sum, allocation) => sum + allocation.percentage, 0);
  if (!Number.isFinite(totalCents) || totalCents <= 0) throw new Error('Valor de estorno inválido.');
  if (active.length === 0 || Math.abs(percentageTotal - 100) > 0.000001) throw new Error('O benefício do estorno precisa totalizar 100%.');
  if (new Set(active.map((allocation) => allocation.memberId)).size !== active.length) throw new Error('Cada beneficiário deve aparecer uma única vez.');

  const raw = active.map((allocation, index) => {
    const exact = totalCents * allocation.percentage / 100;
    const base = Math.floor(exact);
    return { ...allocation, index, base, fraction: exact - base };
  });
  let remainder = totalCents - raw.reduce((sum, row) => sum + row.base, 0);
  const priority = [...raw].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const cents = new Map(raw.map((row) => [row.index, row.base]));
  for (const row of priority) {
    if (remainder <= 0) break;
    cents.set(row.index, (cents.get(row.index) ?? 0) + 1);
    remainder -= 1;
  }
  return raw.map((row) => ({ member_id: row.memberId, percentage: row.percentage, amount: (cents.get(row.index) ?? 0) / 100 }));
}

export async function recordPostPaymentCardRefund(client: SupabaseClient, input: {
  householdId: string;
  transactionId: string;
  outcome: 'future_invoice_credit' | 'cash_return';
  amount: string;
  benefitAllocations: RefundBenefitAllocationInput[];
  targetInvoiceId?: string | null;
  destinationAccountId?: string | null;
  occurredAt: string;
  reason: string;
}) {
  const benefitAllocations = buildRefundBenefitAllocations(input.amount, input.benefitAllocations);
  const identity=[input.householdId,input.transactionId,input.outcome,input.amount,benefitAllocations,input.targetInvoiceId??null,input.destinationAccountId??null,input.occurredAt,input.reason.trim()] as const;
  const requestKey=getRetryStableRequestKey('post-payment-card-refund',identity);
  const result = await client.rpc('record_shared_post_payment_card_refund', {
    p_household_id: input.householdId,
    p_transaction_id: input.transactionId,
    p_outcome: input.outcome,
    p_amount: input.amount,
    p_benefit_allocations: benefitAllocations,
    p_target_invoice_id: input.targetInvoiceId ?? null,
    p_destination_account_id: input.destinationAccountId ?? null,
    p_occurred_at: input.occurredAt,
    p_reason: input.reason,
    p_request_key: requestKey,
  });
  if (result.error) throw result.error;
  releaseRetryStableRequestKey('post-payment-card-refund',identity);
  return result.data as string;
}
