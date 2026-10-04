import type { SupabaseClient } from '@supabase/supabase-js';
export type FinancialInvoice = { invoice_id:string; card_id:string; competence_date:string; closing_date:string; due_date:string; status:string; total_amount:number; settled_amount:number; outstanding_amount:number; financed_balance:number; is_overdue:boolean; planned_payment_account_id:string|null; card_name:string; account_name:string|null };
export async function listFinancialInvoices(client: SupabaseClient, householdId: string): Promise<FinancialInvoice[]> {
  const [positions, cards, accounts] = await Promise.all([
    client.from('financial_invoice_positions').select('*').eq('household_id', householdId).order('due_date', { ascending: false }),
    client.from('cards').select('id,name').eq('household_id', householdId).is('deactivated_at', null),
    client.from('accounts').select('id,name').eq('household_id', householdId).is('deactivated_at', null),
  ]);
  if (positions.error) throw positions.error; if (cards.error) throw cards.error; if (accounts.error) throw accounts.error;
  const cardNames = new Map((cards.data ?? []).map((row) => [row.id, row.name])); const accountNames = new Map((accounts.data ?? []).map((row) => [row.id, row.name]));
  return (positions.data ?? []).map((row) => ({ ...row, card_name: cardNames.get(row.card_id) ?? 'Cartão', account_name: row.planned_payment_account_id ? accountNames.get(row.planned_payment_account_id) ?? null : null })) as FinancialInvoice[];
}

export async function getFinancialInvoice(client: SupabaseClient, householdId: string, invoiceId: string): Promise<FinancialInvoice | null> {
  const { data: row, error } = await client.from('financial_invoice_positions').select('*').eq('household_id', householdId).eq('invoice_id', invoiceId).maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const [{ data: card, error: cardError }, { data: account, error: accountError }] = await Promise.all([
    client.from('cards').select('id,name').eq('id', row.card_id).eq('household_id', householdId).maybeSingle(),
    row.planned_payment_account_id ? client.from('accounts').select('id,name').eq('id', row.planned_payment_account_id).eq('household_id', householdId).maybeSingle() : Promise.resolve({ data: null, error: null } as const),
  ]);
  if (cardError) throw cardError;
  if (accountError) throw accountError;
  return { ...row, card_name: card?.name ?? 'Cartão', account_name: account?.name ?? null } as FinancialInvoice;
}
