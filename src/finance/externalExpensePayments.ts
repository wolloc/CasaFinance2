import type { SupabaseClient } from '@supabase/supabase-js';
import { getRetryStableRequestKey, releaseRetryStableRequestKey } from './retryIdempotency.js';

export type ExternalPaymentIntent = 'gift' | 'reimbursement';

export async function recordExternalExpensePayment(client: SupabaseClient, input: {
  householdId: string;
  transactionId: string;
  payerPartyId: string;
  intent: ExternalPaymentIntent;
  amount: string;
  occurredAt: string;
  dueDate?: string | null;
  notes?: string;
}) {
  const dueDate = input.intent === 'reimbursement' ? input.dueDate || null : null;
  const identity=[input.householdId,input.transactionId,input.payerPartyId,input.intent,input.amount,input.occurredAt,dueDate,input.notes?.trim()||null] as const;
  const requestKey = getRetryStableRequestKey('external-expense-payment', identity);
  const result = await client.rpc('record_external_expense_payment', {
    p_household_id: input.householdId,
    p_transaction_id: input.transactionId,
    p_payer_party_id: input.payerPartyId,
    p_intent: input.intent,
    p_amount: input.amount,
    p_occurred_at: input.occurredAt,
    p_request_key: requestKey,
    p_due_date: dueDate,
    p_notes: input.notes?.trim() || null,
  });
  if (result.error) throw result.error;
  releaseRetryStableRequestKey('external-expense-payment', identity);
  return result.data as string;
}
