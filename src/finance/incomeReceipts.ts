import type { SupabaseClient } from '@supabase/supabase-js';

export type IncomeReceiptInput = {
  householdId: string;
  transactionId: string;
  destinationAccountId: string;
  beneficiaryMemberId: string;
  amount: string;
  receivedAt: string;
};

export async function settleHouseholdIncome(client: SupabaseClient, input: IncomeReceiptInput) {
  const response = await client.rpc('settle_income', {
    p_household_id: input.householdId,
    p_transaction_id: input.transactionId,
    p_destination_account_id: input.destinationAccountId,
    p_beneficiary_member_id: input.beneficiaryMemberId,
    p_amount: input.amount,
    p_received_at: input.receivedAt,
  });
  if (response.error) throw response.error;
  return response.data as string;
}
