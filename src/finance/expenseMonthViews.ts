import type { SupabaseClient } from '@supabase/supabase-js';

export type FinancialMonthExpense = {
  commitment_key:string;
  source_type:string;
  source_transaction_id:string|null;
  source_installment_id:string|null;
  source_invoice_id:string|null;
  financial_date:string;
  financial_month:string;
  due_date:string|null;
  economic_date:string;
  effective_amount:string;
  realized_amount:string;
  remaining_amount:string;
  economic_state:string;
  commitment_state:string;
  description:string;
  category_id:string|null;
};

export type EconomicMonthExpense = {
  id:string;
  description:string;
  amount:string;
  transaction_date:string;
  economic_state:string;
  category_id:string|null;
  category?:{name:string}|null;
};

type EconomicAllocationRow={amount:string;responsible_member_id:string|null;responsible_party_id:string|null};

export function monthStart(month:string){return `${month}-01`;}
export function nextMonthStart(month:string){const [year,rawMonth]=month.split('-').map(Number);const date=new Date(Date.UTC(year,rawMonth,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-01`;}

export async function listFinancialMonthExpenses(client:SupabaseClient,householdId:string,month:string){
  const response=await client.from('financial_commitment_positions')
    .select('commitment_key,source_type,source_transaction_id,source_installment_id,source_invoice_id,financial_date,financial_month,due_date,economic_date,effective_amount,realized_amount,remaining_amount,economic_state,commitment_state,description,category_id')
    .eq('household_id',householdId)
    .eq('economic_type','expense')
    .eq('financial_month',monthStart(month))
    .in('commitment_state',['forecast','confirmed','realized'])
    .order('financial_date',{ascending:true})
    .order('commitment_key',{ascending:true});
  if(response.error)throw response.error;
  return (response.data??[]) as FinancialMonthExpense[];
}

export async function listEconomicMonthExpenses(client:SupabaseClient,householdId:string,month:string){
  const response=await client.from('transactions')
    .select('id,description,amount,transaction_date,economic_state,category_id,category:categories(name),economic_allocations(amount,responsible_member_id,responsible_party_id)')
    .eq('household_id',householdId)
    .eq('type','expense')
    .is('deleted_at',null)
    .gte('transaction_date',monthStart(month))
    .lt('transaction_date',nextMonthStart(month))
    .in('economic_state',['confirmed','realized'])
    .order('transaction_date',{ascending:false});
  if(response.error)throw response.error;
  return (response.data??[]).map(row=>{const allocations=(row.economic_allocations??[]) as EconomicAllocationRow[];const householdAmount=allocations.filter(allocation=>Boolean(allocation.responsible_member_id)).reduce((sum,allocation)=>sum+Number(allocation.amount),0);return {id:row.id,description:row.description,amount:householdAmount.toFixed(2),transaction_date:row.transaction_date,economic_state:row.economic_state,category_id:row.category_id,category:Array.isArray(row.category)?row.category[0]??null:row.category};}) as EconomicMonthExpense[];
}
