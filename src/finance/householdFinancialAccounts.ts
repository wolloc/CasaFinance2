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
const requestKey = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export async function listHouseholdFinancialAccounts(client: SupabaseClient, householdId: string) {
  const [accounts, cards, household] = await Promise.all([
    client.from('accounts').select(accountColumns).eq('household_id', householdId).is('deactivated_at', null).order('name'),
    client.from('cards').select(cardColumns).eq('household_id', householdId).is('deactivated_at', null).order('name'),
    client.from('households').select('financial_tracking_started_on').eq('id', householdId).maybeSingle(),
  ]);
  if (accounts.error) throw accounts.error;
  if (cards.error) throw cards.error;
  if (household.error) throw household.error;
  return {
    accounts: (accounts.data ?? []) as HouseholdAccount[],
    cards: (cards.data ?? []) as HouseholdCard[],
    financialTrackingStartedOn: household.data?.financial_tracking_started_on ?? null,
  };
}

export async function createHouseholdAccount(client: SupabaseClient, householdId: string, input: {
  name: string;
  type: HouseholdAccountType;
  institution?: string;
  ownerMemberIds: string[];
  openingBalance: string;
  trackingStartedOn: string;
  resourceRestriction?: 'reserve';
  requestKey?: string;
}) {
  const response = await client.rpc('create_account_with_opening_position_idempotent', {
    p_household_id: householdId,
    p_name: input.name.trim(),
    p_type: input.type,
    p_institution: input.institution?.trim() || null,
    p_owner_member_ids: input.ownerMemberIds,
    p_opening_amount: input.openingBalance,
    p_effective_date: input.trackingStartedOn,
    p_resource_restriction: input.resourceRestriction ?? null,
    p_request_key: input.requestKey ?? requestKey('opening-account'),
  });
  if (response.error) throw response.error;
  return response.data as string;
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

export async function recordOpeningCardPurchase(client: SupabaseClient, householdId: string, input: {
  cardId: string;
  description: string;
  originalPurchaseDate: string;
  amount: string;
  buyerMemberId: string;
  responsibleMemberId: string;
  installmentCount: number;
  paidInstallmentCount: number;
  requestKey?: string;
}) {
  const response = await client.rpc('record_opening_card_purchase_idempotent', {
    p_household_id: householdId,
    p_card_id: input.cardId,
    p_description: input.description.trim(),
    p_original_purchase_date: input.originalPurchaseDate,
    p_amount: input.amount,
    p_category_id: null,
    p_buyer_member_id: input.buyerMemberId,
    p_splits: [{
      member_id: input.responsibleMemberId,
      amount: input.amount,
      percentage: '100.0000',
    }],
    p_installment_count: input.installmentCount,
    p_paid_installment_count: input.paidInstallmentCount,
    p_notes: 'Compra anterior ao início do controle',
    p_request_key: input.requestKey ?? requestKey('opening-card-purchase'),
  });
  if (response.error) throw response.error;
  return response.data as string;
}

export async function recordOpeningCardBalance(client: SupabaseClient, householdId: string, input: {
  cardId: string;
  amount: string;
  description: string;
  requestKey?: string;
}) {
  const response = await client.rpc('record_opening_card_balance_adjustment_idempotent', {
    p_household_id: householdId,
    p_card_id: input.cardId,
    p_amount: input.amount,
    p_description: input.description.trim(),
    p_request_key: input.requestKey ?? requestKey('opening-card-balance'),
  });
  if (response.error) throw response.error;
  return response.data as string;
}
