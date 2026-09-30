import type { SupabaseClient } from '@supabase/supabase-js';

export type OverdueCommitmentContext =
  | { kind: 'direct-expense'; transactionId: string }
  | { kind: 'recurring-expense'; occurrenceId: string }
  | { kind: 'loan'; obligationId: string };

export async function getOverdueCommitmentContext(client: SupabaseClient, householdId: string, commitmentKey: string): Promise<OverdueCommitmentContext | null> {
  const response = await client
    .from('financial_commitment_positions')
    .select('commitment_key,source_type,source_transaction_id,source_invoice_id,source_obligation_id,source_recurring_occurrence_id,remaining_amount,is_overdue,commitment_state')
    .eq('household_id', householdId)
    .eq('commitment_key', commitmentKey)
    .maybeSingle();
  if (response.error) throw response.error;
  const row = response.data;
  if (!row || !row.is_overdue || Number(row.remaining_amount) <= 0 || row.commitment_state === 'cancelled' || row.commitment_state === 'reversed') return null;
  if (row.source_type === 'loan_schedule_item' && row.source_obligation_id) return { kind: 'loan', obligationId: row.source_obligation_id as string };
  if (row.source_invoice_id || row.source_obligation_id) return null;
  if (row.source_type === 'recurring_occurrence' && row.source_recurring_occurrence_id) return { kind: 'recurring-expense', occurrenceId: row.source_recurring_occurrence_id as string };
  if (row.source_type === 'direct_expense' && row.source_transaction_id) return { kind: 'direct-expense', transactionId: row.source_transaction_id as string };
  return null;
}
