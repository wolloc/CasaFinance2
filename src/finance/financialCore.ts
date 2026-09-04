import type { SupabaseClient } from '@supabase/supabase-js';

export async function listFinancialCore(client: SupabaseClient, householdId: string) {
  const [invoices, rules] = await Promise.all([
    client.from('card_invoices').select('id,card_id,competence_date,due_date,status,total_amount,settled_amount,cards(name)').eq('household_id', householdId).is('deleted_at', null).order('due_date'),
    client.from('recurring_rules').select('id,frequency,interval_count,start_date,next_occurrence_date,template_transaction_id').eq('household_id', householdId).is('deactivated_at', null),
  ]);
  if (invoices.error) throw invoices.error; if (rules.error) throw rules.error;
  return { invoices: invoices.data ?? [], rules: rules.data ?? [] };
}

export async function transfer(client: SupabaseClient, householdId: string, source: string, destination: string, amount: string, date: string) {
  const result = await client.rpc('create_transfer', { p_household_id: householdId, p_source_account_id: source, p_destination_account_id: destination, p_amount: amount, p_date: date, p_description: 'Transferência entre contas' }); if (result.error) throw result.error;
}
export async function payInvoice(client: SupabaseClient, householdId: string, invoice: string, account: string, funder: string, amount: string) {
  const result = await client.rpc('pay_card_invoice', { p_household_id: householdId, p_invoice_id: invoice, p_source_account_id: account, p_funder_member_id: funder, p_amount: amount }); if (result.error) throw result.error;
}
export async function createRecurringRule(client: SupabaseClient, householdId: string, template: string, frequency: string, date: string) {
  const result = await client.rpc('create_recurring_rule', { p_household_id: householdId, p_template_transaction_id: template, p_frequency: frequency, p_interval_count: 1, p_start_date: date, p_end_date: null }); if (result.error) throw result.error;
}
export async function generateOccurrence(client: SupabaseClient, householdId: string, rule: string, date: string) {
  const result = await client.rpc('generate_recurring_occurrence', { p_household_id: householdId, p_rule_id: rule, p_occurrence_date: date }); if (result.error) throw result.error;
}
