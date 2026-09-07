import type { SupabaseClient } from '@supabase/supabase-js';
import type { TransactionInput } from './householdTransactions.js';
import { runRetryStableRpc } from './retryIdempotency.js';

export async function createAndSettleDirectExpense(
  client: SupabaseClient,
  householdId: string,
  input: TransactionInput,
  funderMemberId: string,
  paidAt: string,
) {
  if (input.instrumentKind !== 'account' || !input.accountId) throw new Error('Pagamento imediato exige uma conta de origem.');
  if (!input.buyerMemberId) throw new Error('Informe quem realizou a compra.');
  const splits = (input.splits ?? []).map((split) => ({
    ...(split.memberId ? { member_id: split.memberId } : { party_id: split.partyId }),
    amount: split.amount,
    percentage: split.percentage,
  }));
  const description = input.description.trim();
  const notes = input.notes?.trim() || null;
  const identity = [householdId,description,input.amount,input.transactionDate,input.categoryId,input.buyerMemberId,input.accountId,funderMemberId,splits,paidAt,notes] as const;
  return runRetryStableRpc(client,'create-settle-direct-expense',identity,'create_and_settle_direct_expense_idempotent',{
    p_household_id:householdId,p_description:description,p_amount:input.amount,p_transaction_date:input.transactionDate,p_category_id:input.categoryId,p_buyer_member_id:input.buyerMemberId,p_source_account_id:input.accountId,p_funder_member_id:funderMemberId,p_splits:splits,p_paid_at:paidAt,p_notes:notes,
  });
}
