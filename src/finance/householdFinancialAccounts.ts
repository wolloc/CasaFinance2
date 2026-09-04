import type { SupabaseClient } from '@supabase/supabase-js';

export const ACCOUNT_TYPES = ['cash', 'checking', 'savings', 'investment', 'meal_benefit', 'digital_wallet'] as const;
export type HouseholdAccountType = typeof ACCOUNT_TYPES[number];

export type HouseholdAccount = {
  id: string;
  household_id: string;
  owner_member_id: string | null;
  name: string;
  type: HouseholdAccountType;
  institution: string | null;
  opening_balance: string;
  opened_at: string | null;
};

export type HouseholdCard = {
  id: string;
  household_id: string;
  owner_member_id: string;
  name: string;
  institution: string | null;
  last_four: string | null;
  credit_limit: string;
  closing_day: number;
  due_day: number;
  default_payment_account_id: string | null;
};

const accountColumns = 'id, household_id, owner_member_id, name, type, institution, opening_balance, opened_at';
const cardColumns = 'id, household_id, owner_member_id, name, institution, last_four, credit_limit, closing_day, due_day, default_payment_account_id';

export async function listHouseholdFinancialAccounts(client: SupabaseClient, householdId: string) {
  const [accounts, cards] = await Promise.all([
    client.from('accounts').select(accountColumns).eq('household_id', householdId).is('deactivated_at', null).order('name'),
    client.from('cards').select(cardColumns).eq('household_id', householdId).is('deactivated_at', null).order('name'),
  ]);
  if (accounts.error) throw accounts.error;
  if (cards.error) throw cards.error;
  return { accounts: (accounts.data ?? []) as HouseholdAccount[], cards: (cards.data ?? []) as HouseholdCard[] };
}

export async function createHouseholdAccount(client: SupabaseClient, householdId: string, input: {
  name: string;
  type: HouseholdAccountType;
  institution?: string;
  ownerMemberId?: string;
  openingBalance: string;
  openedAt?: string;
}) {
  const response = await client.from('accounts').insert({
    household_id: householdId,
    name: input.name.trim(),
    type: input.type,
    institution: input.institution?.trim() || null,
    owner_member_id: input.ownerMemberId || null,
    opening_balance: input.openingBalance,
    opened_at: input.openedAt || null,
  }).select(accountColumns).single();
  if (response.error) throw response.error;
  return response.data as HouseholdAccount;
}

export async function createHouseholdCard(client: SupabaseClient, householdId: string, input: {
  name: string;
  institution?: string;
  ownerMemberId: string;
  lastFour?: string;
  creditLimit: string;
  closingDay: number;
  dueDay: number;
  defaultPaymentAccountId?: string;
}) {
  const response = await client.from('cards').insert({
    household_id: householdId,
    name: input.name.trim(),
    institution: input.institution?.trim() || null,
    owner_member_id: input.ownerMemberId,
    last_four: input.lastFour?.trim() || null,
    credit_limit: input.creditLimit,
    closing_day: input.closingDay,
    due_day: input.dueDay,
    default_payment_account_id: input.defaultPaymentAccountId || null,
  }).select(cardColumns).single();
  if (response.error) throw response.error;
  return response.data as HouseholdCard;
}