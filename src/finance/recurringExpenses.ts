import type { SupabaseClient } from '@supabase/supabase-js';

export type RecurringExpenseFrequency = 'weekly' | 'monthly' | 'yearly';

export async function createRecurringExpenseFromTransaction(client: SupabaseClient, input: {
  householdId: string;
  transactionId: string;
  frequency: RecurringExpenseFrequency;
  intervalCount: number;
  startDate: string;
  endDate?: string;
}) {
  const result = await client.rpc('create_recurring_expense_rule_from_transaction', {
    p_household_id: input.householdId,
    p_template_transaction_id: input.transactionId,
    p_frequency: input.frequency,
    p_interval_count: input.intervalCount,
    p_start_date: input.startDate,
    p_end_date: input.endDate || null,
  });
  if (result.error) throw result.error;
  return result.data as string;
}

export async function ensureRecurringExpenseHorizon(client: SupabaseClient, householdId: string, throughDate: string) {
  const result = await client.rpc('ensure_household_recurring_expense_horizon', {
    p_household_id: householdId,
    p_through_date: throughDate,
  });
  if (result.error) throw result.error;
  return Number(result.data ?? 0);
}
