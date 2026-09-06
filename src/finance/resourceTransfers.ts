import type { SupabaseClient } from '@supabase/supabase-js';

export async function createResourceTransfer(client: SupabaseClient, input: {
  householdId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  amount: string;
  date: string;
  description?: string;
}) {
  const response = await client.rpc('create_transfer', {
    p_household_id: input.householdId,
    p_source_account_id: input.sourceAccountId,
    p_destination_account_id: input.destinationAccountId,
    p_amount: input.amount,
    p_date: input.date,
    p_description: input.description?.trim() || 'Transferência',
  });
  if (response.error) throw response.error;
  return response.data as string;
}
