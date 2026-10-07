import type { SupabaseClient } from '@supabase/supabase-js';
import { getRetryStableRequestKey, releaseRetryStableRequestKey } from './retryIdempotency.js';

export async function correctCardPaymentInstrument(client: SupabaseClient, input: {
  householdId: string;
  transactionId: string;
  targetCardId: string;
}) {
  const reason = 'Cartão corrigido pelo usuário';
  const identity = [input.householdId, input.transactionId, input.targetCardId, reason] as const;
  const requestKey = getRetryStableRequestKey('card-instrument-correction', identity);
  const response = await client.rpc('correct_card_payment_instrument', {
    p_household_id: input.householdId,
    p_transaction_id: input.transactionId,
    p_target_card_id: input.targetCardId,
    p_reason: reason,
    p_request_key: requestKey,
  });
  if (response.error) throw response.error;
  releaseRetryStableRequestKey('card-instrument-correction', identity);
  return response.data as string;
}
