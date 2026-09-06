import type { SupabaseClient } from '@supabase/supabase-js';

export type LoanPaymentComponent={household_id:string;principal_obligation_id:string;component_obligation_id:string;component_kind:'principal'|'interest'|'fee'|'penalty';description:string;counterparty_name:string;outstanding_amount:number|string;due_date:string|null};

export async function listLoanPaymentComponents(client:SupabaseClient,householdId:string):Promise<LoanPaymentComponent[]>{
  const result=await client.from('financial_loan_payment_components').select('*').eq('household_id',householdId).order('counterparty_name').order('due_date',{ascending:true,nullsFirst:false});
  if(result.error)throw result.error;return(result.data??[])as LoanPaymentComponent[];
}

export async function recordLoanPayment(client:SupabaseClient,input:{householdId:string;principalObligationId:string;sourceAccountId:string;funderMemberId:string;principalAmount:string;chargeAllocations:{obligation_id:string;amount:string}[];paidAt:string;notes?:string}){
  const requestKey=`loan-payment:${input.principalObligationId}:${input.paidAt}:${crypto.randomUUID()}`;
  const result=await client.rpc('record_loan_payment',{p_household_id:input.householdId,p_principal_obligation_id:input.principalObligationId,p_source_account_id:input.sourceAccountId,p_funder_member_id:input.funderMemberId,p_principal_amount:input.principalAmount||'0',p_charge_allocations:input.chargeAllocations,p_paid_at:input.paidAt,p_notes:input.notes?.trim()||null,p_request_key:requestKey});
  if(result.error)throw result.error;return result.data as string;
}
