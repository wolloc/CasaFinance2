import type { SupabaseClient } from '@supabase/supabase-js';

export type CardRefundTarget={invoice_id:string;invoice_month:string;due_date:string;installment_id:string|null;installment_number:number|null;commitment_amount:number|string;invoice_outstanding:number|string};
export type CardRefundPosition={household_id:string;transaction_id:string;description:string;transaction_date:string;original_amount:number|string;refunded_amount:number|string;remaining_refundable_amount:number|string;last_refunded_at:string|null;card_id:string;card_name:string;installment_count:number;eligible_invoice_targets:CardRefundTarget[]};

export async function listCardRefundPositions(client:SupabaseClient,householdId:string):Promise<CardRefundPosition[]>{
  const result=await client.from('financial_card_refund_positions').select('*').eq('household_id',householdId).order('transaction_date',{ascending:false});
  if(result.error)throw result.error;
  return (result.data??[]).map((row)=>({...row,eligible_invoice_targets:Array.isArray(row.eligible_invoice_targets)?row.eligible_invoice_targets:[]})) as CardRefundPosition[];
}

export async function recordCardInvoiceCreditRefund(client:SupabaseClient,input:{householdId:string;transactionId:string;targetInvoiceId:string;amount:string;occurredAt:string;reason:string}){
  const requestKey=`card-refund:${input.transactionId}:${input.targetInvoiceId}:${crypto.randomUUID()}`;
  const result=await client.rpc('record_card_invoice_credit_refund',{
    p_household_id:input.householdId,p_transaction_id:input.transactionId,p_target_invoice_id:input.targetInvoiceId,p_amount:input.amount,
    p_occurred_at:input.occurredAt,p_reason:input.reason.trim(),p_request_key:requestKey,
  });
  if(result.error)throw result.error;
  return result.data as string;
}
