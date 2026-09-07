export type DirectExpensePaymentIntent = {
  transactionId: string;
};

let pendingIntent: DirectExpensePaymentIntent | null = null;

export function setDirectExpensePaymentIntent(intent: DirectExpensePaymentIntent) {
  pendingIntent = intent;
}

export function consumeDirectExpensePaymentIntent() {
  const intent = pendingIntent;
  pendingIntent = null;
  return intent;
}
