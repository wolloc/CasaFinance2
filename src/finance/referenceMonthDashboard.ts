import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemberMonthlyProjection, MonthlyProjection } from './financialDashboard.js';

export type ReferenceMonthContext={
  household_id:string;
  reference_month:string;
  household_current_month:string;
  period_kind:'past'|'current'|'future';
  tracking_started_on:string|null;
  coverage_state:'unconfigured'|'unavailable'|'partial'|'full';
  tracked_period_start:string|null;
  period_end:string;
  historical_opening_cash:number|null;
  historical_closing_cash:number|null;
  can_navigate:boolean;
};

export function normalizeReferenceMonth(value:string){
  return `${value.slice(0,7)}-01`;
}

export function shiftReferenceMonth(value:string,offset:number){
  const [year,month]=normalizeReferenceMonth(value).split('-').map(Number);
  const date=new Date(Date.UTC(year,month-1+offset,1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-01`;
}

export async function getReferenceMonthContext(client:SupabaseClient,householdId:string,referenceMonth:string):Promise<ReferenceMonthContext>{
  const response=await client.rpc('financial_reference_month_context',{
    p_household_id:householdId,
    p_reference_month:normalizeReferenceMonth(referenceMonth),
  });
  if(response.error)throw response.error;
  const row=(response.data??[])[0] as ReferenceMonthContext|undefined;
  if(!row)throw new Error('Contexto do mês de referência indisponível.');
  return row;
}

export async function getHouseholdReferenceProjection(client:SupabaseClient,householdId:string,referenceMonth:string,horizonMonths=4):Promise<MonthlyProjection[]>{
  const response=await client.rpc('financial_monthly_projection',{
    p_household_id:householdId,
    p_reference_month:normalizeReferenceMonth(referenceMonth),
    p_horizon_months:horizonMonths,
  });
  if(response.error)throw response.error;
  return(response.data??[]) as MonthlyProjection[];
}

export async function getMemberReferenceProjection(client:SupabaseClient,householdId:string,memberId:string,referenceMonth:string,horizonMonths=4):Promise<MemberMonthlyProjection[]>{
  const response=await client.rpc('financial_member_monthly_projection',{
    p_household_id:householdId,
    p_member_id:memberId,
    p_reference_month:normalizeReferenceMonth(referenceMonth),
    p_horizon_months:horizonMonths,
  });
  if(response.error)throw response.error;
  return(response.data??[]) as MemberMonthlyProjection[];
}
