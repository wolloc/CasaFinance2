import type { SupabaseClient } from '@supabase/supabase-js';

export type ExpenseCategory = {
  name:string;
  type:'expense';
  icon:string|null;
  color:string|null;
};

export type ResponsibilityVisual = {
  member_ids:string[];
  has_third_party:boolean;
};

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
  household_effective_amount:string;
  realized_amount:string;
  remaining_amount:string;
  economic_state:string;
  commitment_state:string;
  description:string;
  category_id:string|null;
  category?:ExpenseCategory|null;
  responsibility:ResponsibilityVisual;
};

export type EconomicMonthExpense = {
  id:string;
  description:string;
  amount:string;
  original_amount:string;
  household_amount:string;
  transaction_date:string;
  economic_state:string;
  category_id:string|null;
  category?:ExpenseCategory|null;
  responsibility:ResponsibilityVisual;
};

type EconomicTransactionRow={
  id:string;
  description:string;
  amount:string|number;
  transaction_date:string;
  economic_state:string;
  category_id:string|null;
  category?:ExpenseCategory|ExpenseCategory[]|null;
};

type EconomicPositionRow={transaction_id:string;household_economic_amount:string|number;economic_state:string};
type AllocationRow={transaction_id:string;responsible_member_id:string|null;responsible_party_id:string|null};
type TransactionMetaRow={id:string;amount:string|number;category?:ExpenseCategory|ExpenseCategory[]|null};

export function monthStart(month:string){return `${month}-01`;}
export function nextMonthStart(month:string){const [year,rawMonth]=month.split('-').map(Number);const date=new Date(Date.UTC(year,rawMonth,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-01`;}

function normalizeCategory(category:ExpenseCategory|ExpenseCategory[]|null|undefined){
  return Array.isArray(category)?category[0]??null:category??null;
}

function buildResponsibilityMap(rows:AllocationRow[]){
  const map=new Map<string,ResponsibilityVisual>();
  for(const row of rows){
    const current=map.get(row.transaction_id)??{member_ids:[],has_third_party:false};
    if(row.responsible_member_id&&!current.member_ids.includes(row.responsible_member_id))current.member_ids.push(row.responsible_member_id);
    if(row.responsible_party_id)current.has_third_party=true;
    map.set(row.transaction_id,current);
  }
  return map;
}

async function loadTransactionVisuals(client:SupabaseClient,householdId:string,transactionIds:string[]){
  if(transactionIds.length===0)return{
    transactionMeta:new Map<string,{amount:number;category:ExpenseCategory|null}>(),
    responsibility:new Map<string,ResponsibilityVisual>(),
  };

  const[transactionsResponse,allocationsResponse]=await Promise.all([
    client.from('transactions')
      .select('id,amount,category:categories(name,type,icon,color)')
      .eq('household_id',householdId)
      .in('id',transactionIds),
    client.from('economic_allocations')
      .select('transaction_id,responsible_member_id,responsible_party_id')
      .eq('household_id',householdId)
      .in('transaction_id',transactionIds),
  ]);
  if(transactionsResponse.error)throw transactionsResponse.error;
  if(allocationsResponse.error)throw allocationsResponse.error;

  const transactionMeta=new Map<string,{amount:number;category:ExpenseCategory|null}>();
  for(const row of (transactionsResponse.data??[]) as TransactionMetaRow[]){
    transactionMeta.set(row.id,{amount:Number(row.amount??0),category:normalizeCategory(row.category)});
  }

  return{
    transactionMeta,
    responsibility:buildResponsibilityMap((allocationsResponse.data??[]) as AllocationRow[]),
  };
}

export async function listFinancialMonthExpenses(client:SupabaseClient,householdId:string,month:string,memberId?:string){
  const response=await client.from('financial_commitment_positions')
    .select('commitment_key,source_type,source_transaction_id,source_installment_id,source_invoice_id,financial_date,financial_month,due_date,economic_date,effective_amount,realized_amount,remaining_amount,economic_state,commitment_state,description,category_id')
    .eq('household_id',householdId)
    .eq('economic_type','expense')
    .eq('financial_month',monthStart(month))
    .in('commitment_state',['forecast','confirmed','realized'])
    .order('financial_date',{ascending:true})
    .order('commitment_key',{ascending:true});
  if(response.error)throw response.error;

  const baseRows=(response.data??[]) as Omit<FinancialMonthExpense,'household_effective_amount'|'category'|'responsibility'>[];
  const sourceTransactionIds=[...new Set(baseRows.map(row=>row.source_transaction_id).filter((value):value is string=>Boolean(value)))];
  const visuals=await loadTransactionVisuals(client,householdId,sourceTransactionIds);

  const enrichedRows=baseRows.map(row=>({
    ...row,
    household_effective_amount:String(row.effective_amount),
    category:row.source_transaction_id?visuals.transactionMeta.get(row.source_transaction_id)?.category??null:null,
    responsibility:row.source_transaction_id?visuals.responsibility.get(row.source_transaction_id)??{member_ids:[],has_third_party:false}:{member_ids:[],has_third_party:false},
  })) as FinancialMonthExpense[];

  if(!memberId||enrichedRows.length===0)return enrichedRows;

  const responsibility=await client.from('financial_member_commitment_responsibility_positions')
    .select('commitment_key,responsibility_amount,realized_responsibility_amount,remaining_responsibility_amount')
    .eq('household_id',householdId)
    .eq('member_id',memberId)
    .in('commitment_key',enrichedRows.map(row=>row.commitment_key));
  if(responsibility.error)throw responsibility.error;

  const amounts=new Map<string,{total:number;realized:number;remaining:number}>();
  for(const row of responsibility.data??[]){
    const current=amounts.get(row.commitment_key)??{total:0,realized:0,remaining:0};
    current.total+=Number(row.responsibility_amount??0);
    current.realized+=Number(row.realized_responsibility_amount??0);
    current.remaining+=Number(row.remaining_responsibility_amount??0);
    amounts.set(row.commitment_key,current);
  }

  return enrichedRows.flatMap(row=>{
    const amount=amounts.get(row.commitment_key);
    if(!amount||amount.total<=0)return[];
    return[{
      ...row,
      effective_amount:String(amount.total),
      realized_amount:String(amount.realized),
      remaining_amount:String(amount.remaining),
    }];
  });
}

export async function listEconomicMonthExpenses(client:SupabaseClient,householdId:string,month:string,memberId?:string){
  const transactionsResponse=await client.from('transactions')
    .select('id,description,amount,transaction_date,economic_state,category_id,category:categories(name,type,icon,color)')
    .eq('household_id',householdId)
    .eq('type','expense')
    .is('deleted_at',null)
    .gte('transaction_date',monthStart(month))
    .lt('transaction_date',nextMonthStart(month))
    .eq('economic_state','realized')
    .order('transaction_date',{ascending:false});
  if(transactionsResponse.error)throw transactionsResponse.error;

  const transactions=(transactionsResponse.data??[]) as EconomicTransactionRow[];
  if(transactions.length===0)return [];

  const transactionIds=transactions.map(row=>row.id);
  const[positionsResponse,allocationsResponse]=await Promise.all([
    client.from('financial_transaction_positions')
      .select('transaction_id,household_economic_amount,economic_state')
      .eq('household_id',householdId)
      .eq('economic_state','realized')
      .in('transaction_id',transactionIds),
    client.from('economic_allocations')
      .select('transaction_id,responsible_member_id,responsible_party_id,amount')
      .eq('household_id',householdId)
      .in('transaction_id',transactionIds),
  ]);
  if(positionsResponse.error)throw positionsResponse.error;
  if(allocationsResponse.error)throw allocationsResponse.error;

  const positions=new Map(((positionsResponse.data??[]) as EconomicPositionRow[]).map(row=>[row.transaction_id,Number(row.household_economic_amount)]));
  const responsibility=buildResponsibilityMap((allocationsResponse.data??[]) as AllocationRow[]);
  const memberAmounts=new Map<string,number>();

  if(memberId){
    for(const allocation of allocationsResponse.data??[]){
      if(allocation.responsible_member_id!==memberId)continue;
      memberAmounts.set(allocation.transaction_id,(memberAmounts.get(allocation.transaction_id)??0)+Number(allocation.amount??0));
    }
  }

  return transactions.flatMap(row=>{
    const householdAmount=positions.get(row.id)??Number(row.amount);
    const perspectiveAmount=memberId?(memberAmounts.get(row.id)??0):householdAmount;
    if(perspectiveAmount<=0)return[];
    return[{
      id:row.id,
      description:row.description,
      amount:String(perspectiveAmount),
      original_amount:String(row.amount),
      household_amount:String(householdAmount),
      transaction_date:row.transaction_date,
      economic_state:row.economic_state,
      category_id:row.category_id,
      category:normalizeCategory(row.category),
      responsibility:responsibility.get(row.id)??{member_ids:[],has_third_party:false},
    }];
  }) as EconomicMonthExpense[];
}
