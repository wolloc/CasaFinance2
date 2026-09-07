import type { SupabaseClient } from '@supabase/supabase-js';
import type { IncomeConfidence, IncomeNature } from './incomeFacts.js';
import { runRetryStableRpc } from './retryIdempotency.js';

export type RecurringIncomeFrequency = 'monthly' | 'yearly';

export type RecurringIncomeRule = {
  id: string;
  income_description: string;
  estimated_amount: string;
  frequency: RecurringIncomeFrequency;
  start_date: string;
  end_date: string | null;
  income_category_id: string;
  income_beneficiary_member_id: string;
  income_destination_account_id: string;
  income_nature: IncomeNature;
  income_economic_state: IncomeConfidence;
  income_notes: string | null;
};

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
  const description = input.description.trim();
  const endDate = input.endDate || null;
  const notes = input.notes?.trim() || null;
  const identity = [input.householdId, description, input.amount, input.startDate, endDate, input.frequency, input.categoryId, input.beneficiaryMemberId, input.plannedDestinationAccountId, input.incomeNature, input.economicState, notes] as const;
  return runRetryStableRpc(client, 'create-recurring-income', identity, 'create_recurring_income_rule_idempotent', {
    p_household_id: input.householdId,
    p_description: description,
    p_amount: input.amount,
    p_start_date: input.startDate,
    p_end_date: endDate,
    p_frequency: input.frequency,
    p_category_id: input.categoryId,
    p_beneficiary_member_id: input.beneficiaryMemberId,
    p_planned_destination_account_id: input.plannedDestinationAccountId,
    p_income_nature: input.incomeNature,
    p_economic_state: input.economicState,
    p_notes: notes,
  });
}

export async function ensureRecurringIncomeHorizon(client: SupabaseClient, householdId: string, throughDate: string) {
  const result = await client.rpc('ensure_household_recurring_income_horizon', {
    p_household_id: householdId,
    p_through_date: throughDate,
  });
  if (result.error) throw result.error;
  return Number(result.data ?? 0);
}

export async function listRecurringIncomeRules(client: SupabaseClient, householdId: string) {
  const result = await client
    .from('recurring_rules')
    .select('id,income_description,estimated_amount,frequency,start_date,end_date,income_category_id,income_beneficiary_member_id,income_destination_account_id,income_nature,income_economic_state,income_notes')
    .eq('household_id', householdId)
    .is('deactivated_at', null)
    .not('income_nature', 'is', null)
    .order('start_date');
  if (result.error) throw result.error;
  return (result.data ?? []) as RecurringIncomeRule[];
}

export async function reviseRecurringIncomeRule(client: SupabaseClient, householdId: string, rule: RecurringIncomeRule, input: {
  effectiveFrom: string;
  amount: string;
  frequency: RecurringIncomeFrequency;
  endDate?: string;
  reason: string;
}) {
  const endDate = input.endDate || null;
  const reason = input.reason.trim();
  const identity = [householdId, rule.id, input.effectiveFrom, rule.income_description, input.amount, input.frequency, rule.income_category_id, rule.income_beneficiary_member_id, rule.income_destination_account_id, rule.income_nature, rule.income_economic_state, endDate, rule.income_notes, reason] as const;
  return runRetryStableRpc(client, 'revise-recurring-income', identity, 'revise_recurring_income_rule_idempotent', {
    p_household_id: householdId,
    p_rule_id: rule.id,
    p_effective_from: input.effectiveFrom,
    p_description: rule.income_description,
    p_amount: input.amount,
    p_frequency: input.frequency,
    p_category_id: rule.income_category_id,
    p_beneficiary_member_id: rule.income_beneficiary_member_id,
    p_planned_destination_account_id: rule.income_destination_account_id,
    p_income_nature: rule.income_nature,
    p_economic_state: rule.income_economic_state,
    p_end_date: endDate,
    p_notes: rule.income_notes,
    p_reason: reason,
  });
}

export async function closeRecurringIncomeRule(client: SupabaseClient, householdId: string, ruleId: string, effectiveFrom: string, reason: string) {
  const normalizedReason = reason.trim();
  const identity = [householdId, ruleId, effectiveFrom, normalizedReason] as const;
  return runRetryStableRpc(client, 'close-recurring-income', identity, 'close_recurring_income_rule_idempotent', {
    p_household_id: householdId,
    p_rule_id: ruleId,
    p_effective_from: effectiveFrom,
    p_reason: normalizedReason,
  });
}
