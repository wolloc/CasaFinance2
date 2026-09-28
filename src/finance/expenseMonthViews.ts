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
  original_amount:string|null;
  recurring_rule_id:string|null;
  realized_amount:string;
  remaining_amount:string;
  economic_state:string;
  commitment_state:string;
  description:string;
  category_id:string|null;
  category?:ExpenseCategory|null;
  responsibility:ResponsibilityVisual;
  buyer_member_id:string|null;
  instrument_kind:string|null;
  instrument_label:string|null;
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
  recurring_rule_id:string|null;
  buyer_member_id:string|null;
  instrument_kind:string|null;
  instrument_label:string|null;
};

type PaymentInstrumentVisual={kind:string|null;account?:{name:string|null;institution:string|null}|Array<{name:string|null;institution:string|null}>|null;card?:{name:string|null;institution:string|null;last_four:string|null}|Array<{name:string|null;institution:string|null;last_four:string|null}>|null};

type EconomicTransactionRow={
  id:string;
  description:string;
  amount:string|number;
  transaction_date:string;
  created_at:string;
  economic_state:string;
  category_id:string|null;
  buyer_member_id:string|null;
  category?:ExpenseCategory|ExpenseCategory[]|null;
  payment_instrument?:PaymentInstrumentVisual|PaymentInstrumentVisual[]|null;
};

type EconomicPositionRow={transaction_id:string;household_economic_amount:string|number;economic_state:string};
type AllocationRow={transaction_id:string;responsible_member_id:string|null;responsible_party_id:string|null};
type TransactionMetaRow={id:string;amount:string|number;buyer_member_id:string|null;category?:ExpenseCategory|ExpenseCategory[]|null;payment_instrument?:PaymentInstrumentVisual|PaymentInstrumentVisual[]|null};
type RecurringOccurrenceRow={transaction_id:string;recurring_rule_id:string};

export function monthStart(month:string){return `${month}-01`;}
export function nextMonthStart(month:string){const [year,rawMonth]=month.split('-').map(Number);const date=new Date(Date.UTC(year,rawMonth,1));return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-01`;}

function normalizeCategory(category:ExpenseCategory|ExpenseCategory[]|null|undefined){
  return Array.isArray(category)?category[0]??null:category??null;
}
function normalizeInstrument(instrument:PaymentInstrumentVisual|PaymentInstrumentVisual[]|null|undefined){
  const item=Array.isArray(instrument)?instrument[0]:instrument;
  const account=Array.isArray(item?.account)?item?.account[0]:item?.account;
  const card=Array.isArray(item?.card)?item?.card[0]:item?.card;
  const label=item?.kind==='card'?[card?.institution,card?.name,card?.last_four?'final '+card.last_four:null].filter(Boolean).join(' · '):item?.kind==='account'?[account?.institution,account?.name].filter(Boolean).join(' · '):null;
  return{kind:item?.kind??null,label:label||null};
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
    transactionMeta:new Map<string,{amount:number;category:ExpenseCategory|null;buyerMemberId:string|null;instrumentKind:string|null;instrumentLabel:string|null}>(),
    responsibility:new Map<string,ResponsibilityVisual>(),
    recurringRuleByTransaction:new Map<string,string>(),
  };

  const[transactionsResponse,recurringResponse]=await Promise.all([
    client.from('transactions')
      .select('id,amount,buyer_member_id,category:categories(name,type,icon,color),payment_instrument:transaction_payment_instruments(kind,account:accounts(name,institution),card:cards(name,institution,last_four))')
      .eq('household_id',householdId)
      .in('id',transactionIds),
    client.from('recurring_occurrences')
      .select('transaction_id,recurring_rule_id')
      .eq('household_id',householdId)
      .in('transaction_id',transactionIds),
  ]);
  if(transactionsResponse.error)throw transactionsResponse.error;
  if(recurringResponse.error)throw recurringResponse.error;

  const allocationRows:AllocationRow[]=[];
  for(let from=0;;from+=500){
    const allocationsResponse=await client.from('economic_allocations')
      .select('transaction_id,responsible_member_id,responsible_party_id')
      .eq('household_id',householdId)
      .in('transaction_id',transactionIds)
      .order('transaction_id',{ascending:true})
      .range(from,from+499);
    if(allocationsResponse.error)throw allocationsResponse.error;
    const page=(allocationsResponse.data??[]) as AllocationRow[];
    allocationRows.push(...page);
    if(page.length<500)break;
  }

  const transactionMeta=new Map<string,{amount:number;category:ExpenseCategory|null;buyerMemberId:string|null;instrumentKind:string|null;instrumentLabel:string|null}>();
  for(const row of (transactionsResponse.data??[]) as TransactionMetaRow[]){
    const instrument=normalizeInstrument(row.payment_instrument);
    transactionMeta.set(row.id,{amount:Number(row.amount??0),category:normalizeCategory(row.category),buyerMemberId:row.buyer_member_id,instrumentKind:instrument.kind,instrumentLabel:instrument.label});
  }

  const recurringRuleByTransaction=new Map<string,string>();
  for(const row of (recurringResponse.data??[]) as RecurringOccurrenceRow[])recurringRuleByTransaction.set(row.transaction_id,row.recurring_rule_id);

  return{
    transactionMeta,
    responsibility:buildResponsibilityMap(allocationRows),
    recurringRuleByTransaction,
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

  const baseRows=(response.data??[]) as Omit<FinancialMonthExpense,'household_effective_amount'|'original_amount'|'recurring_rule_id'|'category'|'responsibility'>[];
  const sourceTransactionIds=[...new Set(baseRows.map(row=>row.source_transaction_id).filter((value):value is string=>Boolean(value)))];
  const visuals=await loadTransactionVisuals(client,householdId,sourceTransactionIds);

  const enrichedRows=baseRows.map(row=>({
    ...row,
    household_effective_amount:String(row.effective_amount),
    original_amount:row.source_transaction_id?String(visuals.transactionMeta.get(row.source_transaction_id)?.amount??row.effective_amount):null,
    recurring_rule_id:row.source_transaction_id?visuals.recurringRuleByTransaction.get(row.source_transaction_id)??null:null,
    category:row.source_transaction_id?visuals.transactionMeta.get(row.source_transaction_id)?.category??null:null,
    responsibility:row.source_transaction_id?visuals.responsibility.get(row.source_transaction_id)??{member_ids:[],has_third_party:false}:{member_ids:[],has_third_party:false},
    buyer_member_id:row.source_transaction_id?visuals.transactionMeta.get(row.source_transaction_id)?.buyerMemberId??null:null,
    instrument_kind:row.source_transaction_id?visuals.transactionMeta.get(row.source_transaction_id)?.instrumentKind??null:null,
    instrument_label:row.source_transaction_id?visuals.transactionMeta.get(row.source_transaction_id)?.instrumentLabel??null:null,
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
    .select('id,description,amount,transaction_date,created_at,economic_state,category_id,buyer_member_id,category:categories(name,type,icon,color),payment_instrument:transaction_payment_instruments(kind,account:accounts(name,institution),card:cards(name,institution,last_four))')
    .eq('household_id',householdId)
    .eq('type','expense')
    .is('deleted_at',null)
    .gte('transaction_date',monthStart(month))
    .lt('transaction_date',nextMonthStart(month))
    .eq('economic_state','realized')
    .order('transaction_date',{ascending:false})
    .order('created_at',{ascending:false});
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
  const recurringResponse=await client.from('recurring_occurrences').select('transaction_id,recurring_rule_id').eq('household_id',householdId).in('transaction_id',transactionIds);
  if(recurringResponse.error)throw recurringResponse.error;
  const recurringRuleByTransaction=new Map<string,string>(((recurringResponse.data??[]) as RecurringOccurrenceRow[]).map(row=>[row.transaction_id,row.recurring_rule_id]));
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
    if(memberId&&perspectiveAmount<=0)return[];
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
      recurring_rule_id:recurringRuleByTransaction.get(row.id)??null,
      buyer_member_id:row.buyer_member_id,
      instrument_kind:normalizeInstrument(row.payment_instrument).kind,
      instrument_label:normalizeInstrument(row.payment_instrument).label,
    }];
  }) as EconomicMonthExpense[];
}


const PERIOD_PAGE_SIZE=500;
const PERIOD_ID_BATCH_SIZE=200;

function chunkValues<T>(values:T[],size=PERIOD_ID_BATCH_SIZE){
  const chunks:T[][]=[];
  for(let index=0;index<values.length;index+=size)chunks.push(values.slice(index,index+size));
  return chunks;
}

async function collectPages<T>(load:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>){
  const rows:T[]=[];
  for(let from=0;;from+=PERIOD_PAGE_SIZE){
    const response=await load(from,from+PERIOD_PAGE_SIZE-1);
    if(response.error)throw response.error;
    const page=response.data??[];
    rows.push(...page);
    if(page.length<PERIOD_PAGE_SIZE)break;
  }
  return rows;
}

async function loadTransactionVisualsBatched(client:SupabaseClient,householdId:string,transactionIds:string[]){
  const transactionMeta=new Map<string,{amount:number;category:ExpenseCategory|null;buyerMemberId:string|null;instrumentKind:string|null;instrumentLabel:string|null}>();
  const responsibility=new Map<string,ResponsibilityVisual>();
  const recurringRuleByTransaction=new Map<string,string>();
  for(const ids of chunkValues(transactionIds)){
    const batch=await loadTransactionVisuals(client,householdId,ids);
    for(const [id,value] of batch.transactionMeta)transactionMeta.set(id,value);
    for(const [id,value] of batch.responsibility)responsibility.set(id,value);
    for(const [id,value] of batch.recurringRuleByTransaction)recurringRuleByTransaction.set(id,value);
  }
  return{transactionMeta,responsibility,recurringRuleByTransaction};
}

function assertExpensePeriod(startDate:string,endDate:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||startDate>endDate){
    throw new Error('Período de gastos inválido.');
  }
}

export async function listFinancialPeriodExpenses(client:SupabaseClient,householdId:string,startDate:string,endDate:string,memberId?:string){
  assertExpensePeriod(startDate,endDate);
  const baseRows=await collectPages<Omit<FinancialMonthExpense,'household_effective_amount'|'original_amount'|'recurring_rule_id'|'category'|'responsibility'|'buyer_member_id'|'instrument_kind'|'instrument_label'>>((from,to)=>
    client.from('financial_commitment_positions')
      .select('commitment_key,source_type,source_transaction_id,source_installment_id,source_invoice_id,financial_date,financial_month,due_date,economic_date,effective_amount,realized_amount,remaining_amount,economic_state,commitment_state,description,category_id')
      .eq('household_id',householdId)
      .eq('economic_type','expense')
      .gte('financial_date',startDate)
      .lte('financial_date',endDate)
      .in('commitment_state',['forecast','confirmed','realized'])
      .order('financial_date',{ascending:true})
      .order('commitment_key',{ascending:true})
      .range(from,to)
  );

  const sourceTransactionIds=[...new Set(baseRows.map(row=>row.source_transaction_id).filter((value):value is string=>Boolean(value)))];
  const visuals=await loadTransactionVisualsBatched(client,householdId,sourceTransactionIds);

  const enrichedRows=baseRows.map(row=>({
    ...row,
    household_effective_amount:String(row.effective_amount),
    original_amount:row.source_transaction_id?String(visuals.transactionMeta.get(row.source_transaction_id)?.amount??row.effective_amount):null,
    recurring_rule_id:row.source_transaction_id?visuals.recurringRuleByTransaction.get(row.source_transaction_id)??null:null,
    category:row.source_transaction_id?visuals.transactionMeta.get(row.source_transaction_id)?.category??null:null,
    responsibility:row.source_transaction_id?visuals.responsibility.get(row.source_transaction_id)??{member_ids:[],has_third_party:false}:{member_ids:[],has_third_party:false},
    buyer_member_id:row.source_transaction_id?visuals.transactionMeta.get(row.source_transaction_id)?.buyerMemberId??null:null,
    instrument_kind:row.source_transaction_id?visuals.transactionMeta.get(row.source_transaction_id)?.instrumentKind??null:null,
    instrument_label:row.source_transaction_id?visuals.transactionMeta.get(row.source_transaction_id)?.instrumentLabel??null:null,
  })) as FinancialMonthExpense[];

  if(!memberId||enrichedRows.length===0)return enrichedRows;

  const amounts=new Map<string,{total:number;realized:number;remaining:number}>();
  for(const keys of chunkValues(enrichedRows.map(row=>row.commitment_key))){
    const responsibility=await client.from('financial_member_commitment_responsibility_positions')
      .select('commitment_key,responsibility_amount,realized_responsibility_amount,remaining_responsibility_amount')
      .eq('household_id',householdId)
      .eq('member_id',memberId)
      .in('commitment_key',keys);
    if(responsibility.error)throw responsibility.error;
    for(const row of responsibility.data??[]){
      const current=amounts.get(row.commitment_key)??{total:0,realized:0,remaining:0};
      current.total+=Number(row.responsibility_amount??0);
      current.realized+=Number(row.realized_responsibility_amount??0);
      current.remaining+=Number(row.remaining_responsibility_amount??0);
      amounts.set(row.commitment_key,current);
    }
  }

  return enrichedRows.flatMap(row=>{
    const amount=amounts.get(row.commitment_key);
    if(!amount||amount.total<=0)return[];
    return[{...row,effective_amount:String(amount.total),realized_amount:String(amount.realized),remaining_amount:String(amount.remaining)}];
  });
}

export async function listEconomicPeriodExpenses(client:SupabaseClient,householdId:string,startDate:string,endDate:string,memberId?:string){
  assertExpensePeriod(startDate,endDate);
  const transactions=await collectPages<EconomicTransactionRow>((from,to)=>
    client.from('transactions')
      .select('id,description,amount,transaction_date,created_at,economic_state,category_id,buyer_member_id,category:categories(name,type,icon,color),payment_instrument:transaction_payment_instruments(kind,account:accounts(name,institution),card:cards(name,institution,last_four))')
      .eq('household_id',householdId)
      .eq('type','expense')
      .is('deleted_at',null)
      .gte('transaction_date',startDate)
      .lte('transaction_date',endDate)
      .eq('economic_state','realized')
      .order('transaction_date',{ascending:false})
      .order('created_at',{ascending:false})
      .order('id',{ascending:true})
      .range(from,to)
  );
  if(transactions.length===0)return [];

  const positions=new Map<string,number>();
  const allocationRows:AllocationRow[]=[];
  const recurringRuleByTransaction=new Map<string,string>();
  const memberAmounts=new Map<string,number>();

  for(const ids of chunkValues(transactions.map(row=>row.id))){
    const[positionsResponse,allocationRowsPage,recurringResponse]=await Promise.all([
      client.from('financial_transaction_positions')
        .select('transaction_id,household_economic_amount,economic_state')
        .eq('household_id',householdId)
        .eq('economic_state','realized')
        .in('transaction_id',ids),
      collectPages<AllocationRow&{amount:string|number}>((from,to)=>
        client.from('economic_allocations')
          .select('transaction_id,responsible_member_id,responsible_party_id,amount')
          .eq('household_id',householdId)
          .in('transaction_id',ids)
          .order('transaction_id',{ascending:true})
          .range(from,to)
      ),
      client.from('recurring_occurrences')
        .select('transaction_id,recurring_rule_id')
        .eq('household_id',householdId)
        .in('transaction_id',ids),
    ]);
    if(positionsResponse.error)throw positionsResponse.error;
    if(recurringResponse.error)throw recurringResponse.error;

    for(const row of (positionsResponse.data??[]) as EconomicPositionRow[])positions.set(row.transaction_id,Number(row.household_economic_amount));
    for(const row of allocationRowsPage){
      allocationRows.push(row);
      if(memberId&&row.responsible_member_id===memberId)memberAmounts.set(row.transaction_id,(memberAmounts.get(row.transaction_id)??0)+Number(row.amount??0));
    }
    for(const row of (recurringResponse.data??[]) as RecurringOccurrenceRow[])recurringRuleByTransaction.set(row.transaction_id,row.recurring_rule_id);
  }

  const responsibility=buildResponsibilityMap(allocationRows);
  return transactions.flatMap(row=>{
    const householdAmount=positions.get(row.id)??Number(row.amount);
    const perspectiveAmount=memberId?(memberAmounts.get(row.id)??0):householdAmount;
    if(memberId&&perspectiveAmount<=0)return[];
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
      recurring_rule_id:recurringRuleByTransaction.get(row.id)??null,
      buyer_member_id:row.buyer_member_id,
      instrument_kind:normalizeInstrument(row.payment_instrument).kind,
      instrument_label:normalizeInstrument(row.payment_instrument).label,
    }];
  }) as EconomicMonthExpense[];
}
