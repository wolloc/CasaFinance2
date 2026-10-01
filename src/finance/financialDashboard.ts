import { DEFAULT_HOUSEHOLD_TIMEZONE, monthStartInTimeZone } from './householdClock.js';
import type { SupabaseClient } from '@supabase/supabase-js';

export type HouseholdFinancialPosition = { household_id:string; available_money:number; restricted_resources:number; reserves:number; investments:number; receivables:number; payables:number; open_invoices:number; committed_balance:number; projected_balance:number; };
export type MemberFinancialPosition = { member_id:string; economic_responsibility:number; confirmed_responsibility:number; forecast_responsibility:number; real_funding:number; };
export type HouseholdHealthPosition = { household_id:string; reference_month:string; current_cash:number; expected_reliable_income_remaining:number; remaining_commitments:number; prior_pending_outflow:number; projected_ending_cash:number; projected_margin_ratio:number|null; overdraft_used:number; overdue_commitment_amount:number; health:'green'|'yellow'|'red'; health_reason:string; };
export type ProjectionConfidence = { confidence_state:'well_updated'|'needs_confirmation'|'stale_important_information'; confidence_label:string; };
export type AttentionItem = { attention_key:string; attention_type:string; severity:'yellow'|'red'; amount:number; due_date:string|null; entity_type:string; entity_id:string; title:string; priority_score:number; priority_reason:string; recommended_action:'expenses'|'invoices'|'income'|'coverage'|null; action_label:string|null; };
export type MonthlyProjection = { financial_month:string; month_index:number; opening_cash:number; realized_true_income_in_month:number; expected_reliable_income_remaining:number; realized_commitments_in_month:number; remaining_commitments_in_month:number; projected_recurring_commitments:number; prior_pending_outflow:number; projected_ending_cash:number; };
export type MemberMonthlyProjection = { household_id:string; member_id:string; reference_month:string; financial_month:string; month_index:number; opening_liquidity:number; realized_true_income_in_month:number; expected_reliable_income_remaining:number; economic_responsibility_remaining:number; realized_funding_in_month:number; projected_funding_remaining:number; unattributed_funding_remaining:number; scheduled_settlement_inflow:number; scheduled_settlement_outflow:number; settlement_receivable_position:number; settlement_payable_position:number; projected_net_change:number; projected_ending_liquidity:number; };
export type UnattributedFundingDetail={commitment_key:string;financial_month:string;amount:number;source_type:string;description:string;due_date:string|null;source_obligation_id:string|null;};
export type CardHealthPosition = { card_id:string; card_name:string; credit_limit:number; current_invoice_remaining:number; future_known_commitments:number; available_limit:number; utilization_ratio:number|null; over_limit_amount:number; next_due_date:string|null; card_health:'green'|'yellow'|'red'; };
export type MemberSettlementPosition = { debtor_member_id:string; creditor_member_id:string; realized_outstanding:number; projected_outstanding:number; scheduled_settlement_amount:number; net_position:number; };
export type ResourceSummary = { availableCash:number; benefits:number; reserves:number; investments:number; };
export type FinancialDashboardAvailability = { household:boolean; members:boolean; health:boolean; confidence:boolean; attention:boolean; projection:boolean; cards:boolean; settlements:boolean; resources:boolean; guidance:boolean; };
export type LiquidityGuidance = { household_id:string; current_cash:number; committed_before_new_income:number; free_cash_after_commitments:number; reliable_income_remaining:number; projected_ending_cash:number; coverage_gap:number; reserve_balance:number; investment_balance:number; overdraft_used:number; guidance_state:'covered'|'covered_by_expected_income'|'needs_resource_reallocation'|'needs_funding_plan'; guidance_title:string; };
type AccountBalanceRow = { type:string; resource_restriction:string|null; current_balance:number|string; is_restricted:boolean; is_investment:boolean; };

const currentMonth=(timeZone:string)=>monthStartInTimeZone(timeZone);
const summarizeResources=(rows:AccountBalanceRow[]):ResourceSummary=>rows.reduce((summary,row)=>{const amount=Number(row.current_balance??0);if(row.is_investment)summary.investments+=amount;else if(row.resource_restriction==='reserve')summary.reserves+=amount;else if(row.type==='meal_benefit')summary.benefits+=amount;else if(!row.is_restricted)summary.availableCash+=amount;return summary;},{availableCash:0,benefits:0,reserves:0,investments:0});

export async function getMemberFinancialPerspective(client:SupabaseClient,householdId:string,memberId:string,timeZone:string=DEFAULT_HOUSEHOLD_TIMEZONE):Promise<MemberMonthlyProjection[]>{const response=await client.rpc('financial_member_monthly_projection',{p_household_id:householdId,p_member_id:memberId,p_reference_month:currentMonth(timeZone),p_horizon_months:4});if(response.error)throw response.error;return(response.data??[])as MemberMonthlyProjection[];}

export async function listUnattributedFundingDetails(client:SupabaseClient,householdId:string,financialMonth:string):Promise<UnattributedFundingDetail[]>{const response=await client.from('financial_unattributed_funding_details').select('commitment_key,financial_month,amount,source_type,description,due_date,source_obligation_id').eq('household_id',householdId).eq('financial_month',financialMonth).order('due_date');if(response.error)throw response.error;return(response.data??[])as UnattributedFundingDetail[];}

export async function getFinancialDashboard(client:SupabaseClient,householdId:string,timeZone:string=DEFAULT_HOUSEHOLD_TIMEZONE){
  const [household,members,health,confidence,attention,projection,cards,settlements,accountBalances,guidance]=await Promise.all([
    client.from('financial_household_position').select('*').eq('household_id',householdId).maybeSingle(),
    client.from('financial_member_positions').select('*').eq('household_id',householdId),
    client.rpc('financial_household_health_position',{p_household_id:householdId}),
    client.from('financial_projection_confidence_positions').select('confidence_state,confidence_label').eq('household_id',householdId).maybeSingle(),
    client.rpc('financial_priority_attention_items',{p_household_id:householdId}),
    client.rpc('financial_monthly_projection',{p_household_id:householdId,p_reference_month:currentMonth(timeZone),p_horizon_months:4}),
    client.from('financial_card_health_positions').select('card_id,card_name,credit_limit,current_invoice_remaining,future_known_commitments,available_limit,utilization_ratio,over_limit_amount,next_due_date,card_health').eq('household_id',householdId).order('card_name'),
    client.from('financial_member_settlement_positions').select('debtor_member_id,creditor_member_id,realized_outstanding,projected_outstanding,scheduled_settlement_amount,net_position').eq('household_id',householdId),
    client.from('financial_account_balances').select('type,resource_restriction,current_balance,is_restricted,is_investment').eq('household_id',householdId),
    client.rpc('financial_liquidity_guidance',{p_household_id:householdId}),
  ]);

  const availability:FinancialDashboardAvailability={
    household:!household.error,
    members:!members.error,
    health:!health.error,
    confidence:!confidence.error,
    attention:!attention.error,
    projection:!projection.error,
    cards:!cards.error,
    settlements:!settlements.error,
    resources:!accountBalances.error,
    guidance:!guidance.error,
  };

  if(!Object.values(availability).some(Boolean)){
    throw new Error('Não foi possível carregar nenhuma fonte canônica da posição financeira.');
  }

  return {
    household:availability.household?household.data as HouseholdFinancialPosition|null:null,
    members:availability.members?(members.data??[])as MemberFinancialPosition[]:[],
    health:availability.health?((health.data??[])[0]??null)as HouseholdHealthPosition|null:null,
    confidence:availability.confidence?confidence.data as ProjectionConfidence|null:null,
    attention:availability.attention?((attention.data??[])as AttentionItem[]).filter(item=>item.attention_type!=='recurring_expense_due'):[],
    projection:availability.projection?(projection.data??[])as MonthlyProjection[]:[],
    cards:availability.cards?(cards.data??[])as CardHealthPosition[]:[],
    settlements:availability.settlements?(settlements.data??[])as MemberSettlementPosition[]:[],
    resources:availability.resources?summarizeResources((accountBalances.data??[])as AccountBalanceRow[]):null,
    guidance:availability.guidance?((guidance.data??[])[0]??null)as LiquidityGuidance|null:null,
    availability,
  };
}
