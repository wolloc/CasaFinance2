import type { SupabaseClient } from '@supabase/supabase-js';
import { runRetryStableRpc } from './retryIdempotency.js';

export type FinancialParty = { id: string; name: string };

export async function listFinancialParties(client: SupabaseClient, householdId: string): Promise<FinancialParty[]> {
  const result = await client.from('financial_parties')
    .select('id,name')
    .eq('household_id', householdId)
    .is('deactivated_at', null)
    .order('name');
  if (result.error) throw result.error;
  return (result.data ?? []) as FinancialParty[];
}

export async function createFinancialParty(client: SupabaseClient, householdId: string, name: string) {
  const result = await client.rpc('create_financial_party', {
    p_household_id: householdId,
    p_name: name.trim(),
    p_kind: 'person',
    p_tax_id: null,
    p_notes: null,
  });
  if (result.error) throw result.error;
  return result.data as string;
}

export async function createLoanPrincipal(client: SupabaseClient, input: {
  householdId: string;
  direction: 'granted' | 'taken';
  counterpartyId: string;
  accountId: string;
  amount: string;
  occurredAt: string;
  dueDate?: string;
  description: string;
  notes?: string;
}) {
  const dueDate = input.dueDate || null;
  const description = input.description.trim() || 'Empréstimo';
  const notes = input.notes?.trim() || null;
  const identity = [input.householdId, input.direction, input.counterpartyId, input.accountId, input.amount, input.occurredAt, dueDate, description, notes] as const;
  return runRetryStableRpc(client, 'create-loan-principal', identity, 'create_loan_principal_idempotent', {
    p_household_id: input.householdId,
    p_direction: input.direction,
    p_counterparty_id: input.counterpartyId,
    p_account_id: input.accountId,
    p_amount: input.amount,
    p_occurred_at: input.occurredAt,
    p_due_date: dueDate,
    p_description: description,
    p_notes: notes,
  });
}


export async function createLoanPrincipalWithSchedule(client:SupabaseClient,input:{
  householdId:string;
  direction:'granted'|'taken';
  counterpartyId:string;
  accountId:string;
  amount:string;
  occurredAt:string;
  firstDueDate:string;
  installmentCount:number;
  totalInterest:string;
  totalFee:string;
  costResponsibleMemberId?:string|null;
  description:string;
  notes?:string;
}){
  const description=input.description.trim()||'Empréstimo';
  const notes=input.notes?.trim()||null;
  const identity=[
    input.householdId,input.direction,input.counterpartyId,input.accountId,input.amount,input.occurredAt,
    input.firstDueDate,input.installmentCount,input.totalInterest||'0',input.totalFee||'0',
    input.costResponsibleMemberId??null,description,notes
  ] as const;
  return runRetryStableRpc(client,'create-loan-principal-with-schedule',identity,'create_loan_principal_with_schedule_idempotent',{
    p_household_id:input.householdId,
    p_direction:input.direction,
    p_counterparty_id:input.counterpartyId,
    p_account_id:input.accountId,
    p_amount:input.amount,
    p_occurred_at:input.occurredAt,
    p_first_due_date:input.firstDueDate,
    p_installment_count:input.installmentCount,
    p_total_interest:input.totalInterest||'0',
    p_total_fee:input.totalFee||'0',
    p_cost_responsible_member_id:input.costResponsibleMemberId??null,
    p_description:description,
    p_notes:notes,
  });
}
