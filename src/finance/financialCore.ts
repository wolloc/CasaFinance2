import type { SupabaseClient } from '@supabase/supabase-js';
import type { InstrumentKind } from './householdTransactions.js';

export type SplitInput = { memberId: string; percentage: string; amount: string };

export async function createExpenseBundle(client: SupabaseClient, input: {
  householdId: string;
  description: string;
  amount: string;
  transactionDate: string;
  categoryId: string;
  buyerMemberId: string;
  instrumentKind: InstrumentKind;
  accountId?: string;
  cardId?: string;
  notes?: string;
  splits?: SplitInput[];
  installmentCount?: number;
}) {
  const response = await client.rpc('create_expense_bundle', {
    p_household_id: input.householdId,
    p_description: input.description.trim(),
    p_amount: input.amount,
    p_transaction_date: input.transactionDate,
    p_category_id: input.categoryId,
    p_buyer_member_id: input.buyerMemberId,
    p_instrument_kind: input.instrumentKind,
    p_account_id: input.instrumentKind === 'account' ? input.accountId : null,
    p_card_id: input.instrumentKind === 'card' ? input.cardId : null,
    p_notes: input.notes?.trim() || null,
    p_splits: input.splits?.map((split) => ({ member_id: split.memberId, percentage: split.percentage, amount: split.amount })) ?? null,
    p_installment_count: input.installmentCount ?? 1,
  });
  if (response.error) throw response.error;
  return response.data as string;
}

export async function createIncomeTransaction(client: SupabaseClient, input: { householdId: string; description: string; amount: string; transactionDate: string; categoryId: string; notes?: string }) {
  const response = await client.rpc('create_income_transaction', {
    p_household_id: input.householdId,
    p_description: input.description.trim(),
    p_amount: input.amount,
    p_transaction_date: input.transactionDate,
    p_category_id: input.categoryId,
    p_notes: input.notes?.trim() || null,
  });
  if (response.error) throw response.error;
  return response.data as string;
}

export async function createTransfer(client: SupabaseClient, input: { householdId: string; sourceAccountId: string; destinationAccountId: string; amount: string; transactionDate: string; notes?: string }) {
  const response = await client.rpc('create_transfer', {
    p_household_id: input.householdId,
    p_source_account_id: input.sourceAccountId,
    p_destination_account_id: input.destinationAccountId,
    p_amount: input.amount,
    p_transaction_date: input.transactionDate,
    p_notes: input.notes?.trim() || null,
  });
  if (response.error) throw response.error;
  return response.data as string;
}

export async function payCardInvoice(client: SupabaseClient, input: { householdId: string; invoiceId: string; sourceAccountId: string; funderMemberId: string; amount: string }) {
  const response = await client.rpc('pay_card_invoice', {
    p_household_id: input.householdId,
    p_invoice_id: input.invoiceId,
    p_source_account_id: input.sourceAccountId,
    p_funder_member_id: input.funderMemberId,
    p_amount: input.amount,
  });
  if (response.error) throw response.error;
  return response.data as string;
}

export async function createRecurringRule(client: SupabaseClient, input: { householdId: string; templateTransactionId: string; frequency: 'weekly' | 'monthly' | 'yearly'; intervalCount: number; startDate: string; endDate?: string }) {
  const response = await client.rpc('create_recurring_rule', {
    p_household_id: input.householdId,
    p_template_transaction_id: input.templateTransactionId,
    p_frequency: input.frequency,
    p_interval_count: input.intervalCount,
    p_start_date: input.startDate,
    p_end_date: input.endDate || null,
  });
  if (response.error) throw response.error;
  return response.data as string;
}

export async function generateRecurringOccurrence(client: SupabaseClient, input: { householdId: string; ruleId: string; competenceDate: string }) {
  const response = await client.rpc('generate_recurring_occurrence', {
    p_household_id: input.householdId,
    p_rule_id: input.ruleId,
    p_competence_date: input.competenceDate,
  });
  if (response.error) throw response.error;
  return response.data as string;
}
