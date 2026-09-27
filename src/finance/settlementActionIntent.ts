export type SettlementActionIntent =
  | { kind: 'members'; debtorMemberId: string; creditorMemberId: string; amount: number }
  | { kind: 'third-party'; obligationId: string; amount: number }
  | { kind: 'third-party-create' }
  | { kind: 'third-party-manage'; obligationId?: string }
  | { kind: 'third-party-loss'; obligationId: string }
  | { kind: 'third-party-forgiveness'; obligationId: string };

let pendingIntent: SettlementActionIntent | null = null;

export function setSettlementActionIntent(intent: SettlementActionIntent) {
  pendingIntent = intent;
}

export function consumeSettlementActionIntent() {
  const intent = pendingIntent;
  pendingIntent = null;
  return intent;
}
