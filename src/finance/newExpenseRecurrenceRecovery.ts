export type PendingExpenseRecurrence = {
  householdId: string;
  transactionId: string;
  recurringRuleId: string | null;
  startDate: string;
  endDate: string;
};

const storageKey = (householdId: string) => `casa-finance:pending-expense-recurrence:${householdId}`;

function storage() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

export function loadPendingExpenseRecurrence(householdId: string): PendingExpenseRecurrence | null {
  const target = storage();
  if (!target || !householdId) return null;
  try {
    const raw = target.getItem(storageKey(householdId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingExpenseRecurrence>;
    if (parsed.householdId !== householdId || typeof parsed.transactionId !== 'string' || !parsed.transactionId) return null;
    if ('frequency' in parsed && parsed.frequency !== undefined && parsed.frequency !== 'monthly') return null;
    if ('intervalCount' in parsed && parsed.intervalCount !== undefined && Number(parsed.intervalCount) !== 1) return null;
    if (typeof parsed.startDate !== 'string' || !parsed.startDate) return null;
    return {
      householdId,
      transactionId: parsed.transactionId,
      recurringRuleId: typeof parsed.recurringRuleId === 'string' && parsed.recurringRuleId ? parsed.recurringRuleId : null,
      startDate: parsed.startDate,
      endDate: typeof parsed.endDate === 'string' ? parsed.endDate : '',
    };
  } catch {
    return null;
  }
}

export function savePendingExpenseRecurrence(value: PendingExpenseRecurrence) {
  const target = storage();
  if (!target) return;
  target.setItem(storageKey(value.householdId), JSON.stringify(value));
}

export function clearPendingExpenseRecurrence(householdId: string) {
  const target = storage();
  if (!target || !householdId) return;
  target.removeItem(storageKey(householdId));
}
