import type { SupabaseClient } from '@supabase/supabase-js';
import { runRetryStableRpc } from './retryIdempotency.js';

export type RecurringExpenseCommitment = {
  household_id: string;
  occurrence_id: string;
  transaction_id: string;
  recurring_rule_id: string;
  description: string;
  expected_amount: string;
  remaining_amount: string;
  due_date: string;
  economic_state: 'forecast'|'confirmed'|'realized';
  commitment_state: string;
  planned_account_id: string | null;
  planned_account_name: string | null;
  attention_state: 'overdue'|'due_today'|'due_soon'|'upcoming';
};

export async function listRecurringExpenseCommitments(client: SupabaseClient, householdId: string) {
  const response = await client.from('financial_recurring_expense_attention_positions')
    .select('household_id, occurrence_id, transaction_id, recurring_rule_id, description, expected_amount, remaining_amount, due_date, economic_state, commitment_state, planned_account_id, planned_account_name, attention_state')
    .eq('household_id', householdId)
    .order('due_date', { ascending: true });
  if (response.error) throw response.error;
  return (response.data ?? []) as RecurringExpenseCommitment[];
}

export async function confirmRecurringExpenseOccurrence(client: SupabaseClient, householdId: string, occurrenceId: string, amount: string) {
  const identity = [householdId, occurrenceId, amount] as const;
  return runRetryStableRpc(client, 'confirm-recurring-expense', identity, 'confirm_recurring_expense_occurrence_idempotent', {
    p_household_id: householdId,
    p_occurrence_id: occurrenceId,
    p_confirmed_amount: amount,
  });
}

export async function settleRecurringExpenseOccurrence(client: SupabaseClient, input: { householdId: string; occurrenceId: string; accountId: string; funderMemberId: string; amount: string; paidAt: string }) {
  const identity = [input.householdId, input.occurrenceId, input.accountId, input.funderMemberId, input.amount, input.paidAt] as const;
  return runRetryStableRpc(client, 'settle-recurring-expense', identity, 'settle_recurring_expense_occurrence_idempotent', {
    p_household_id: input.householdId,
    p_occurrence_id: input.occurrenceId,
    p_source_account_id: input.accountId,
    p_funder_member_id: input.funderMemberId,
    p_amount: input.amount,
    p_paid_at: input.paidAt,
  });
}
