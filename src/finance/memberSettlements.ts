import type { SupabaseClient } from '@supabase/supabase-js';

export type MemberSettlementPosition = {
  household_id: string;
  debtor_member_id: string;
  creditor_member_id: string;
  realized_outstanding: string;
  projected_outstanding: string;
  scheduled_settlement_amount: string;
  net_position: string;
};

export async function listMemberSettlementPositions(client: SupabaseClient, householdId: string) {
  const response = await client
    .from('financial_member_settlement_positions')
    .select('household_id, debtor_member_id, creditor_member_id, realized_outstanding, projected_outstanding, scheduled_settlement_amount, net_position')
    .eq('household_id', householdId);
  if (response.error) throw response.error;
  return (response.data ?? []) as MemberSettlementPosition[];
}

export async function settleMemberPosition(client: SupabaseClient, input: {
  householdId: string;
  payerMemberId: string;
  receiverMemberId: string;
  amount: string;
  sourceAccountId: string;
  destinationAccountId: string;
  notes?: string;
}) {
  const response = await client.rpc('settle_member_position', {
    p_household_id: input.householdId,
    p_payer_member_id: input.payerMemberId,
    p_receiver_member_id: input.receiverMemberId,
    p_amount: input.amount,
    p_source_account_id: input.sourceAccountId,
    p_destination_account_id: input.destinationAccountId,
    p_notes: input.notes?.trim() || null,
  });
  if (response.error) throw response.error;
  return response.data as string;
}
