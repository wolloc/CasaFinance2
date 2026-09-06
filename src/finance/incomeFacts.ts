import type { SupabaseClient } from '@supabase/supabase-js';

export type IncomeNature = 'salary' | 'rent' | 'freelance' | 'bonus' | 'gift' | 'interest_yield' | 'other_true_income';
export type IncomeConfidence = 'forecast' | 'confirmed';

export const incomeNatureLabels: Record<IncomeNature, string> = {
  salary: 'Salário', rent: 'Aluguel recebido', freelance: 'Freelance', bonus: 'Bônus', gift: 'Presente recebido', interest_yield: 'Juros / rendimento', other_true_income: 'Outra renda verdadeira',
};

const requestKey=(operation:string,transactionId:string)=>`ui-income-${operation}:${transactionId}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

export async function createIncomeFact(client: SupabaseClient, input: { householdId:string;description:string;amount:string;expectedDate:string;categoryId:string;beneficiaryMemberId:string;plannedDestinationAccountId:string;incomeNature:IncomeNature;economicState:IncomeConfidence;notes?:string; }) {
  const result = await client.rpc('create_income_fact', { p_household_id:input.householdId,p_description:input.description.trim(),p_amount:input.amount,p_expected_date:input.expectedDate,p_category_id:input.categoryId,p_beneficiary_member_id:input.beneficiaryMemberId,p_planned_destination_account_id:input.plannedDestinationAccountId,p_income_nature:input.incomeNature,p_economic_state:input.economicState,p_notes:input.notes?.trim()||null });
  if(result.error)throw result.error;return result.data as string;
}

export async function correctIncomeFact(client:SupabaseClient,input:{householdId:string;transactionId:string;description:string;amount:string;expectedDate:string;categoryId:string;reason:string;}){
  const result=await client.rpc('correct_income_fact',{p_household_id:input.householdId,p_transaction_id:input.transactionId,p_description:input.description.trim(),p_amount:input.amount,p_expected_date:input.expectedDate,p_category_id:input.categoryId,p_reason:input.reason.trim(),p_request_key:requestKey('correction',input.transactionId)});if(result.error)throw result.error;return result.data as string;
}

export async function cancelIncomeFact(client:SupabaseClient,input:{householdId:string;transactionId:string;reason:string;}){
  const result=await client.rpc('cancel_income_fact',{p_household_id:input.householdId,p_transaction_id:input.transactionId,p_reason:input.reason.trim(),p_request_key:requestKey('cancel',input.transactionId)});if(result.error)throw result.error;return result.data as string;
}
