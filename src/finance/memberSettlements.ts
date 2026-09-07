import type { SupabaseClient } from '@supabase/supabase-js';
import { runRetryStableRpc } from './retryIdempotency.js';

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

export async function getScheduledMemberSettlementContext(client: SupabaseClient, householdId: string, scheduleId: string) {
  const schedule = await client
    .from('member_settlement_schedules')
    .select('id,payer_member_id,receiver_member_id,amount,state')
    .eq('household_id', householdId)
    .eq('id', scheduleId)
    .maybeSingle();
  if (schedule.error) throw schedule.error;
  if (!schedule.data || schedule.data.state !== 'scheduled') return null;
  const positions = await listMemberSettlementPositions(client, householdId);
  const current = positions.find((row) => row.debtor_member_id === schedule.data.payer_member_id && row.creditor_member_id === schedule.data.receiver_member_id);
  const realizedOutstanding = Number(current?.realized_outstanding ?? 0);
  if (!(realizedOutstanding > 0)) return null;
  return {
    payerMemberId: schedule.data.payer_member_id as string,
    receiverMemberId: schedule.data.receiver_member_id as string,
    amount: Math.min(Number(schedule.data.amount), realizedOutstanding),
  };
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
  const notes = input.notes?.trim() || null;
  const identity = [input.householdId, input.payerMemberId, input.receiverMemberId, input.amount, input.sourceAccountId, input.destinationAccountId, notes] as const;
  return runRetryStableRpc(client, 'settle-member-position', identity, 'settle_member_position_idempotent', {
    p_household_id: input.householdId,
    p_payer_member_id: input.payerMemberId,
    p_receiver_member_id: input.receiverMemberId,
    p_amount: input.amount,
    p_source_account_id: input.sourceAccountId,
    p_destination_account_id: input.destinationAccountId,
    p_notes: notes,
  });
}
