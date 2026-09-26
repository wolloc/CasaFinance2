import type { SupabaseClient } from '@supabase/supabase-js';

export type CardInvoiceItem = {
  commitment_key: string;
  source_type: string;
  source_transaction_id: string | null;
  source_installment_id: string | null;
  financial_date: string;
  economic_date: string | null;
  effective_amount: number | string;
  realized_amount: number | string;
  remaining_amount: number | string;
  commitment_state: string;
  description: string;
};

export async function listCardInvoiceItems(client: SupabaseClient, householdId: string, invoiceId: string): Promise<CardInvoiceItem[]> {
  const response = await client
    .from('financial_commitment_positions')
    .select('commitment_key,source_type,source_transaction_id,source_installment_id,financial_date,economic_date,effective_amount,realized_amount,remaining_amount,commitment_state,description')
    .eq('household_id', householdId)
    .eq('source_invoice_id', invoiceId)
    .eq('economic_type', 'expense')
    .order('financial_date', { ascending: true });
  if (response.error) throw response.error;
  return (response.data ?? []) as CardInvoiceItem[];
}
