import type { SupabaseClient } from '@supabase/supabase-js';

export type DirectExpensePaymentCandidate = {
  id: string;
  description: string;
  amount: string;
  realized_amount: string;
  economic_state: string;
  status: string;
  transaction_date: string;
  payment_instrument: { kind: 'account' | 'card'; account_id: string | null; card_id: string | null } | null;
  funded_amount: number;
  external_paid_amount: number;
  remaining_amount: number;
};

export async function listDirectExpensePaymentCandidates(client: SupabaseClient, householdId: string) {
  const txResponse = await client.from('transactions')
    .select('id, description, amount, realized_amount, economic_state, status, transaction_date, invoice_id, deleted_at, payment_instrument:transaction_payment_instruments(kind, account_id, card_id)')
    .eq('household_id', householdId)
    .eq('type', 'expense')
    .is('deleted_at', null)
    .not('economic_state', 'in', '(cancelled,reversed)')
    .order('transaction_date', { ascending: false });
  if (txResponse.error) throw txResponse.error;

  const rows = txResponse.data ?? [];
  const ids = rows.map((row) => row.id as string);
  if (ids.length === 0) return [] as DirectExpensePaymentCandidate[];

  const [fundingResponse, externalResponse, installmentResponse] = await Promise.all([
    client.from('funding_events').select('financed_transaction_id, amount, invoice_id').eq('household_id', householdId).in('financed_transaction_id', ids),
    client.from('external_payment_events').select('source_transaction_id, amount').eq('household_id', householdId).in('source_transaction_id', ids),
    client.from('installment_plans').select('purchase_transaction_id').eq('household_id', householdId).in('purchase_transaction_id', ids),
  ]);
  for (const response of [fundingResponse, externalResponse, installmentResponse]) if (response.error) throw response.error;

  const funding = new Map<string, number>();
  for (const event of fundingResponse.data ?? []) if (event.invoice_id === null) funding.set(event.financed_transaction_id as string, (funding.get(event.financed_transaction_id as string) ?? 0) + Number(event.amount));
  const external = new Map<string, number>();
  for (const event of externalResponse.data ?? []) external.set(event.source_transaction_id as string, (external.get(event.source_transaction_id as string) ?? 0) + Number(event.amount));
  const installmentIds = new Set((installmentResponse.data ?? []).map((row) => row.purchase_transaction_id as string));

  return rows.flatMap((row) => {
    const instrument = (Array.isArray(row.payment_instrument) ? row.payment_instrument[0] : row.payment_instrument) as DirectExpensePaymentCandidate['payment_instrument'];
    // Card purchases are funded when the invoice is paid, never through the direct-expense route.
    if (row.invoice_id || instrument?.kind === 'card' || installmentIds.has(row.id as string)) return [];
    const fundedAmount = funding.get(row.id as string) ?? 0;
    const externalPaidAmount = external.get(row.id as string) ?? 0;
    const remaining = Math.max(0, Number(row.amount) - fundedAmount - externalPaidAmount);
    if (remaining < 0.005) return [];
    return [{
      id: row.id as string,
      description: row.description as string,
      amount: String(row.amount),
      realized_amount: String(row.realized_amount),
      economic_state: row.economic_state as string,
      status: row.status as string,
      transaction_date: row.transaction_date as string,
      payment_instrument: instrument ?? null,
      funded_amount: fundedAmount,
      external_paid_amount: externalPaidAmount,
      remaining_amount: remaining,
    }];
  });
}

export async function settleDirectExpense(client: SupabaseClient, input: {
  householdId: string;
  transactionId: string;
  sourceAccountId: string;
  funderMemberId: string;
  amount: string;
  paidAt: string;
}) {
  const result = await client.rpc('settle_direct_expense', {
    p_household_id: input.householdId,
    p_transaction_id: input.transactionId,
    p_source_account_id: input.sourceAccountId,
    p_funder_member_id: input.funderMemberId,
    p_amount: input.amount,
    p_paid_at: input.paidAt,
  });
  if (result.error) throw result.error;
  return result.data as string;
}
