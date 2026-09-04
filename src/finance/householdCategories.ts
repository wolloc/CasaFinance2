import type { SupabaseClient } from '@supabase/supabase-js';

export const CATEGORY_TYPES = ['income', 'expense'] as const;
export type HouseholdCategoryType = typeof CATEGORY_TYPES[number];

export type HouseholdCategory = {
  id: string;
  household_id: string;
  name: string;
  type: HouseholdCategoryType;
  icon: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  deactivated_at: string | null;
};

const columns = 'id, household_id, name, type, icon, color, created_at, updated_at, deactivated_at';

export async function listHouseholdCategories(client: SupabaseClient, householdId: string) {
  const response = await client.from('categories').select(columns).eq('household_id', householdId).is('deactivated_at', null).order('type').order('name');
  if (response.error) throw response.error;
  return (response.data ?? []) as HouseholdCategory[];
}

export async function createHouseholdCategory(client: SupabaseClient, householdId: string, input: { name: string; type: HouseholdCategoryType }) {
  const response = await client.from('categories').insert({ household_id: householdId, name: input.name.trim(), type: input.type }).select(columns).single();
  if (response.error) throw response.error;
  return response.data as HouseholdCategory;
}

export async function updateHouseholdCategory(client: SupabaseClient, householdId: string, categoryId: string, input: { name: string; type: HouseholdCategoryType }) {
  const response = await client.from('categories').update({ name: input.name.trim(), type: input.type, updated_at: new Date().toISOString() }).eq('id', categoryId).eq('household_id', householdId).select(columns).single();
  if (response.error) throw response.error;
  return response.data as HouseholdCategory;
}

export async function deactivateHouseholdCategory(client: SupabaseClient, householdId: string, categoryId: string) {
  const response = await client.from('categories').update({ deactivated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', categoryId).eq('household_id', householdId).is('deactivated_at', null).select(columns).single();
  if (response.error) throw response.error;
  return response.data as HouseholdCategory;
}