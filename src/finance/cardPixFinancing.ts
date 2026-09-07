import type { SupabaseClient } from '@supabase/supabase-js';
import { runRetryStableRpc } from './retryIdempotency.js';

export type CardPixAllocation = { memberId?: string; partyId?: string; amount: string; percentage: string };
export type CardPixCharge = {
  amount: string;
  categoryId: string;
  allocations: CardPixAllocation[];
  installmentCount?: number;
};

const splitPayload = (allocations: CardPixAllocation[]) => allocations.map((split) => ({
  ...(split.memberId ? { member_id: split.memberId } : { party_id: split.partyId }),
  amount: split.amount,
  percentage: split.percentage,
}));

export async function createCardPixExpense(client: SupabaseClient, input: {
  householdId: string;
  description: string;
  principalAmount: string;
  transactionDate: string;
  categoryId: string;
  buyerMemberId: string;
  cardId: string;
  responsibility: CardPixAllocation[];
  principalInstallmentCount?: number;
  fee?: CardPixCharge | null;
  interest?: CardPixCharge | null;
  notes?: string;
}) {
  const description = input.description.trim();
  const principalSplits = splitPayload(input.responsibility);
  const fee = input.fee?.amount && Number(input.fee.amount) > 0 ? input.fee : null;
  const interest = input.interest?.amount && Number(input.interest.amount) > 0 ? input.interest : null;
  const feeSplits = fee ? splitPayload(fee.allocations) : [];
  const interestSplits = interest ? splitPayload(interest.allocations) : [];
  const notes = input.notes?.trim() || null;
  const identity = [
    input.householdId, description, input.principalAmount, input.transactionDate, input.categoryId,
    input.buyerMemberId, input.cardId, principalSplits, input.principalInstallmentCount ?? 1,
    fee?.amount ?? '0', fee?.categoryId ?? null, feeSplits, fee?.installmentCount ?? 1,
    interest?.amount ?? '0', interest?.categoryId ?? null, interestSplits, interest?.installmentCount ?? 1, notes,
  ] as const;

  return runRetryStableRpc(client, 'create-card-pix-expense', identity, 'create_card_pix_expense', {
    p_household_id: input.householdId,
    p_description: description,
    p_principal_amount: input.principalAmount,
    p_transaction_date: input.transactionDate,
    p_category_id: input.categoryId,
    p_buyer_member_id: input.buyerMemberId,
    p_card_id: input.cardId,
    p_principal_splits: principalSplits,
    p_principal_installment_count: input.principalInstallmentCount ?? 1,
    p_fee_amount: fee?.amount ?? 0,
    p_fee_category_id: fee?.categoryId ?? null,
    p_fee_splits: feeSplits,
    p_fee_installment_count: fee?.installmentCount ?? 1,
    p_interest_amount: interest?.amount ?? 0,
    p_interest_category_id: interest?.categoryId ?? null,
    p_interest_splits: interestSplits,
    p_interest_installment_count: interest?.installmentCount ?? 1,
    p_notes: notes,
  });
}
