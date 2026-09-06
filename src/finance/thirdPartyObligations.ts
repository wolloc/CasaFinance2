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
export type ReceivableLossAllocation = { memberId: string; percentage: number };
export type DebtForgivenessAllocation = { memberId: string; percentage: number };

type MemberAmountSplit = { member_id: string; percentage: number; amount: number };

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

export async function correctManualThirdPartyObligation(client: SupabaseClient, input: {
  householdId: string;
  obligationId: string;
  counterpartyId: string;
  amount: string;
  obligationDate: string;
  dueDate?: string;
  description: string;
  reason: string;
  notes?: string;
}) {
  const result = await client.rpc('correct_manual_third_party_obligation', {
    p_household_id: input.householdId,
    p_obligation_id: input.obligationId,
    p_counterparty_id: input.counterpartyId,
    p_amount: input.amount,
    p_obligation_date: input.obligationDate,
    p_due_date: input.dueDate || null,
    p_description: input.description.trim(),
    p_reason: input.reason.trim(),
    p_request_key: crypto.randomUUID(),
    p_notes: input.notes?.trim() || null,
  });
  if (result.error) throw result.error;
  return result.data as string;
}

export async function cancelManualThirdPartyObligation(client: SupabaseClient, input: {
  householdId: string;
  obligationId: string;
  reason: string;
}) {
  const result = await client.rpc('cancel_manual_third_party_obligation', {
    p_household_id: input.householdId,
    p_obligation_id: input.obligationId,
    p_reason: input.reason.trim(),
    p_request_key: crypto.randomUUID(),
  });
  if (result.error) throw result.error;
  return result.data as string;
}

function buildMemberAmountSplits(amount: string, allocations: Array<{ memberId: string; percentage: number }>, totalError: string): MemberAmountSplit[] {
  const totalCents = Math.round(Number(amount) * 100);
  const active = allocations.filter((allocation) => allocation.percentage > 0);
  const percentageTotal = active.reduce((sum, allocation) => sum + allocation.percentage, 0);
  if (!Number.isFinite(totalCents) || totalCents <= 0) throw new Error('Valor inválido.');
  if (active.length === 0 || Math.abs(percentageTotal - 100) > 0.000001) throw new Error(totalError);
  if (new Set(active.map((allocation) => allocation.memberId)).size !== active.length) throw new Error('Cada membro deve aparecer apenas uma vez.');

  const raw = active.map((allocation, index) => {
    const exact = totalCents * allocation.percentage / 100;
    const base = Math.floor(exact);
    return { ...allocation, index, base, fraction: exact - base };
  });
  let remainder = totalCents - raw.reduce((sum, row) => sum + row.base, 0);
  const priority = [...raw].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  const cents = new Map(raw.map((row) => [row.index, row.base]));
  for (const row of priority) {
    if (remainder <= 0) break;
    cents.set(row.index, (cents.get(row.index) ?? 0) + 1);
    remainder -= 1;
  }
  return raw.map((row) => ({ member_id: row.memberId, percentage: row.percentage, amount: (cents.get(row.index) ?? 0) / 100 }));
}

export function buildReceivableLossSplits(amount: string, allocations: ReceivableLossAllocation[]): MemberAmountSplit[] {
  return buildMemberAmountSplits(amount, allocations, 'A responsabilidade pela perda precisa totalizar 100%.');
}

export function buildDebtForgivenessSplits(amount: string, allocations: DebtForgivenessAllocation[]): MemberAmountSplit[] {
  return buildMemberAmountSplits(amount, allocations, 'O benefício econômico do perdão precisa totalizar 100%.');
}

export async function writeOffThirdPartyReceivable(client: SupabaseClient, input: {
  householdId: string;
  obligationId: string;
  amount: string;
  lossDate: string;
  allocations: ReceivableLossAllocation[];
  notes?: string;
}) {
  const splits = buildReceivableLossSplits(input.amount, input.allocations);
  const result = await client.rpc('write_off_receivable', {
    p_household_id: input.householdId,
    p_obligation_id: input.obligationId,
    p_amount: input.amount,
    p_loss_date: input.lossDate,
    p_splits: splits,
    p_category_id: null,
    p_notes: input.notes?.trim() || null,
  });
  if (result.error) throw result.error;
  return result.data as string;
}

export async function forgiveThirdPartyPayable(client: SupabaseClient, input: {
  householdId: string;
  obligationId: string;
  amount: string;
  forgivenDate: string;
  allocations: DebtForgivenessAllocation[];
  notes?: string;
}) {
  const splits = buildDebtForgivenessSplits(input.amount, input.allocations);
  const result = await client.rpc('forgive_payable_obligation', {
    p_household_id: input.householdId,
    p_obligation_id: input.obligationId,
    p_amount: input.amount,
    p_forgiven_date: input.forgivenDate,
    p_allocations: splits,
    p_request_key: crypto.randomUUID(),
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

export async function listEditableManualThirdPartyObligations(client: SupabaseClient, householdId: string) {
  const rows = await listOpenThirdPartyObligations(client, householdId);
  return rows.filter((row) => row.origin_kind === 'manual' && row.state === 'open' && row.settled_amount === 0);
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
