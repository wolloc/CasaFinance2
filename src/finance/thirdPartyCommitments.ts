import type { SupabaseClient } from '@supabase/supabase-js';

export type ThirdPartyCommitmentPosition = {
  commitment_key: string;
  source_type: string;
  source_id: string;
  source_transaction_id: string;
  source_installment_id: string | null;
  invoice_id: string | null;
  counterparty_id: string;
  counterparty_name: string;
  financial_date: string;
  financial_month: string;
  commitment_state: string;
  responsibility_amount: number;
  funded_responsibility_amount: number;
  expected_contribution_amount: number;
  received_contribution_amount: number;
  description: string;
  due_date: string | null;
  economic_date: string;
};

export async function listThirdPartyCommitmentPositions(
  client: SupabaseClient,
  householdId: string,
  financialMonth?: string,
): Promise<ThirdPartyCommitmentPosition[]> {
  let query = client
    .from('financial_third_party_commitment_positions')
    .select('commitment_key,source_type,source_id,source_transaction_id,source_installment_id,invoice_id,counterparty_id,counterparty_name,financial_date,financial_month,commitment_state,responsibility_amount,funded_responsibility_amount,expected_contribution_amount,received_contribution_amount,description,due_date,economic_date')
    .eq('household_id', householdId)
    .gt('expected_contribution_amount', 0)
    .order('financial_date', { ascending: true });

  if (financialMonth) query = query.eq('financial_month', financialMonth.slice(0, 7) + '-01');

  const response = await query;
  if (response.error) throw response.error;

  return (response.data ?? []).map((row) => ({
    ...row,
    responsibility_amount: Number(row.responsibility_amount ?? 0),
    funded_responsibility_amount: Number(row.funded_responsibility_amount ?? 0),
    expected_contribution_amount: Number(row.expected_contribution_amount ?? 0),
    received_contribution_amount: Number(row.received_contribution_amount ?? 0),
  })) as ThirdPartyCommitmentPosition[];
}
