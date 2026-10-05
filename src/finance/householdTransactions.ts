import type { SupabaseClient } from '@supabase/supabase-js';
import { getRetryStableIntentValue, getRetryStableRequestKey, releaseRetryStableRequestKey, runRetryStableRpc } from './retryIdempotency.js';

export type TransactionKind = 'expense' | 'income';
export type InstrumentKind = 'account' | 'card';
export type EconomicState = 'forecast' | 'confirmed' | 'realized' | 'cancelled' | 'reversed';
export type TransactionStatus = 'pending' | 'paid' | 'received' | 'cancelled' | 'refunded';

export type HouseholdTransaction = {
  id: string; household_id: string; created_by_member_id: string; buyer_member_id: string | null; category_id: string | null; invoice_id: string | null;
  type: TransactionKind; status: TransactionStatus; economic_state: EconomicState; description: string; amount: string; realized_amount: string;
  transaction_date: string; competence_date: string; due_date: string | null; settled_at: string | null; notes: string | null; deleted_at: string | null;
  category?: { name: string; type: TransactionKind; icon: string | null; color: string | null } | null; buyer?: { display_name: string } | null;
  payment_instrument?: { kind: InstrumentKind; account_id: string | null; card_id: string | null } | null;
  mutation_dependencies: { has_recurring_occurrence: boolean; has_financial_obligation: boolean; has_external_payment_event: boolean; has_installment_plan: boolean; has_funding_event: boolean; direct_funding_total: number; direct_funding_account_count: number };
};

export type TransactionInput = { description: string; amount: string; transactionDate: string; categoryId: string; buyerMemberId: string | null; notes?: string; instrumentKind?: InstrumentKind; accountId?: string; cardId?: string; splits?: Array<{ memberId?: string; partyId?: string; amount: string; percentage: string }>; installmentCount?: number };
export type TransactionAdjustmentEvent = {
  id: string;
  kind: 'correction' | 'cancellation' | 'refund';
  amount: string | null;
  reason: string;
  before_payload: Record<string, unknown> | null;
  after_payload: Record<string, unknown> | null;
  related_transaction_id: string | null;
  created_by_member_id: string;
  occurred_at: string;
  created_at: string;
};

const transactionColumns = 'id, household_id, created_by_member_id, buyer_member_id, category_id, invoice_id, type, status, economic_state, description, amount, realized_amount, transaction_date, competence_date, due_date, settled_at, notes, deleted_at, category:categories(name, type, icon, color), buyer:household_members!transactions_buyer_member_id_fkey(profiles(display_name)), payment_instrument:transaction_payment_instruments(kind, account_id, card_id)';

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
  for (const dependencyResponse of [recurringResponse, obligationResponse, externalPaymentResponse, installmentResponse, fundingResponse]) if (dependencyResponse.error) throw dependencyResponse.error;

  const recurringIds = new Set((recurringResponse.data ?? []).map((row) => row.transaction_id).filter(Boolean));
  const obligationIds = new Set((obligationResponse.data ?? []).map((row) => row.source_transaction_id).filter(Boolean));
  const externalPaymentIds = new Set((externalPaymentResponse.data ?? []).map((row) => row.source_transaction_id).filter(Boolean));
  const installmentIds = new Set((installmentResponse.data ?? []).map((row) => row.purchase_transaction_id).filter(Boolean));
  const fundingByTransaction = new Map<string, Array<{ source_account_id: string | null; amount: string | number; invoice_id: string | null }>>();
  for (const funding of fundingResponse.data ?? []) {
    const transactionId = funding.financed_transaction_id as string;
    const existing = fundingByTransaction.get(transactionId) ?? [];
    existing.push({ source_account_id: funding.source_account_id as string | null, amount: funding.amount as string | number, invoice_id: funding.invoice_id as string | null });
    fundingByTransaction.set(transactionId, existing);
  }

  return rows.map((row) => {
    const transactionId = row.id as string;
    const fundingEvents = fundingByTransaction.get(transactionId) ?? [];
    const directFundingEvents = fundingEvents.filter((event) => event.invoice_id === null);
    const directFundingAccounts = new Set(directFundingEvents.map((event) => event.source_account_id).filter((id): id is string => Boolean(id)));
    return { ...row,
      category: Array.isArray(row.category) ? row.category[0] ?? null : row.category,
      buyer: Array.isArray(row.buyer) ? row.buyer[0] ?? null : row.buyer,
      payment_instrument: Array.isArray(row.payment_instrument) ? row.payment_instrument[0] ?? null : row.payment_instrument,
      mutation_dependencies: {
        has_recurring_occurrence: recurringIds.has(transactionId), has_financial_obligation: obligationIds.has(transactionId), has_external_payment_event: externalPaymentIds.has(transactionId), has_installment_plan: installmentIds.has(transactionId), has_funding_event: fundingEvents.length > 0,
        direct_funding_total: directFundingEvents.reduce((sum, event) => sum + Number(event.amount), 0), direct_funding_account_count: directFundingAccounts.size,
      },
    } as unknown as HouseholdTransaction;
  });
}

export async function listHouseholdIncomeTransactions(client: SupabaseClient, householdId: string) {
  const response = await client.from('transactions').select(transactionColumns).eq('household_id', householdId).is('deleted_at', null).eq('type', 'income').order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
  if (response.error) throw response.error;
  const rows = response.data ?? [];
  const transactionIds = rows.map((row) => row.id as string);
  if (transactionIds.length === 0) return [] as HouseholdTransaction[];

  const [recurringResponse, fundingResponse] = await Promise.all([
    client.from('recurring_occurrences').select('transaction_id').eq('household_id', householdId).in('transaction_id', transactionIds),
    client.from('funding_events').select('financed_transaction_id, source_account_id, amount, invoice_id').eq('household_id', householdId).in('financed_transaction_id', transactionIds),
  ]);
  if (recurringResponse.error) throw recurringResponse.error;
  if (fundingResponse.error) throw fundingResponse.error;

  const recurringIds = new Set((recurringResponse.data ?? []).map((row) => row.transaction_id).filter(Boolean));
  const fundingByTransaction = new Map<string, Array<{ source_account_id: string | null; amount: string | number; invoice_id: string | null }>>();
  for (const funding of fundingResponse.data ?? []) {
    const transactionId = funding.financed_transaction_id as string;
    const existing = fundingByTransaction.get(transactionId) ?? [];
    existing.push({ source_account_id: funding.source_account_id as string | null, amount: funding.amount as string | number, invoice_id: funding.invoice_id as string | null });
    fundingByTransaction.set(transactionId, existing);
  }

  return rows.map((row) => {
    const transactionId = row.id as string;
    const fundingEvents = fundingByTransaction.get(transactionId) ?? [];
    const directFundingEvents = fundingEvents.filter((event) => event.invoice_id === null);
    const directFundingAccounts = new Set(directFundingEvents.map((event) => event.source_account_id).filter((id): id is string => Boolean(id)));
    return { ...row,
      category: Array.isArray(row.category) ? row.category[0] ?? null : row.category,
      buyer: Array.isArray(row.buyer) ? row.buyer[0] ?? null : row.buyer,
      payment_instrument: Array.isArray(row.payment_instrument) ? row.payment_instrument[0] ?? null : row.payment_instrument,
      mutation_dependencies: {
        has_recurring_occurrence: recurringIds.has(transactionId),
        has_financial_obligation: false,
        has_external_payment_event: false,
        has_installment_plan: false,
        has_funding_event: fundingEvents.length > 0,
        direct_funding_total: directFundingEvents.reduce((sum, event) => sum + Number(event.amount), 0),
        direct_funding_account_count: directFundingAccounts.size,
      },
    } as unknown as HouseholdTransaction;
  });
}

export async function listTransactionAdjustmentEvents(client: SupabaseClient, householdId: string, transactionId: string) {
  const response = await client.from('transaction_adjustment_events')
    .select('id, kind, amount, reason, before_payload, after_payload, related_transaction_id, created_by_member_id, occurred_at, created_at')
    .eq('household_id', householdId)
    .eq('source_transaction_id', transactionId)
    .order('occurred_at', { ascending: true });
  if (response.error) throw response.error;
  return (response.data ?? []) as TransactionAdjustmentEvent[];
}

export async function createHouseholdTransaction(client: SupabaseClient, householdId: string, type: TransactionKind, input: TransactionInput) {
  const description=input.description.trim();const notes=input.notes?.trim()||null;
  const buyerMemberId=type==='expense'?input.buyerMemberId:null;
  const instrumentKind=type==='expense'?input.instrumentKind??null:null;
  const accountId=type==='expense'&&input.instrumentKind==='account'?input.accountId??null:null;
  const cardId=type==='expense'&&input.instrumentKind==='card'?input.cardId??null:null;
  const splits=type==='expense'?(input.splits??[]).map((split)=>({...(split.memberId?{member_id:split.memberId}:{party_id:split.partyId}),amount:split.amount,percentage:split.percentage})):[];
  const installmentCount=type==='expense'?input.installmentCount??1:1;
  const identity=[householdId,type,description,input.amount,input.transactionDate,input.categoryId,buyerMemberId,instrumentKind,accountId,cardId,splits,installmentCount,notes] as const;
  return runRetryStableRpc(client,'create-financial-transaction',identity,'create_financial_transaction_idempotent',{p_household_id:householdId,p_type:type,p_description:description,p_amount:input.amount,p_transaction_date:input.transactionDate,p_category_id:input.categoryId,p_buyer_member_id:buyerMemberId,p_instrument_kind:instrumentKind,p_account_id:accountId,p_card_id:cardId,p_splits:splits,p_installment_count:installmentCount,p_notes:notes});
}

export async function updateHouseholdTransaction(client: SupabaseClient, householdId: string, transactionId: string, input: TransactionInput) {
  const existing = await client.from('transactions').select('due_date').eq('household_id', householdId).eq('id', transactionId).is('deleted_at', null).single();
  if (existing.error) throw existing.error;
  const description=input.description.trim();const reason='Editado pelo usuário';
  const identity=[householdId,transactionId,description,input.amount,input.transactionDate,existing.data.due_date,input.categoryId,reason] as const;
  const requestKey=getRetryStableRequestKey('transaction-correction',identity);
  const response=await client.rpc('correct_unrealized_transaction',{p_household_id:householdId,p_transaction_id:transactionId,p_description:description,p_amount:input.amount,p_transaction_date:input.transactionDate,p_due_date:existing.data.due_date,p_category_id:input.categoryId,p_reason:reason,p_request_key:requestKey});
  if(response.error)throw response.error;releaseRetryStableRequestKey('transaction-correction',identity);
}

export async function updateHouseholdTransactionCategory(client: SupabaseClient, householdId: string, transactionId: string, categoryId: string | null) {
  const identity=[householdId,transactionId,categoryId??null] as const;
  const requestKey=getRetryStableRequestKey('transaction-category-correction',identity);
  const response=await client.rpc('correct_transaction_category',{p_household_id:householdId,p_transaction_id:transactionId,p_category_id:categoryId,p_reason:'Categoria ajustada pelo usuário',p_request_key:requestKey});
  if(response.error)throw response.error;
  releaseRetryStableRequestKey('transaction-category-correction',identity);
}

export async function cancelHouseholdTransaction(client: SupabaseClient, householdId: string, transactionId: string) {
  const reason='Cancelado pelo usuário';const identity=[householdId,transactionId,reason] as const;const requestKey=getRetryStableRequestKey('transaction-cancel',identity);
  const response=await client.rpc('cancel_unrealized_transaction',{p_household_id:householdId,p_transaction_id:transactionId,p_reason:reason,p_request_key:requestKey});
  if(response.error)throw response.error;releaseRetryStableRequestKey('transaction-cancel',identity);
}

export async function deleteOpeningCardPurchase(client: SupabaseClient, householdId: string, transactionId: string) {
  const reason='Excluído da posição inicial do cartão pelo usuário';
  const identity=[householdId,transactionId,reason] as const;
  const requestKey=getRetryStableRequestKey('opening-card-delete',identity);
  const response=await client.rpc('delete_opening_card_purchase',{
    p_household_id:householdId,
    p_transaction_id:transactionId,
    p_reason:reason,
    p_request_key:requestKey,
  });
  if(response.error)throw response.error;
  releaseRetryStableRequestKey('opening-card-delete',identity);
}

export async function correctUnrealizedCardPurchase(client: SupabaseClient, householdId: string, transactionId: string, input: Pick<TransactionInput,'description'|'amount'|'categoryId'>) {
  const reason='Editado pelo usuário';
  const identity=[householdId,transactionId,input.description.trim(),input.amount,input.categoryId,reason] as const;
  const requestKey=getRetryStableRequestKey('card-purchase-correction',identity);
  const response=await client.rpc('correct_unrealized_card_purchase',{
    p_household_id:householdId,
    p_transaction_id:transactionId,
    p_description:input.description.trim(),
    p_amount:input.amount,
    p_category_id:input.categoryId||null,
    p_reason:reason,
    p_request_key:requestKey,
  });
  if(response.error)throw response.error;
  releaseRetryStableRequestKey('card-purchase-correction',identity);
}

export async function deleteCardPurchase(client: SupabaseClient, householdId: string, transactionId: string) {
  const reason='Excluído pelo usuário';
  const identity=[householdId,transactionId,reason] as const;
  const requestKey=getRetryStableRequestKey('card-purchase-delete',identity);
  const response=await client.rpc('delete_card_purchase',{
    p_household_id:householdId,
    p_transaction_id:transactionId,
    p_reason:reason,
    p_request_key:requestKey,
  });
  if(response.error)throw response.error;
  releaseRetryStableRequestKey('card-purchase-delete',identity);
}

export async function refundHouseholdDirectExpense(client: SupabaseClient, householdId: string, transaction: HouseholdTransaction) {
  const refunds = await client.from('transaction_adjustment_events').select('amount').eq('household_id', householdId).eq('source_transaction_id', transaction.id).eq('kind', 'refund');
  if (refunds.error) throw refunds.error;
  const refunded = (refunds.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const remaining = Math.max(0, Number(transaction.realized_amount) - refunded);
  if (remaining <= 0) return;
  const reason='Estorno integral do saldo restante registrado pelo usuário';
  const identity=[householdId,transaction.id,remaining,reason] as const;
  const refundedAt=getRetryStableIntentValue('transaction-full-refund',identity,()=>new Date().toISOString());
  const requestKey=getRetryStableRequestKey('transaction-full-refund',identity);
  const response=await client.rpc('refund_direct_expense_partial',{p_household_id:householdId,p_transaction_id:transaction.id,p_amount:remaining,p_refunded_at:refundedAt,p_reason:reason,p_request_key:requestKey});
  if(response.error)throw response.error;releaseRetryStableRequestKey('transaction-full-refund',identity);
}

export function transactionAvailableActions(transaction: HouseholdTransaction) {
  const dependencies = transaction.mutation_dependencies;
  const hasLinkedFinancialFacts = transaction.invoice_id !== null || dependencies.has_recurring_occurrence || dependencies.has_financial_obligation || dependencies.has_external_payment_event || dependencies.has_installment_plan || dependencies.has_funding_event;
  const unrealized = (transaction.economic_state === 'forecast' || transaction.economic_state === 'confirmed') && Number(transaction.realized_amount) === 0 && !hasLinkedFinancialFacts;
  const isCardPurchase = transaction.type === 'expense' && transaction.payment_instrument?.kind === 'card' && (transaction.invoice_id !== null || dependencies.has_installment_plan);
  const cardPurchaseEditable = isCardPurchase && (transaction.economic_state === 'forecast' || transaction.economic_state === 'confirmed') && Number(transaction.realized_amount) === 0 && !dependencies.has_funding_event && !dependencies.has_external_payment_event && !dependencies.has_financial_obligation;
  const directPaidExpense = transaction.type === 'expense' && transaction.economic_state === 'realized' && transaction.status === 'paid' && transaction.payment_instrument?.kind === 'account' && transaction.invoice_id === null && !dependencies.has_financial_obligation && !dependencies.has_external_payment_event && !dependencies.has_installment_plan && Math.abs(dependencies.direct_funding_total - Number(transaction.realized_amount)) < 0.005 && dependencies.direct_funding_account_count === 1;
  const canEditCategory=transaction.economic_state!=='cancelled'&&transaction.economic_state!=='reversed'&&transaction.status!=='cancelled'&&transaction.status!=='refunded'; return { canEdit: unrealized || cardPurchaseEditable, canEditCategory, canCancel: unrealized, canRefund: directPaidExpense, canEditCardPurchase: cardPurchaseEditable, canDeleteCardPurchase: cardPurchaseEditable, closed: transaction.economic_state === 'cancelled' || transaction.economic_state === 'reversed' || transaction.status === 'cancelled' || transaction.status === 'refunded' };
}

export async function createAndSettleSharedExpense(client: SupabaseClient, householdId: string, input: TransactionInput, funderMemberId: string, partyDueDate: string | null) {
  const splits = (input.splits ?? []).map((split) => ({ ...(split.memberId ? { member_id: split.memberId } : { party_id: split.partyId }), amount: split.amount, percentage: split.percentage }));
  const notes = input.notes?.trim() || null;
  const identity = [householdId, input.description.trim(), input.amount, input.transactionDate, input.categoryId, input.buyerMemberId, input.accountId, funderMemberId, splits, partyDueDate, notes] as const;
  return runRetryStableRpc(client, 'create-and-settle-shared-expense', identity, 'create_and_settle_shared_expense_idempotent', {
    p_household_id: householdId,
    p_description: input.description.trim(),
    p_gross_amount: input.amount,
    p_transaction_date: input.transactionDate,
    p_category_id: input.categoryId,
    p_buyer_member_id: input.buyerMemberId,
    p_source_account_id: input.accountId,
    p_funder_member_id: funderMemberId,
    p_splits: splits,
    p_receivable_due_date: partyDueDate,
    p_notes: notes,
  });
}
