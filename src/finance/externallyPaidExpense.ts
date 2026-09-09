import type { SupabaseClient } from '@supabase/supabase-js';
import { runRetryStableRpc } from './retryIdempotency.js';

export type ExternalExpenseAllocation = {
  memberId?: string;
  partyId?: string;
  amount: string;
  percentage: string;
};

const splitPayload = (allocations: ExternalExpenseAllocation[]) => allocations.map((split) => ({
  ...(split.memberId ? { member_id: split.memberId } : { party_id: split.partyId }),
  amount: split.amount,
  percentage: split.percentage,
}));

export async function createExternallyPaidExpense(client: SupabaseClient, input: {
  householdId: string;
  description: string;
  amount: string;
  transactionDate: string;
  categoryId?: string | null;
  buyerMemberId: string;
  responsibility: ExternalExpenseAllocation[];
  payerPartyId: string;
  needsRepayment: boolean;
  dueDate?: string | null;
  notes?: string;
}) {
  const description = input.description.trim();
  const splits = splitPayload(input.responsibility);
  const dueDate = input.needsRepayment ? input.dueDate || null : null;
  const notes = input.notes?.trim() || null;
  const identity = [
    input.householdId,
    description,
    input.amount,
    input.transactionDate,
    input.categoryId ?? null,
    input.buyerMemberId,
    splits,
    input.payerPartyId,
    input.needsRepayment,
    dueDate,
    notes,
  ] as const;

  return runRetryStableRpc(client, 'create-externally-paid-expense', identity, 'create_externally_paid_expense', {
    p_household_id: input.householdId,
    p_description: description,
    p_amount: input.amount,
    p_transaction_date: input.transactionDate,
    p_category_id: input.categoryId ?? null,
    p_buyer_member_id: input.buyerMemberId,
    p_splits: splits,
    p_payer_party_id: input.payerPartyId,
    p_needs_repayment: input.needsRepayment,
    p_due_date: dueDate,
    p_notes: notes,
  });
}
