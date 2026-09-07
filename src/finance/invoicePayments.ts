import type { SupabaseClient } from '@supabase/supabase-js';
import { runRetryStableRpc } from './retryIdempotency.js';

export async function payHouseholdInvoice(client: SupabaseClient, input: {
  householdId: string;
  invoiceId: string;
  sourceAccountId: string;
  funderMemberId: string;
  amount: string;
  paidAt: string;
}) {
  const identity = [input.householdId, input.invoiceId, input.sourceAccountId, input.funderMemberId, input.amount, input.paidAt] as const;
  return runRetryStableRpc(client, 'pay-card-invoice', identity, 'pay_card_invoice_idempotent', {
    p_household_id: input.householdId,
    p_invoice_id: input.invoiceId,
    p_source_account_id: input.sourceAccountId,
    p_funder_member_id: input.funderMemberId,
    p_amount: input.amount,
    p_paid_at: input.paidAt,
  });
}
