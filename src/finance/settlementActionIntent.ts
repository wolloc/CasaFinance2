export type SettlementActionIntent =
  | { kind: 'members'; debtorMemberId: string; creditorMemberId: string; amount: number }
  | { kind: 'third-party'; obligationId: string; amount: number };

let pendingIntent: SettlementActionIntent | null = null;

export function setSettlementActionIntent(intent: SettlementActionIntent) {
  pendingIntent = intent;
}

export function consumeSettlementActionIntent() {
  const intent = pendingIntent;
  pendingIntent = null;
  return intent;
}
