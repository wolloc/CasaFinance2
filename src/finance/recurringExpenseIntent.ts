export type RecurringExpenseActionMode = 'confirm' | 'pay';

export type RecurringExpenseActionIntent = {
  occurrenceId: string;
  mode: RecurringExpenseActionMode;
};

let pendingIntent: RecurringExpenseActionIntent | null = null;

export function setRecurringExpenseActionIntent(intent: RecurringExpenseActionIntent) {
  pendingIntent = intent;
}

export function consumeRecurringExpenseActionIntent() {
  const intent = pendingIntent;
  pendingIntent = null;
  return intent;
}
