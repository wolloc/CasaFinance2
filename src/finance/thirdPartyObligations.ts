import type { SupabaseClient } from '@supabase/supabase-js';

export type ThirdPartyObligation = {
  id: string;
  household_id: string;
  kind: 'receivable' | 'payable';
  origin_kind: string;
  counterparty_id: string;
  source_transaction_id: string | null;
  original_amount: number;
  obligation_date: string;
  due_date: string | null;
  state: 'open' | 'partially_settled';
  description: string;
  counterparty_name: string;
  settled_amount: number;
  outstanding_amount: number;
};

export type FinancialPartyOption = { id: string; name: string };

export async function listFinancialPartyOptions(client: SupabaseClient, householdId: string): Promise<FinancialPartyOption[]> {
  const result = await client.from('financial_parties').select('id,name').eq('household_id', householdId).is('deactivated_at', null).order('name');
  if (result.error) throw result.error;
  return (result.data ?? []) as FinancialPartyOption[];
}

export async function createManualThirdPartyObligation(client: SupabaseClient, input: {
  householdId: string;
  kind: 'receivable' | 'payable';
  counterpartyId: string;
  amount: string;
  obligationDate: string;
  dueDate?: string;
  description: string;
  notes?: string;
}) {
  const requestKey = crypto.randomUUID();
  const result = await client.rpc('create_manual_third_party_obligation', {
    p_household_id: input.householdId,
    p_kind: input.kind,
    p_counterparty_id: input.counterpartyId,
    p_amount: input.amount,
    p_obligation_date: input.obligationDate,
    p_due_date: input.dueDate || null,
    p_description: input.description.trim(),
    p_request_key: requestKey,
    p_notes: input.notes?.trim() || null,
  });
  if (result.error) throw result.error;
  return result.data as string;
}

export async function listOpenThirdPartyObligations(client: SupabaseClient, householdId: string): Promise<ThirdPartyObligation[]> {
  const [obligations, parties, events] = await Promise.all([
    client.from('financial_obligations')
      .select('id,household_id,kind,origin_kind,counterparty_id,source_transaction_id,original_amount,obligation_date,due_date,state,description')
      .eq('household_id', householdId)
      .in('state', ['open', 'partially_settled'])
      .order('due_date', { ascending: true, nullsFirst: false }),
    client.from('financial_parties').select('id,name').eq('household_id', householdId).is('deactivated_at', null),
    client.from('obligation_events').select('obligation_id,kind,amount').eq('household_id', householdId),
  ]);
  if (obligations.error) throw obligations.error;
  if (parties.error) throw parties.error;
  if (events.error) throw events.error;

  const partyNames = new Map((parties.data ?? []).map((row) => [row.id, row.name]));
  const settledByObligation = new Map<string, number>();
  for (const event of events.data ?? []) {
    if (!['receipt', 'payment', 'cancellation', 'write_off'].includes(event.kind)) continue;
    settledByObligation.set(event.obligation_id, (settledByObligation.get(event.obligation_id) ?? 0) + Number(event.amount));
  }

  return (obligations.data ?? []).map((row) => {
    const settled = settledByObligation.get(row.id) ?? 0;
    return {
      ...row,
      original_amount: Number(row.original_amount),
      counterparty_name: partyNames.get(row.counterparty_id) ?? 'Outra pessoa',
      settled_amount: settled,
      outstanding_amount: Math.max(0, Number(row.original_amount) - settled),
    } as ThirdPartyObligation;
  }).filter((row) => row.outstanding_amount > 0);
}

export async function settleThirdPartyObligation(client: SupabaseClient, input: {
  householdId: string;
  obligationId: string;
  accountId: string;
  amount: string;
  occurredAt: string;
  funderMemberId?: string;
  notes?: string;
}) {
  const result = await client.rpc('settle_financial_obligation', {
    p_household_id: input.householdId,
    p_obligation_id: input.obligationId,
    p_account_id: input.accountId,
    p_amount: input.amount,
    p_occurred_at: input.occurredAt,
    p_funder_member_id: input.funderMemberId || null,
    p_notes: input.notes?.trim() || null,
  });
  if (result.error) throw result.error;
  return result.data as string;
}
