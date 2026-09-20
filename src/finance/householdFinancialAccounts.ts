import type { SupabaseClient } from '@supabase/supabase-js';
import { runRetryStableRpc } from './retryIdempotency.js';

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
  owner_member_ids?: string[];
};

export type AccountOwnership = { account_id: string; member_id: string };

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
  const [accounts, cards, household, openings, ownerships] = await Promise.all([
    client.from('accounts').select(accountColumns).eq('household_id', householdId).is('deactivated_at', null).order('name'),
    client.from('cards').select(cardColumns).eq('household_id', householdId).is('deactivated_at', null).order('name'),
    client.from('households').select('financial_tracking_started_on').eq('id', householdId).maybeSingle(),
    client.from('account_balance_events').select('account_id').eq('household_id', householdId).eq('kind', 'opening').is('reversed_at', null),
    client.from('account_ownerships').select('account_id,member_id').eq('household_id', householdId),
  ]);
  if (accounts.error) throw accounts.error;
  if (cards.error) throw cards.error;
  if (household.error) throw household.error;
  if (openings.error) throw openings.error;
  if (ownerships.error) throw ownerships.error;
  return {
    accounts: ((accounts.data ?? []) as HouseholdAccount[]).map((account) => ({ ...account, owner_member_ids: ((ownerships.data ?? []) as AccountOwnership[]).filter((ownership) => ownership.account_id === account.id).map((ownership) => ownership.member_id) })),
    cards: (cards.data ?? []) as HouseholdCard[],
    financialTrackingStartedOn: household.data?.financial_tracking_started_on ?? null,
    openingAccountIds: (openings.data ?? []).map((row) => row.account_id as string),
    accountOwnerships: (ownerships.data ?? []) as AccountOwnership[],
  };
}

export type HouseholdFinancialSetupReadiness = 'ready' | 'needs_legacy_cutover' | 'inconsistent_opening_without_cutoff';

export async function getHouseholdFinancialSetupReadiness(client: SupabaseClient, householdId: string): Promise<HouseholdFinancialSetupReadiness> {
  const [household, accounts, openings] = await Promise.all([
    client.from('households').select('financial_tracking_started_on').eq('id', householdId).maybeSingle(),
    client.from('accounts').select('id').eq('household_id', householdId).is('deactivated_at', null),
    client.from('account_balance_events').select('account_id').eq('household_id', householdId).eq('kind', 'opening').is('reversed_at', null),
  ]);
  if (household.error) throw household.error;
  if (accounts.error) throw accounts.error;
  if (openings.error) throw openings.error;

  const financialTrackingStartedOn = household.data?.financial_tracking_started_on ?? null;
  const activeAccountIds = new Set((accounts.data ?? []).map((row) => row.id as string));
  const activeOpeningCount = (openings.data ?? []).filter((row) => activeAccountIds.has(row.account_id as string)).length;
  const activeAccountCount = activeAccountIds.size;

  if (!financialTrackingStartedOn && activeAccountCount > 0 && activeOpeningCount === 0) return 'needs_legacy_cutover';
  if (!financialTrackingStartedOn && activeOpeningCount > 0) return 'inconsistent_opening_without_cutoff';
  return 'ready';
}

export async function reconcileExistingHouseholdAccounts(client: SupabaseClient, householdId: string, input: {
  startedOn: string;
  accounts: Array<{ accountId: string; openingAmount: string; ownerMemberIds: string[] }>;
}) {
  const normalized = input.accounts
    .map((account) => ({
      accountId: account.accountId,
      openingAmount: account.openingAmount.trim(),
      ownerMemberIds: [...account.ownerMemberIds].sort(),
    }))
    .sort((left, right) => left.accountId.localeCompare(right.accountId));
  const identity = [householdId, input.startedOn, normalized] as const;
  return runRetryStableRpc(client, 'legacy-financial-cutover', identity, 'reconcile_existing_accounts_at_cutoff_idempotent', {
    p_household_id: householdId,
    p_started_on: input.startedOn,
    p_accounts: normalized.map((account) => ({
      account_id: account.accountId,
      opening_amount: account.openingAmount,
      owner_member_ids: account.ownerMemberIds,
    })),
  });
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
  cardId: string; description: string; originalPurchaseDate: string; amount: string;
  buyerMemberId: string; responsibleMemberId: string; installmentCount: number; paidInstallmentCount: number; requestKey?: string;
}) {
  const identity=[householdId,input.cardId,input.description.trim(),input.originalPurchaseDate,input.amount,input.buyerMemberId,input.responsibleMemberId,input.installmentCount,input.paidInstallmentCount] as const;
  return runRetryStableRpc(client,'opening-card-purchase',identity,'record_opening_card_purchase_idempotent',{
    p_household_id: householdId,p_card_id: input.cardId,p_description: input.description.trim(),p_original_purchase_date: input.originalPurchaseDate,p_amount: input.amount,p_category_id: null,p_buyer_member_id: input.buyerMemberId,
    p_splits: [{ member_id: input.responsibleMemberId, amount: input.amount, percentage: '100.0000' }],
    p_installment_count: input.installmentCount,p_paid_installment_count: input.paidInstallmentCount,p_notes:'Compra anterior ao início do controle',
  });
}

export async function recordOpeningCardBalance(client: SupabaseClient, householdId: string, input: { cardId: string; amount: string; description: string; requestKey?: string; }) {
  const identity=[householdId,input.cardId,input.amount,input.description.trim()] as const;
  return runRetryStableRpc(client,'opening-card-balance',identity,'record_opening_card_balance_adjustment_idempotent',{
    p_household_id:householdId,p_card_id:input.cardId,p_amount:input.amount,p_description:input.description.trim(),
  });
}
