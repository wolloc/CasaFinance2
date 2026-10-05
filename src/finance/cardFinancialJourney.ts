import type { SupabaseClient } from '@supabase/supabase-js';

export type CardJourneyFundingEvent = { member_id: string; amount: string; funded_at: string };
export type CardJourneyPaymentEvent = { account_id: string; amount: string; paid_at: string };
export type CardJourneySettlementEvent = { debtor_member_id: string; creditor_member_id: string; amount: string; state: 'projected' | 'realized'; financial_date: string };
export type CardJourneyCreditEvent = { source_transaction_id: string; installment_id: string | null; amount: string; occurred_at: string; reason: string };

export type CardFinancialJourney = {
  household_id: string;
  card_id: string;
  card_name: string;
  invoice_id: string;
  invoice_month: string;
  due_date: string;
  known_invoice_amount: string;
  paid_amount: string;
  remaining_amount: string;
  state: string;
  is_current_invoice: boolean;
  is_future_invoice: boolean;
  purchase_commitment_count: number;
  installment_count: number;
  commitment_amount: string;
  payment_amount: string;
  last_paid_at: string | null;
  payment_events: CardJourneyPaymentEvent[];
  credit_amount: string;
  credit_events: CardJourneyCreditEvent[];
  funding_events: CardJourneyFundingEvent[];
  settlement_events: CardJourneySettlementEvent[];
};

export async function listCardFinancialJourney(client: SupabaseClient, householdId: string, cardId: string) {
  const response = await client.from('financial_card_journey_positions')
    .select('household_id,card_id,card_name,invoice_id,invoice_month,due_date,known_invoice_amount,paid_amount,remaining_amount,state,is_current_invoice,is_future_invoice,purchase_commitment_count,installment_count,commitment_amount,payment_amount,last_paid_at,payment_events,credit_amount,credit_events,funding_events,settlement_events')
    .eq('household_id', householdId)
    .eq('card_id', cardId)
    .order('invoice_month', { ascending: false });

  if (!response.error) return (response.data ?? []) as CardFinancialJourney[];

  // Fallback seguro: a abertura da fatura não pode depender dos agregados
  // opcionais da jornada. Reconsultamos somente a posição financeira
  // materializada da própria fatura, sem presumir valores.
  const fallback = await client.from('financial_card_invoice_positions')
    .select('household_id,card_id,invoice_id,invoice_month,due_date,known_invoice_amount,paid_amount,remaining_amount,state,is_current_invoice,is_future_invoice')
    .eq('household_id', householdId)
    .eq('card_id', cardId)
    .neq('state', 'cancelled')
    .order('invoice_month', { ascending: false });

  if (fallback.error) throw response.error;

  const card = await client.from('cards')
    .select('id,name')
    .eq('household_id', householdId)
    .eq('id', cardId)
    .is('deactivated_at', null)
    .maybeSingle();

  if (card.error) throw response.error;

  return (fallback.data ?? []).map(row => ({
    ...row,
    card_name: card.data?.name ?? 'Cartão',
    purchase_commitment_count: 0,
    installment_count: 0,
    commitment_amount: row.known_invoice_amount,
    payment_amount: row.paid_amount,
    last_paid_at: null,
    payment_events: [],
    credit_amount: '0',
    credit_events: [],
    funding_events: [],
    settlement_events: [],
  })) as CardFinancialJourney[];
}
