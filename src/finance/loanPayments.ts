import type { SupabaseClient } from '@supabase/supabase-js';
import { getRetryStableRequestKey, releaseRetryStableRequestKey } from './retryIdempotency.js';

export type LoanPaymentComponent={household_id:string;principal_obligation_id:string;component_obligation_id:string;component_kind:'principal'|'interest'|'fee'|'penalty';description:string;counterparty_name:string;outstanding_amount:number|string;due_date:string|null};

export async function listLoanPaymentComponents(client:SupabaseClient,householdId:string):Promise<LoanPaymentComponent[]>{
  const result=await client.from('financial_loan_payment_components').select('*').eq('household_id',householdId).order('counterparty_name').order('due_date',{ascending:true,nullsFirst:false});
  if(result.error)throw result.error;return(result.data??[])as LoanPaymentComponent[];
}

export async function recordLoanPayment(client:SupabaseClient,input:{householdId:string;principalObligationId:string;sourceAccountId:string;funderMemberId:string;principalAmount:string;chargeAllocations:{obligation_id:string;amount:string}[];paidAt:string;notes?:string}){
  const identity=[input.householdId,input.principalObligationId,input.sourceAccountId,input.funderMemberId,input.principalAmount||'0',input.chargeAllocations,input.paidAt,input.notes?.trim()||null] as const;
  const requestKey=getRetryStableRequestKey('loan-payment',identity);
  const result=await client.rpc('record_loan_payment',{p_household_id:input.householdId,p_principal_obligation_id:input.principalObligationId,p_source_account_id:input.sourceAccountId,p_funder_member_id:input.funderMemberId,p_principal_amount:input.principalAmount||'0',p_charge_allocations:input.chargeAllocations,p_paid_at:input.paidAt,p_notes:input.notes?.trim()||null,p_request_key:requestKey});
  if(result.error)throw result.error;
  releaseRetryStableRequestKey('loan-payment',identity);
  return result.data as string;
}


export async function recordScheduledLoanPayment(client:SupabaseClient,input:{
 householdId:string;
 scheduleItemId:string;
 sourceAccountId:string;
 funderMemberId:string;
 principalAmount:string;
 interestAmount:string;
 feeAmount:string;
 paidAt:string;
 notes?:string;
}){
 const identity=[input.householdId,input.scheduleItemId,input.sourceAccountId,input.funderMemberId,input.principalAmount||'0',input.interestAmount||'0',input.feeAmount||'0',input.paidAt,input.notes?.trim()||null] as const;
 const requestKey=getRetryStableRequestKey('scheduled-loan-payment',identity);
 const result=await client.rpc('record_scheduled_loan_payment',{
  p_household_id:input.householdId,
  p_schedule_item_id:input.scheduleItemId,
  p_source_account_id:input.sourceAccountId,
  p_funder_member_id:input.funderMemberId,
  p_principal_amount:input.principalAmount||'0',
  p_interest_amount:input.interestAmount||'0',
  p_fee_amount:input.feeAmount||'0',
  p_paid_at:input.paidAt,
  p_notes:input.notes?.trim()||null,
  p_request_key:requestKey,
 });
 if(result.error)throw result.error;
 releaseRetryStableRequestKey('scheduled-loan-payment',identity);
 return result.data as string;
}
