import type { SupabaseClient } from '@supabase/supabase-js';

export type FinancialParty = { id: string; name: string };

export async function listFinancialParties(client: SupabaseClient, householdId: string): Promise<FinancialParty[]> {
  const result = await client.from('financial_parties')
    .select('id,name')
    .eq('household_id', householdId)
    .is('deactivated_at', null)
    .order('name');
  if (result.error) throw result.error;
  return (result.data ?? []) as FinancialParty[];
}

export async function createFinancialParty(client: SupabaseClient, householdId: string, name: string) {
  const result = await client.rpc('create_financial_party', {
    p_household_id: householdId,
    p_name: name.trim(),
    p_kind: 'person',
    p_tax_id: null,
    p_notes: null,
  });
  if (result.error) throw result.error;
  return result.data as string;
}

export async function createLoanPrincipal(client: SupabaseClient, input: {
  householdId: string;
  direction: 'granted' | 'taken';
  counterpartyId: string;
  accountId: string;
  amount: string;
  occurredAt: string;
  dueDate?: string;
  description: string;
  notes?: string;
}) {
  const result = await client.rpc('create_loan_principal', {
    p_household_id: input.householdId,
    p_direction: input.direction,
    p_counterparty_id: input.counterpartyId,
    p_account_id: input.accountId,
    p_amount: input.amount,
    p_occurred_at: input.occurredAt,
    p_due_date: input.dueDate || null,
    p_description: input.description.trim() || 'Empréstimo',
    p_notes: input.notes?.trim() || null,
  });
  if (result.error) throw result.error;
  return result.data as string;
}
