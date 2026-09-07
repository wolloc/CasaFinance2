import type { SupabaseClient } from '@supabase/supabase-js';
import { getRetryStableRequestKey, releaseRetryStableRequestKey } from './retryIdempotency.js';

export type LoanCostPosition={principal_obligation_id:string;counterparty_name:string;description:string;principal_outstanding:number|string;principal_due_date:string|null;charges_outstanding:number|string;charges_accrued:number|string};

export async function listLoanCostPositions(client:SupabaseClient,householdId:string):Promise<LoanCostPosition[]>{
  const result=await client.from('financial_loan_cost_positions').select('*').eq('household_id',householdId).order('counterparty_name');
  if(result.error)throw result.error;return(result.data??[])as LoanCostPosition[];
}

export async function recordLoanCharge(client:SupabaseClient,input:{householdId:string;principalObligationId:string;kind:'interest'|'fee'|'penalty';amount:string;chargeDate:string;dueDate:string;responsibleMemberId:string;description:string}){
  const identity=[input.householdId,input.principalObligationId,input.kind,input.amount,input.chargeDate,input.dueDate,input.responsibleMemberId,input.description.trim()] as const;
  const requestKey=getRetryStableRequestKey('loan-charge',identity);
  const result=await client.rpc('record_loan_charge',{p_household_id:input.householdId,p_principal_obligation_id:input.principalObligationId,p_kind:input.kind,p_amount:input.amount,p_charge_date:input.chargeDate,p_due_date:input.dueDate,p_responsible_member_id:input.responsibleMemberId,p_description:input.description.trim(),p_request_key:requestKey});
  if(result.error)throw result.error;
  releaseRetryStableRequestKey('loan-charge',identity);
  return result.data as string;
}
