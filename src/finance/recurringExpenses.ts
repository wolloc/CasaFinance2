import type { SupabaseClient } from '@supabase/supabase-js';
import { runRetryStableRpc } from './retryIdempotency.js';

export type RecurringExpenseFrequency = 'weekly' | 'monthly' | 'yearly';
export type RecurringExpenseRule = {
  id: string;
  template_transaction_id: string;
  frequency: RecurringExpenseFrequency;
  interval_count: number;
  start_date: string;
  end_date: string | null;
  estimated_amount: string;
  next_occurrence_date: string | null;
  template_description: string;
};

export async function createRecurringExpenseFromTransaction(client: SupabaseClient, input: {
  householdId: string;
  transactionId: string;
  frequency: RecurringExpenseFrequency;
  intervalCount: number;
  startDate: string;
  endDate?: string;
}) {
  const endDate=input.endDate||null;
  const identity=[input.householdId,input.transactionId,input.frequency,input.intervalCount,input.startDate,endDate] as const;
  return runRetryStableRpc(client,'create-recurring-expense',identity,'create_recurring_expense_rule_from_transaction_idempotent',{
    p_household_id:input.householdId,p_template_transaction_id:input.transactionId,p_frequency:input.frequency,p_interval_count:input.intervalCount,p_start_date:input.startDate,p_end_date:endDate,
  });
}

export async function ensureRecurringExpenseHorizon(client: SupabaseClient, householdId: string, throughDate: string) {
  const result = await client.rpc('ensure_household_recurring_expense_horizon', {
    p_household_id: householdId,
    p_through_date: throughDate,
  });
  if (result.error) throw result.error;
  return Number(result.data ?? 0);
}

export async function listRecurringExpenseRules(client: SupabaseClient, householdId: string) {
  const rulesResponse = await client.from('recurring_rules')
    .select('id, template_transaction_id, frequency, interval_count, start_date, end_date, estimated_amount, next_occurrence_date')
    .eq('household_id', householdId)
    .is('deactivated_at', null)
    .is('income_nature', null)
    .not('template_transaction_id', 'is', null)
    .not('estimated_amount', 'is', null)
    .order('created_at', { ascending: false });
  if (rulesResponse.error) throw rulesResponse.error;
  const rules = rulesResponse.data ?? [];
  const templateIds = rules.map((row) => row.template_transaction_id as string).filter(Boolean);
  if (templateIds.length === 0) return [] as RecurringExpenseRule[];

  const txResponse = await client.from('transactions')
    .select('id, description, type, deleted_at')
    .eq('household_id', householdId)
    .in('id', templateIds);
  if (txResponse.error) throw txResponse.error;
  const descriptions = new Map((txResponse.data ?? []).filter((row) => row.type === 'expense' && row.deleted_at === null).map((row) => [row.id as string, row.description as string]));

  return rules.filter((row) => descriptions.has(row.template_transaction_id as string)).map((row) => ({
    id: row.id as string,
    template_transaction_id: row.template_transaction_id as string,
    frequency: row.frequency as RecurringExpenseFrequency,
    interval_count: Number(row.interval_count),
    start_date: row.start_date as string,
    end_date: row.end_date as string | null,
    estimated_amount: String(row.estimated_amount),
    next_occurrence_date: row.next_occurrence_date as string | null,
    template_description: descriptions.get(row.template_transaction_id as string) ?? 'Gasto recorrente',
  }));
}

export async function reviseRecurringExpenseRule(client: SupabaseClient, input: {
  householdId: string;
  ruleId: string;
  effectiveFrom: string;
  amount: string;
  frequency: RecurringExpenseFrequency;
  intervalCount: number;
  endDate?: string;
  reason: string;
}) {
  const endDate=input.endDate||null;const reason=input.reason.trim();
  const identity=[input.householdId,input.ruleId,input.effectiveFrom,input.amount,input.frequency,input.intervalCount,endDate,reason] as const;
  return runRetryStableRpc(client,'revise-recurring-expense',identity,'revise_recurring_expense_rule_idempotent',{
    p_household_id:input.householdId,p_rule_id:input.ruleId,p_effective_from:input.effectiveFrom,p_amount:input.amount,p_frequency:input.frequency,p_interval_count:input.intervalCount,p_end_date:endDate,p_reason:reason,
  });
}

export async function closeRecurringExpenseRule(client: SupabaseClient, input: {
  householdId: string;
  ruleId: string;
  effectiveFrom: string;
  reason: string;
}) {
  const reason=input.reason.trim();const identity=[input.householdId,input.ruleId,input.effectiveFrom,reason] as const;
  return runRetryStableRpc(client,'close-recurring-expense',identity,'close_recurring_expense_rule_idempotent',{p_household_id:input.householdId,p_rule_id:input.ruleId,p_effective_from:input.effectiveFrom,p_reason:reason});
}
