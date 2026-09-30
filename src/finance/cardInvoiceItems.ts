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
  const rows=(response.data??[]) as Omit<CardInvoiceItem,'purchase_date'>[];
  const transactionIds=[...new Set(rows.map(row=>row.source_transaction_id).filter((id):id is string=>Boolean(id)))];
  const purchaseDates=new Map<string,string>();
  if(transactionIds.length>0){
    const transactions=await client.from('transactions').select('id,transaction_date').eq('household_id',householdId).in('id',transactionIds);
    if(transactions.error)throw transactions.error;
    for(const row of transactions.data??[])purchaseDates.set(String(row.id),String(row.transaction_date));
  }
  return rows.map(row=>({...row,purchase_date:row.source_transaction_id?purchaseDates.get(row.source_transaction_id)??null:null}));
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
