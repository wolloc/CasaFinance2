import type { SupabaseClient } from '@supabase/supabase-js';
import { getRetryStableRequestKey, releaseRetryStableRequestKey, runRetryStableRpc } from './retryIdempotency.js';

export type IncomeNature = 'salary' | 'rent' | 'freelance' | 'bonus' | 'gift' | 'interest_yield' | 'other_true_income' | 'benefit_credit';
export type IncomeConfidence = 'forecast' | 'confirmed';

export const incomeNatureLabels: Record<IncomeNature, string> = {
  salary: 'Salário', rent: 'Aluguel recebido', freelance: 'Freelance', bonus: 'Bônus', gift: 'Presente recebido', interest_yield: 'Juros / rendimento', other_true_income: 'Outra renda verdadeira', benefit_credit: 'Crédito de benefício',
};

export async function createIncomeFact(client: SupabaseClient, input: { householdId:string;description:string;amount:string;expectedDate:string;categoryId:string|null;beneficiaryMemberId:string;plannedDestinationAccountId:string;incomeNature:IncomeNature;economicState:IncomeConfidence;notes?:string; }) {
  const description=input.description.trim();const notes=input.notes?.trim()||null;
  const identity=[input.householdId,description,input.amount,input.expectedDate,input.categoryId,input.beneficiaryMemberId,input.plannedDestinationAccountId,input.incomeNature,input.economicState,notes] as const;
  return runRetryStableRpc(client,'create-income-fact',identity,'create_income_fact_idempotent',{p_household_id:input.householdId,p_description:description,p_amount:input.amount,p_expected_date:input.expectedDate,p_category_id:input.categoryId,p_beneficiary_member_id:input.beneficiaryMemberId,p_planned_destination_account_id:input.plannedDestinationAccountId,p_income_nature:input.incomeNature,p_economic_state:input.economicState,p_notes:notes});
}

export async function correctIncomeFact(client:SupabaseClient,input:{householdId:string;transactionId:string;description:string;amount:string;expectedDate:string;categoryId:string|null;reason:string;}){
  const description=input.description.trim();const reason=input.reason.trim();const identity=[input.householdId,input.transactionId,description,input.amount,input.expectedDate,input.categoryId,reason] as const;const requestKey=getRetryStableRequestKey('income-correction',identity);
  const result=await client.rpc('correct_income_fact',{p_household_id:input.householdId,p_transaction_id:input.transactionId,p_description:description,p_amount:input.amount,p_expected_date:input.expectedDate,p_category_id:input.categoryId,p_reason:reason,p_request_key:requestKey});if(result.error)throw result.error;releaseRetryStableRequestKey('income-correction',identity);return result.data as string;
}

export async function cancelIncomeFact(client:SupabaseClient,input:{householdId:string;transactionId:string;reason:string;}){
  const reason=input.reason.trim();const identity=[input.householdId,input.transactionId,reason] as const;const requestKey=getRetryStableRequestKey('income-cancel',identity);
  const result=await client.rpc('cancel_income_fact',{p_household_id:input.householdId,p_transaction_id:input.transactionId,p_reason:reason,p_request_key:requestKey});if(result.error)throw result.error;releaseRetryStableRequestKey('income-cancel',identity);return result.data as string;
}
