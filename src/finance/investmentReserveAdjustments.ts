import type { SupabaseClient } from '@supabase/supabase-js';

export type InvestmentReserveResource = {
  account_id: string;
  name: string;
  type: string;
  resource_restriction: string | null;
  current_balance: number | string;
  is_restricted: boolean;
  is_investment: boolean;
};

export type InvestmentPerformanceKind = 'yield' | 'loss';
export type InvestmentPerformanceEvent = {
  event_id: string;
  account_id: string;
  account_name: string;
  transaction_id: string;
  kind: InvestmentPerformanceKind;
  amount: number | string;
  effective_date: string;
  description: string;
  created_at: string;
};

export async function listInvestmentReserveResources(client: SupabaseClient, householdId: string): Promise<InvestmentReserveResource[]> {
  const result = await client.from('financial_account_balances').select('account_id,name,type,resource_restriction,current_balance,is_restricted,is_investment').eq('household_id', householdId).order('name');
  if (result.error) throw result.error;
  return (result.data ?? []) as InvestmentReserveResource[];
}

export const isInvestmentOrReserve = (resource: InvestmentReserveResource) => resource.is_investment || resource.resource_restriction === 'reserve';
export const isTransactionalResource = (resource: InvestmentReserveResource) => !isInvestmentOrReserve(resource) && !resource.is_restricted && ['cash', 'checking', 'savings', 'digital_wallet'].includes(resource.type);

export async function moveInvestmentReservePrincipal(client: SupabaseClient, input: { householdId:string; sourceAccountId:string; destinationAccountId:string; amount:string; date:string; description:string; }) {
  const result = await client.rpc('create_transfer', { p_household_id:input.householdId,p_source_account_id:input.sourceAccountId,p_destination_account_id:input.destinationAccountId,p_amount:input.amount,p_date:input.date,p_description:input.description.trim()||'Movimentação de principal' });
  if (result.error) throw result.error;
  return result.data as string;
}

export async function recordInvestmentPerformance(client: SupabaseClient, input: { householdId:string; accountId:string; kind:InvestmentPerformanceKind; amount:string; date:string; description:string; }) {
  const result = await client.rpc('record_investment_performance', { p_household_id:input.householdId,p_account_id:input.accountId,p_kind:input.kind,p_amount:input.amount,p_effective_date:input.date,p_description:input.description.trim() });
  if (result.error) throw result.error;
  return result.data as string;
}

export async function listInvestmentPerformance(client: SupabaseClient, householdId:string): Promise<InvestmentPerformanceEvent[]> {
  const result = await client.from('financial_investment_performance_positions').select('event_id,account_id,account_name,transaction_id,kind,amount,effective_date,description,created_at').eq('household_id',householdId).order('effective_date',{ascending:false}).limit(20);
  if (result.error) throw result.error;
  return (result.data ?? []) as InvestmentPerformanceEvent[];
}
