import type { SupabaseClient } from '@supabase/supabase-js';

export async function payHouseholdInvoice(client: SupabaseClient, input: {
  householdId: string;
  invoiceId: string;
  sourceAccountId: string;
  funderMemberId: string;
  amount: string;
  paidAt: string;
}) {
  const response = await client.rpc('pay_card_invoice', {
    p_household_id: input.householdId,
    p_invoice_id: input.invoiceId,
    p_source_account_id: input.sourceAccountId,
    p_funder_member_id: input.funderMemberId,
    p_amount: input.amount,
    p_paid_at: input.paidAt,
  });
  if (response.error) throw response.error;
  return response.data as string;
}
