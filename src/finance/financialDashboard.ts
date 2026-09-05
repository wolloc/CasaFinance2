import type { SupabaseClient } from '@supabase/supabase-js';
export type HouseholdFinancialPosition = { household_id:string; available_money:number; restricted_resources:number; reserves:number; investments:number; receivables:number; payables:number; open_invoices:number; committed_balance:number; projected_balance:number };
export type MemberFinancialPosition = { member_id:string; economic_responsibility:number; confirmed_responsibility:number; forecast_responsibility:number; real_funding:number };
export async function getFinancialDashboard(client: SupabaseClient, householdId: string) {
  const [household, members] = await Promise.all([
    client.from('financial_household_position').select('*').eq('household_id', householdId).maybeSingle(),
    client.from('financial_member_positions').select('*').eq('household_id', householdId),
  ]);
  if (household.error) throw household.error; if (members.error) throw members.error;
  return { household: household.data as HouseholdFinancialPosition | null, members: (members.data ?? []) as MemberFinancialPosition[] };
}
