import type { SupabaseClient } from '@supabase/supabase-js';
import type { IncomeConfidence, IncomeNature } from './incomeFacts.js';

export type RecurringIncomeFrequency = 'monthly' | 'yearly';

export async function createRecurringIncomeRule(client: SupabaseClient, input: {
  householdId: string;
  description: string;
  amount: string;
  startDate: string;
  endDate?: string;
  frequency: RecurringIncomeFrequency;
  categoryId: string;
  beneficiaryMemberId: string;
  plannedDestinationAccountId: string;
  incomeNature: IncomeNature;
  economicState: IncomeConfidence;
  notes?: string;
}) {
  const result = await client.rpc('create_recurring_income_rule', {
    p_household_id: input.householdId,
    p_description: input.description.trim(),
    p_amount: input.amount,
    p_start_date: input.startDate,
    p_end_date: input.endDate || null,
    p_frequency: input.frequency,
    p_category_id: input.categoryId,
    p_beneficiary_member_id: input.beneficiaryMemberId,
    p_planned_destination_account_id: input.plannedDestinationAccountId,
    p_income_nature: input.incomeNature,
    p_economic_state: input.economicState,
    p_notes: input.notes?.trim() || null,
  });
  if (result.error) throw result.error;
  return result.data as string;
}

export async function ensureRecurringIncomeHorizon(client: SupabaseClient, householdId: string, throughDate: string) {
  const result = await client.rpc('ensure_household_recurring_income_horizon', {
    p_household_id: householdId,
    p_through_date: throughDate,
  });
  if (result.error) throw result.error;
  return Number(result.data ?? 0);
}
