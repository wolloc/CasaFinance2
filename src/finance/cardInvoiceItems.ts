import type { SupabaseClient } from '@supabase/supabase-js';

export type CardInvoiceItem = {
  commitment_key: string;
  source_type: string;
  source_transaction_id: string | null;
  source_installment_id: string | null;
  financial_date: string;
  due_date: string | null;
  effective_amount: number | string;
  realized_amount: number | string;
  remaining_amount: number | string;
  commitment_state: string;
  description: string;
  purchase_date: string | null;
  installment_number: number | null;
  total_installments: number | null;
};

export async function listCardInvoiceItems(client: SupabaseClient, householdId: string, invoiceId: string): Promise<CardInvoiceItem[]> {
  const response = await client
    .from('financial_card_commitment_positions')
    .select('commitment_key,source_type,source_transaction_id,source_installment_id,financial_date,due_date,effective_amount,realized_amount,remaining_amount,commitment_state,description')
    .eq('household_id', householdId)
    .eq('source_invoice_id', invoiceId)
    .order('financial_date', { ascending: true })
    .order('commitment_key', { ascending: true });
  if (response.error) throw response.error;
  const rows=(response.data??[]) as Omit<CardInvoiceItem,'purchase_date'|'installment_number'|'total_installments'>[];
  const transactionIds=[...new Set(rows.map(row=>row.source_transaction_id).filter((id):id is string=>Boolean(id)))];
  const purchaseDates=new Map<string,string>();
  const installmentIds=[...new Set(rows.map(row=>row.source_installment_id).filter((id):id is string=>Boolean(id)))];
  const installmentNumbers=new Map<string,number>();
  const installmentTotals=new Map<string,number>();
  if(transactionIds.length>0){
    const transactions=await client.from('transactions').select('id,transaction_date').eq('household_id',householdId).in('id',transactionIds);
    if(transactions.error)throw transactions.error;
    for(const row of transactions.data??[])purchaseDates.set(String(row.id),String(row.transaction_date));
  }
  if(installmentIds.length>0){
    const installments=await client.from('installments').select('id,number,installment_plan_id').eq('household_id',householdId).in('id',installmentIds);
    if(installments.error)throw installments.error;
    const planIds=[...new Set((installments.data??[]).map(row=>row.installment_plan_id).filter((id):id is string=>Boolean(id)))];
    for(const row of installments.data??[])installmentNumbers.set(String(row.id),Number(row.number));
    if(planIds.length>0){
      const plans=await client.from('installment_plans').select('id,installment_count').eq('household_id',householdId).in('id',planIds);
      if(plans.error)throw plans.error;
      const totalsByPlan=new Map((plans.data??[]).map(row=>[String(row.id),Number(row.installment_count)]));
      for(const row of installments.data??[])if(row.installment_plan_id)installmentTotals.set(String(row.id),totalsByPlan.get(String(row.installment_plan_id))??null);
    }
  }
  return rows.map(row=>({...row,purchase_date:row.source_transaction_id?purchaseDates.get(row.source_transaction_id)??null:null,installment_number:row.source_installment_id?installmentNumbers.get(row.source_installment_id)??null:null,total_installments:row.source_installment_id?installmentTotals.get(row.source_installment_id)??null:null}));
}


export type CardInvoiceExposure = {
  card_id: string;
  credit_limit: number|string;
  current_invoice_remaining: number|string;
  future_known_commitments: number|string;
  available_limit: number|string;
  utilization_ratio: number|string|null;
  over_limit_amount: number|string;
  next_due_date: string|null;
  card_health: 'green'|'yellow'|'red';
};

export async function getCardInvoiceExposure(client:SupabaseClient, householdId:string, cardId:string):Promise<CardInvoiceExposure|null>{
  const response=await client.from('financial_card_health_positions')
    .select('card_id,credit_limit,current_invoice_remaining,future_known_commitments,available_limit,utilization_ratio,over_limit_amount,next_due_date,card_health')
    .eq('household_id',householdId)
    .eq('card_id',cardId)
    .maybeSingle();
  if(response.error)throw response.error;
  return response.data as CardInvoiceExposure|null;
}
