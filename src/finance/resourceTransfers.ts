import type { SupabaseClient } from '@supabase/supabase-js';
import { runRetryStableRpc } from './retryIdempotency.js';

export async function createResourceTransfer(client: SupabaseClient, input: {
  householdId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string;
  date: string;
  description?: string;
}) {
  const description = input.description?.trim() || 'Transferência';
  const identity = [input.householdId, input.sourceAccountId, input.destinationAccountId, input.amount, input.date, description] as const;
  return runRetryStableRpc(client, 'create-transfer', identity, 'create_transfer_idempotent', {
    p_household_id: input.householdId,
    p_source_account_id: input.sourceAccountId,
    p_destination_account_id: input.destinationAccountId,
    p_amount: input.amount,
    p_date: input.date,
    p_description: description,
  });
}


export async function createMemberPositionTransfer(client: SupabaseClient, input: {
  householdId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string;
  date: string;
  description?: string;
}) {
  const description = input.description?.trim() || 'Transferência entre membros';
  const identity = [input.householdId, input.sourceAccountId, input.destinationAccountId, input.amount, input.date, description] as const;
  return runRetryStableRpc(client, 'member-position-transfer', identity, 'create_member_position_transfer_idempotent', {
    p_household_id: input.householdId,
    p_source_account_id: input.sourceAccountId,
    p_destination_account_id: input.destinationAccountId,
    p_amount: input.amount,
    p_date: input.date,
    p_description: description,
  });
}
