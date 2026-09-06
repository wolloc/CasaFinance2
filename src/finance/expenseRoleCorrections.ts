import type { SupabaseClient } from '@supabase/supabase-js';

export type ExpenseResponsibility = { member_id: string; percentage: number; amount: number|string };
export type ExpenseRoleCorrectionPosition = {
  household_id: string;
  transaction_id: string;
  description: string;
  transaction_date: string;
  buyer_member_id: string;
  responsibility: ExpenseResponsibility[];
  has_funding: boolean;
  has_cash_effect: boolean;
  correction_count: number;
};

export async function listExpenseRoleCorrectionPositions(client:SupabaseClient,householdId:string){
  const response=await client.from('financial_expense_role_correction_positions')
    .select('household_id,transaction_id,description,transaction_date,buyer_member_id,responsibility,has_funding,has_cash_effect,correction_count')
    .eq('household_id',householdId).order('transaction_date',{ascending:false});
  if(response.error)throw response.error;
  return(response.data??[])as ExpenseRoleCorrectionPosition[];
}

export async function correctExpenseRoles(client:SupabaseClient,input:{householdId:string;transactionId:string;buyerMemberId:string;responsibility:Array<{member_id:string;percentage:number}>;reason:string}){
  const requestKey=crypto.randomUUID();
  const response=await client.rpc('correct_expense_roles',{
    p_household_id:input.householdId,
    p_transaction_id:input.transactionId,
    p_buyer_member_id:input.buyerMemberId,
    p_responsibility:input.responsibility,
    p_reason:input.reason,
    p_request_key:requestKey,
  });
  if(response.error)throw response.error;
  return response.data as string;
}
