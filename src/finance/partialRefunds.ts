import type { SupabaseClient } from '@supabase/supabase-js';
import { getRetryStableRequestKey, releaseRetryStableRequestKey } from './retryIdempotency.js';

export type DirectRefundPosition={household_id:string;transaction_id:string;description:string;transaction_date:string;original_amount:number|string;refunded_amount:number|string;remaining_refundable_amount:number|string;last_refunded_at:string|null;source_account_id:string;source_account_name:string|null;refund_state:'none'|'partial'|'full'};

export async function listDirectRefundPositions(client:SupabaseClient,householdId:string):Promise<DirectRefundPosition[]>{
  const result=await client.from('financial_direct_refund_positions').select('*').eq('household_id',householdId).order('transaction_date',{ascending:false});
  if(result.error)throw result.error;return(result.data??[])as DirectRefundPosition[];
}

export async function recordPartialDirectRefund(client:SupabaseClient,input:{householdId:string;transactionId:string;amount:string;refundedAt:string;reason:string}){
  const identity=[input.householdId,input.transactionId,input.amount,input.refundedAt,input.reason.trim()] as const;
  const requestKey=getRetryStableRequestKey('partial-refund',identity);
  const result=await client.rpc('refund_direct_expense_partial',{p_household_id:input.householdId,p_transaction_id:input.transactionId,p_amount:input.amount,p_refunded_at:input.refundedAt,p_reason:input.reason.trim(),p_request_key:requestKey});
  if(result.error)throw result.error;
  releaseRetryStableRequestKey('partial-refund',identity);
  return result.data as string;
}
