export type IncomeReceiptIntent = {
  moneyMovementId: string;
};

let pendingIntent: IncomeReceiptIntent | null = null;

export function setIncomeReceiptIntent(intent: IncomeReceiptIntent) {
  pendingIntent = intent;
}

export function consumeIncomeReceiptIntent() {
  const intent = pendingIntent;
  pendingIntent = null;
  return intent;
}
