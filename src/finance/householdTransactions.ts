import type { SupabaseClient } from '@supabase/supabase-js';

export type TransactionKind = 'expense' | 'income';
export type InstrumentKind = 'account' | 'card';
export type EconomicState = 'forecast' | 'confirmed' | 'realized' | 'cancelled' | 'reversed';
export type TransactionStatus = 'pending' | 'paid' | 'received' | 'cancelled' | 'refunded';

export type HouseholdTransaction = {
  id: string;
  household_id: string;
  created_by_member_id: string;
  buyer_member_id: string | null;
  category_id: string | null;
  invoice_id: string | null;
  type: TransactionKind;
  status: TransactionStatus;
  economic_state: EconomicState;
  description: string;
  amount: string;
  realized_amount: string;
  transaction_date: string;
  competence_date: string;
  due_date: string | null;
  settled_at: string | null;
  notes: string | null;
  deleted_at: string | null;
  category?: { name: string; type: TransactionKind } | null;
  buyer?: { display_name: string } | null;
  payment_instrument?: { kind: InstrumentKind; account_id: string | null; card_id: string | null } | null;
  mutation_dependencies: {
    has_recurring_occurrence: boolean;
    has_financial_obligation: boolean;
    has_external_payment_event: boolean;
    has_installment_plan: boolean;
    has_funding_event: boolean;
    direct_funding_total: number;
    direct_funding_account_count: number;
  };
};

export type TransactionInput = {
  description: string;
  amount: string;
  transactionDate: string;
  dueDate?: string | null;
  categoryId: string;
  buyerMemberId: string | null;
  notes?: string;
  instrumentKind?: InstrumentKind;
  accountId?: string;
  cardId?: string;
  splits?: Array<{ memberId?: string; partyId?: string; amount: string; percentage: string }>;
  installmentCount?: number;
};

export type TransactionAdjustmentEvent = {
  id: string;
  kind: 'correction' | 'cancellation' | 'refund';
  amount: string | null;
  reason: string;
  occurred_at: string;
  created_at: string;
};

const transactionColumns = 'id, household_id, created_by_member_id, buyer_member_id, category_id, invoice_id, type, status, economic_state, description, amount, realized_amount, transaction_date, competence_date, due_date, settled_at, notes, deleted_at, category:categories(name, type), buyer:household_members!transactions_buyer_member_id_fkey(profiles(display_name)), payment_instrument:transaction_payment_instruments(kind, account_id, card_id)';

const requestKey = (operation: string, transactionId: string) => `ui-${operation}:${transactionId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

export async function listHouseholdTransactions(client: SupabaseClient, householdId: string) {
  const response = await client.from('transactions').select(transactionColumns).eq('household_id', householdId).is('deleted_at', null).in('type', ['expense', 'income']).order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
  if (response.error) throw response.error;

  const rows = response.data ?? [];
  const transactionIds = rows.map((row) => row.id as string);
  if (transactionIds.length === 0) return [] as HouseholdTransaction[];

  const [recurringResponse, obligationResponse, externalPaymentResponse, installmentResponse, fundingResponse] = await Promise.all([
    client.from('recurring_occurrences').select('transaction_id').eq('household_id', householdId).in('transaction_id', transactionIds),
    client.from('financial_obligations').select('source_transaction_id').eq('household_id', householdId).in('source_transaction_id', transactionIds),
    client.from('external_payment_events').select('source_transaction_id').eq('household_id', householdId).in('source_transaction_id', transactionIds),
    client.from('installment_plans').select('purchase_transaction_id').eq('household_id', householdId).in('purchase_transaction_id', transactionIds),
    client.from('funding_events').select('financed_transaction_id, source_account_id, amount, invoice_id').eq('household_id', householdId).in('financed_transaction_id', transactionIds),
  ]);

  for (const dependencyResponse of [recurringResponse, obligationResponse, externalPaymentResponse, installmentResponse, fundingResponse]) {
    if (dependencyResponse.error) throw dependencyResponse.error;
  }

  const recurringIds = new Set((recurringResponse.data ?? []).map((row) => row.transaction_id).filter(Boolean));
  const obligationIds = new Set((obligationResponse.data ?? []).map((row) => row.source_transaction_id).filter(Boolean));
  const externalPaymentIds = new Set((externalPaymentResponse.data ?? []).map((row) => row.source_transaction_id).filter(Boolean));
  const installmentIds = new Set((installmentResponse.data ?? []).map((row) => row.purchase_transaction_id).filter(Boolean));
  const fundingByTransaction = new Map<string, Array<{ source_account_id: string | null; amount: string | number; invoice_id: string | null }>>();

  for (const funding of fundingResponse.data ?? []) {
    const transactionId = funding.financed_transaction_id as string;
    const existing = fundingByTransaction.get(transactionId) ?? [];
    existing.push({
      source_account_id: funding.source_account_id as string | null,
      amount: funding.amount as string | number,
      invoice_id: funding.invoice_id as string | null,
    });
    fundingByTransaction.set(transactionId, existing);
  }

  return rows.map((row) => {
    const transactionId = row.id as string;
    const fundingEvents = fundingByTransaction.get(transactionId) ?? [];
    const directFundingEvents = fundingEvents.filter((event) => event.invoice_id === null);
    const directFundingAccounts = new Set(directFundingEvents.map((event) => event.source_account_id).filter((id): id is string => Boolean(id)));

    return {
      ...row,
      category: Array.isArray(row.category) ? row.category[0] ?? null : row.category,
      buyer: Array.isArray(row.buyer) ? row.buyer[0] ?? null : row.buyer,
      payment_instrument: Array.isArray(row.payment_instrument) ? row.payment_instrument[0] ?? null : row.payment_instrument,
      mutation_dependencies: {
        has_recurring_occurrence: recurringIds.has(transactionId),
        has_financial_obligation: obligationIds.has(transactionId),
        has_external_payment_event: externalPaymentIds.has(transactionId),
        has_installment_plan: installmentIds.has(transactionId),
        has_funding_event: fundingEvents.length > 0,
        direct_funding_total: directFundingEvents.reduce((sum, event) => sum + Number(event.amount), 0),
        direct_funding_account_count: directFundingAccounts.size,
      },
    } as unknown as HouseholdTransaction;
  });
}

export async function listTransactionAdjustmentEvents(client: SupabaseClient, householdId: string, transactionId: string) {
  const response = await client.from('transaction_adjustment_events').select('id, kind, amount, reason, occurred_at, created_at').eq('household_id', householdId).eq('source_transaction_id', transactionId).order('occurred_at', { ascending: true });
  if (response.error) throw response.error;
  return (response.data ?? []) as TransactionAdjustmentEvent[];
}

export async function createHouseholdTransaction(client: SupabaseClient, householdId: string, type: TransactionKind, input: TransactionInput) {
  const response = await client.rpc('create_financial_transaction', {
    p_household_id: householdId,
    p_type: type,
    p_description: input.description.trim(),
    p_amount: input.amount,
    p_transaction_date: input.transactionDate,
    p_category_id: input.categoryId,
    p_buyer_member_id: type === 'expense' ? input.buyerMemberId : null,
    p_notes: input.notes?.trim() || null,
    p_instrument_kind: type === 'expense' ? input.instrumentKind : null,
    p_account_id: type === 'expense' && input.instrumentKind === 'account' ? input.accountId : null,
    p_card_id: type === 'expense' && input.instrumentKind === 'card' ? input.cardId : null,
    p_splits: type === 'expense' ? (input.splits ?? []).map((split) => ({ ...(split.memberId ? { member_id: split.memberId } : { party_id: split.partyId }), amount: split.amount, percentage: split.percentage })) : [],
    p_installment_count: type === 'expense' ? input.installmentCount ?? 1 : 1,
  });
  if (response.error) throw response.error;
  return response.data as string;
}

export async function updateHouseholdTransaction(client: SupabaseClient, householdId: string, transactionId: string, input: TransactionInput) {
  const response = await client.rpc('correct_unrealized_transaction', {
    p_household_id: householdId,
    p_transaction_id: transactionId,
    p_description: input.description.trim(),
    p_amount: input.amount,
    p_transaction_date: input.transactionDate,
    p_due_date: input.dueDate ?? null,
    p_category_id: input.categoryId,
    p_reason: 'Editado pelo usuário',
    p_request_key: requestKey('correction', transactionId),
  });
  if (response.error) throw response.error;
}

export async function cancelHouseholdTransaction(client: SupabaseClient, householdId: string, transactionId: string) {
  const response = await client.rpc('cancel_unrealized_transaction', {
    p_household_id: householdId,
    p_transaction_id: transactionId,
    p_reason: 'Cancelado pelo usuário',
    p_request_key: requestKey('cancel', transactionId),
  });
  if (response.error) throw response.error;
}

export async function refundHouseholdDirectExpense(client: SupabaseClient, householdId: string, transaction: HouseholdTransaction) {
  const response = await client.rpc('refund_direct_expense', {
    p_household_id: householdId,
    p_transaction_id: transaction.id,
    p_amount: transaction.realized_amount,
    p_refunded_at: new Date().toISOString(),
    p_reason: 'Estorno registrado pelo usuário',
    p_request_key: requestKey('refund', transaction.id),
  });
  if (response.error) throw response.error;
}

export function transactionAvailableActions(transaction: HouseholdTransaction) {
  const dependencies = transaction.mutation_dependencies;
  const hasLinkedFinancialFacts = transaction.invoice_id !== null
    || dependencies.has_recurring_occurrence
    || dependencies.has_financial_obligation
    || dependencies.has_external_payment_event
    || dependencies.has_installment_plan
    || dependencies.has_funding_event;
  const unrealized = (transaction.economic_state === 'forecast' || transaction.economic_state === 'confirmed')
    && Number(transaction.realized_amount) === 0
    && !hasLinkedFinancialFacts;
  const directPaidExpense = transaction.type === 'expense'
    && transaction.economic_state === 'realized'
    && transaction.status === 'paid'
    && transaction.payment_instrument?.kind === 'account'
    && transaction.invoice_id === null
    && !dependencies.has_financial_obligation
    && !dependencies.has_external_payment_event
    && !dependencies.has_installment_plan
    && Math.abs(dependencies.direct_funding_total - Number(transaction.realized_amount)) < 0.005
    && dependencies.direct_funding_account_count === 1;
  return {
    canEdit: unrealized,
    canCancel: unrealized,
    canRefund: directPaidExpense,
    closed: transaction.economic_state === 'cancelled' || transaction.economic_state === 'reversed' || transaction.status === 'cancelled' || transaction.status === 'refunded',
  };
}

export async function createAndSettleSharedExpense(client: SupabaseClient, householdId: string, input: TransactionInput, funderMemberId: string, partyDueDate: string | null) {
  const response = await client.rpc('create_and_settle_shared_expense', {
    p_household_id: householdId,
    p_description: input.description.trim(),
    p_gross_amount: input.amount,
    p_transaction_date: input.transactionDate,
    p_category_id: input.categoryId,
    p_buyer_member_id: input.buyerMemberId,
    p_source_account_id: input.accountId,
    p_funder_member_id: funderMemberId,
    p_splits: (input.splits ?? []).map((split) => ({ ...(split.memberId ? { member_id: split.memberId } : { party_id: split.partyId }), amount: split.amount, percentage: split.percentage })),
    p_receivable_due_date: partyDueDate,
    p_notes: input.notes?.trim() || null,
  });
  if (response.error) throw response.error;
  return response.data as string;
}
