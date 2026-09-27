import type { SupabaseClient } from '@supabase/supabase-js';

export type LoanScheduleItem={
 household_id:string;
 schedule_item_id:string;
 principal_obligation_id:string;
 obligation_kind:'payable'|'receivable';
 counterparty_id:string;
 counterparty_name:string;
 installment_number:number;
 due_date:string;
 principal_amount:number|string;
 projected_interest_amount:number|string;
 projected_fee_amount:number|string;
 cost_responsible_member_id:string|null;
 paid_principal_amount:number|string;
 paid_interest_amount:number|string;
 paid_fee_amount:number|string;
 remaining_principal_amount:number|string;
 remaining_interest_amount:number|string;
 remaining_fee_amount:number|string;
 scheduled_total_amount:number|string;
 remaining_total_amount:number|string;
 state:'projected'|'partially_paid'|'paid'|'cancelled';
};

export async function listLoanSchedule(client:SupabaseClient,householdId:string,principalObligationId:string):Promise<LoanScheduleItem[]>{
 const result=await client.from('financial_loan_schedule').select('*')
  .eq('household_id',householdId)
  .eq('principal_obligation_id',principalObligationId)
  .order('installment_number');
 if(result.error)throw result.error;
 return(result.data??[])as LoanScheduleItem[];
}
