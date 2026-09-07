import type { SupabaseClient } from '@supabase/supabase-js';

export type CardHealth = 'green' | 'yellow' | 'red';
export type CardHealthReason = 'comfortable' | 'due_soon' | 'moderate_utilization' | 'high_utilization' | 'overdue_invoice' | 'over_limit';

export type CardOverview = {
  household_id: string;
  card_id: string;
  owner_member_id: string | null;
  card_name: string;
  credit_limit: number;
  current_invoice_remaining: number;
  future_known_commitments: number;
  total_exposure: number;
  available_limit: number;
  utilization_ratio: number | null;
  over_limit_amount: number;
  overdue_invoice_amount: number;
  due_soon_amount: number;
  next_due_date: string | null;
  card_health: CardHealth;
  health_reason: CardHealthReason;
  member_responsibilities: Array<{
    member_id: string;
    member_current_invoice_responsibility: number;
    member_future_responsibility: number;
    member_responsibility_exposure: number;
  }>;
};

type HealthRow = Omit<CardOverview, 'member_responsibilities'>;
type MemberRow = CardOverview['member_responsibilities'][number] & { household_id: string; card_id: string };

const numberValue = (value: unknown) => Number(value ?? 0);

export async function listCardOverviews(client: SupabaseClient, householdId: string): Promise<CardOverview[]> {
  const [healthResponse, membersResponse] = await Promise.all([
    client.from('financial_card_health_positions')
      .select('household_id, card_id, owner_member_id, card_name, credit_limit, current_invoice_remaining, future_known_commitments, total_exposure, available_limit, utilization_ratio, over_limit_amount, overdue_invoice_amount, due_soon_amount, next_due_date, card_health, health_reason')
      .eq('household_id', householdId)
      .order('card_name'),
    client.from('financial_member_card_positions')
      .select('household_id, card_id, member_id, member_current_invoice_responsibility, member_future_responsibility, member_responsibility_exposure')
      .eq('household_id', householdId),
  ]);
  if (healthResponse.error) throw healthResponse.error;
  if (membersResponse.error) throw membersResponse.error;

  const membersByCard = new Map<string, CardOverview['member_responsibilities']>();
  for (const raw of membersResponse.data ?? []) {
    const row = raw as unknown as MemberRow;
    const list = membersByCard.get(row.card_id) ?? [];
    list.push({
      member_id: row.member_id,
      member_current_invoice_responsibility: numberValue(row.member_current_invoice_responsibility),
      member_future_responsibility: numberValue(row.member_future_responsibility),
      member_responsibility_exposure: numberValue(row.member_responsibility_exposure),
    });
    membersByCard.set(row.card_id, list);
  }

  return (healthResponse.data ?? []).map((raw) => {
    const row = raw as unknown as HealthRow;
    return {
      ...row,
      credit_limit: numberValue(row.credit_limit),
      current_invoice_remaining: numberValue(row.current_invoice_remaining),
      future_known_commitments: numberValue(row.future_known_commitments),
      total_exposure: numberValue(row.total_exposure),
      available_limit: numberValue(row.available_limit),
      utilization_ratio: row.utilization_ratio == null ? null : numberValue(row.utilization_ratio),
      over_limit_amount: numberValue(row.over_limit_amount),
      overdue_invoice_amount: numberValue(row.overdue_invoice_amount),
      due_soon_amount: numberValue(row.due_soon_amount),
      member_responsibilities: membersByCard.get(row.card_id) ?? [],
    };
  });
}
