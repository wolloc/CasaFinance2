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

type EconomicTransactionRow={
  id:string;
  description:string;
  amount:string|number;
  transaction_date:string;
  economic_state:string;
  category_id:string|null;
  category?:{name:string}|{name:string}[]|null;
};

type EconomicPositionRow={transaction_id:string;household_economic_amount:string|number;economic_state:string};

export function monthStart(month:string){return `${month}-01`;}
export function nextMonthStart(month:string){const [year,rawMonth]=month.split('-').map(Number);const date=new Date(Date.UTC(year,rawMonth,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-01`;}

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
  const rows=(response.data??[]) as FinancialMonthExpense[];
  if(!memberId||rows.length===0)return rows;

  const responsibility=await client.from('financial_member_commitment_responsibility_positions')
    .select('commitment_key,responsibility_amount,realized_responsibility_amount,remaining_responsibility_amount')
    .eq('household_id',householdId)
    .eq('member_id',memberId)
    .in('commitment_key',rows.map(row=>row.commitment_key));
  if(responsibility.error)throw responsibility.error;

  const amounts=new Map<string,{total:number;realized:number;remaining:number}>();
  for(const row of responsibility.data??[]){
    const current=amounts.get(row.commitment_key)??{total:0,realized:0,remaining:0};
    current.total+=Number(row.responsibility_amount??0);
    current.realized+=Number(row.realized_responsibility_amount??0);
    current.remaining+=Number(row.remaining_responsibility_amount??0);
    amounts.set(row.commitment_key,current);
  }
  return rows.flatMap(row=>{
    const amount=amounts.get(row.commitment_key);
    if(!amount||amount.total<=0)return[];
    return[{...row,effective_amount:String(amount.total),realized_amount:String(amount.realized),remaining_amount:String(amount.remaining)}];
  });
}

export async function listEconomicMonthExpenses(client:SupabaseClient,householdId:string,month:string,memberId?:string){
  const transactionsResponse=await client.from('transactions')
    .select('id,description,amount,transaction_date,economic_state,category_id,category:categories(name)')
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

  if(memberId){
    const allocationsResponse=await client.from('economic_allocations')
      .select('transaction_id,amount')
      .eq('household_id',householdId)
      .eq('responsible_member_id',memberId)
      .in('transaction_id',transactionIds);
    if(allocationsResponse.error)throw allocationsResponse.error;
    const memberAmounts=new Map<string,number>();
    for(const allocation of allocationsResponse.data??[])memberAmounts.set(allocation.transaction_id,(memberAmounts.get(allocation.transaction_id)??0)+Number(allocation.amount??0));
    return transactions.flatMap(row=>{
      const amount=memberAmounts.get(row.id)??0;
      if(amount<=0)return[];
      return[{
        id:row.id,
        description:row.description,
        amount:String(amount),
        transaction_date:row.transaction_date,
        economic_state:row.economic_state,
        category_id:row.category_id,
        category:Array.isArray(row.category)?row.category[0]??null:row.category??null,
      }];
    }) as EconomicMonthExpense[];
  }

  const positionsResponse=await client.from('financial_transaction_positions')
    .select('transaction_id,household_economic_amount,economic_state')
    .eq('household_id',householdId)
    .eq('economic_state','realized')
    .in('transaction_id',transactionIds);
  if(positionsResponse.error)throw positionsResponse.error;

  const positions=new Map(((positionsResponse.data??[]) as EconomicPositionRow[]).map(row=>[row.transaction_id,row.household_economic_amount]));
  return transactions.map(row=>({
    id:row.id,
    description:row.description,
    // O read model canônico já soma somente allocations dos membros. O bruto é
    // fallback apenas para registros legados que ainda não tenham posição derivada.
    amount:String(positions.get(row.id)??row.amount),
    transaction_date:row.transaction_date,
    economic_state:row.economic_state,
    category_id:row.category_id,
    category:Array.isArray(row.category)?row.category[0]??null:row.category??null,
  })) as EconomicMonthExpense[];
}
