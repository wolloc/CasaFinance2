import type { SupabaseClient } from '@supabase/supabase-js';
import { runRetryStableRpc } from './retryIdempotency.js';

export type SimpleCardPixAllocation = { memberId?: string; partyId?: string; amount: string; percentage: string };

const splitPayload = (allocations: SimpleCardPixAllocation[]) => allocations.map((split) => ({
  ...(split.memberId ? { member_id: split.memberId } : { party_id: split.partyId }),
  amount: split.amount,
  percentage: split.percentage,
}));

export async function createSimpleCardPixExpense(client: SupabaseClient, input: {
  householdId: string;
  description: string;
  principalAmount: string;
  financialChargeAmount: string;
  transactionDate: string;
  categoryId?: string | null;
  buyerMemberId: string;
  cardId: string;
  principalResponsibility: SimpleCardPixAllocation[];
  chargeResponsibility: SimpleCardPixAllocation[];
  installmentCount: number;
  notes?: string;
}) {
  const principalSplits = splitPayload(input.principalResponsibility);
  const chargeSplits = Number(input.financialChargeAmount) > 0 ? splitPayload(input.chargeResponsibility) : [];
  const notes = input.notes?.trim() || null;
  const identity = [
    input.householdId,
    input.description.trim(),
    input.principalAmount,
    input.financialChargeAmount,
    input.transactionDate,
    input.categoryId ?? null,
    input.buyerMemberId,
    input.cardId,
    principalSplits,
    chargeSplits,
    input.installmentCount,
    notes,
  ] as const;

  return runRetryStableRpc(client, 'create-simple-card-pix-expense', identity, 'create_simple_card_pix_expense', {
    p_household_id: input.householdId,
    p_description: input.description.trim(),
    p_principal_amount: input.principalAmount,
    p_financial_charge_amount: input.financialChargeAmount,
    p_transaction_date: input.transactionDate,
    p_category_id: input.categoryId || null,
    p_buyer_member_id: input.buyerMemberId,
    p_card_id: input.cardId,
    p_principal_splits: principalSplits,
    p_charge_splits: chargeSplits,
    p_installment_count: input.installmentCount,
    p_notes: notes,
  });
}
