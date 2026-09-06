import type { SupabaseClient } from '@supabase/supabase-js';
import type { TransactionInput } from './householdTransactions.js';

export async function createAndSettleDirectExpense(
  client: SupabaseClient,
  householdId: string,
  input: TransactionInput,
  funderMemberId: string,
  paidAt: string,
) {
  if (input.instrumentKind !== 'account' || !input.accountId) throw new Error('Pagamento imediato exige uma conta de origem.');
  if (!input.buyerMemberId) throw new Error('Informe quem realizou a compra.');
  const response = await client.rpc('create_and_settle_direct_expense', {
    p_household_id: householdId,
    p_description: input.description.trim(),
    p_amount: input.amount,
    p_transaction_date: input.transactionDate,
    p_category_id: input.categoryId,
    p_buyer_member_id: input.buyerMemberId,
    p_source_account_id: input.accountId,
    p_funder_member_id: funderMemberId,
    p_splits: (input.splits ?? []).map((split) => ({
      ...(split.memberId ? { member_id: split.memberId } : { party_id: split.partyId }),
      amount: split.amount,
      percentage: split.percentage,
    })),
    p_paid_at: paidAt,
    p_notes: input.notes?.trim() || null,
  });
  if (response.error) throw response.error;
  return response.data as string;
}
