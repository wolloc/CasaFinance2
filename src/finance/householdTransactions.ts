import type { SupabaseClient } from '@supabase/supabase-js';

export type TransactionKind = 'expense' | 'income';
export type InstrumentKind = 'account' | 'card';

export type HouseholdTransaction = {
  id: string;
  household_id: string;
  created_by_member_id: string;
  buyer_member_id: string | null;
  category_id: string | null;
  type: TransactionKind;
  status: 'pending';
  description: string;
  amount: string;
  transaction_date: string;
  competence_date: string;
  notes: string | null;
  deleted_at: string | null;
  category?: { name: string; type: TransactionKind } | null;
  buyer?: { display_name: string } | null;
  payment_instrument?: { kind: InstrumentKind; account_id: string | null; card_id: string | null } | null;
};

export type TransactionInput = {
  description: string;
  amount: string;
  transactionDate: string;
  categoryId: string;
  buyerMemberId: string | null;
  notes?: string;
  instrumentKind?: InstrumentKind;
  accountId?: string;
  cardId?: string;
};

const transactionColumns = 'id, household_id, created_by_member_id, buyer_member_id, category_id, type, status, description, amount, transaction_date, competence_date, notes, deleted_at, category:categories(name, type), buyer:household_members!transactions_buyer_member_id_fkey(profiles(display_name)), payment_instrument:transaction_payment_instruments(kind, account_id, card_id)';

export async function listHouseholdTransactions(client: SupabaseClient, householdId: string) {
  const response = await client.from('transactions').select(transactionColumns).eq('household_id', householdId).is('deleted_at', null).in('type', ['expense', 'income']).order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
  if (response.error) throw response.error;
  return (response.data ?? []).map((row) => ({
    ...row,
    category: Array.isArray(row.category) ? row.category[0] ?? null : row.category,
    buyer: Array.isArray(row.buyer) ? row.buyer[0] ?? null : row.buyer,
    payment_instrument: Array.isArray(row.payment_instrument) ? row.payment_instrument[0] ?? null : row.payment_instrument,
  }) as unknown as HouseholdTransaction);
}

export async function createHouseholdTransaction(client: SupabaseClient, householdId: string, type: TransactionKind, input: TransactionInput) {
  const response = await client.rpc('create_basic_transaction', {
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
  });
  if (response.error) throw response.error;
  return response.data as string;
}

export async function updateHouseholdTransaction(client: SupabaseClient, householdId: string, transactionId: string, input: TransactionInput) {
  const response = await client.rpc('update_basic_transaction', {
    p_household_id: householdId,
    p_transaction_id: transactionId,
    p_description: input.description.trim(),
    p_amount: input.amount,
    p_transaction_date: input.transactionDate,
    p_category_id: input.categoryId,
    p_buyer_member_id: input.buyerMemberId,
    p_notes: input.notes?.trim() || null,
    p_instrument_kind: input.instrumentKind,
    p_account_id: input.instrumentKind === 'account' ? input.accountId : null,
    p_card_id: input.instrumentKind === 'card' ? input.cardId : null,
  });
  if (response.error) throw response.error;
}

export async function cancelHouseholdTransaction(client: SupabaseClient, householdId: string, transactionId: string) {
  const response = await client.from('transactions').update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', transactionId).eq('household_id', householdId).is('deleted_at', null);
  if (response.error) throw response.error;
}