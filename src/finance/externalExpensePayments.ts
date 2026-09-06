import type { SupabaseClient } from '@supabase/supabase-js';

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
  const requestKey = crypto.randomUUID();
  const result = await client.rpc('record_external_expense_payment', {
    p_household_id: input.householdId,
    p_transaction_id: input.transactionId,
    p_payer_party_id: input.payerPartyId,
    p_intent: input.intent,
    p_amount: input.amount,
    p_occurred_at: input.occurredAt,
    p_request_key: requestKey,
    p_due_date: input.intent === 'reimbursement' ? input.dueDate || null : null,
    p_notes: input.notes?.trim() || null,
  });
  if (result.error) throw result.error;
  return result.data as string;
}
