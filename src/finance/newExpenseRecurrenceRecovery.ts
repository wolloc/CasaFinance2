export type PendingExpenseRecurrence = {
  householdId: string;
  transactionId: string;
  recurringRuleId: string | null;
  startDate: string;
  endDate: string;
  legacyIntent?: boolean;
};

type PersistedPendingExpenseRecurrence = Partial<PendingExpenseRecurrence> & {
  frequency?: unknown;
  intervalCount?: unknown;
};

const storageKey = (householdId: string) => `casa-finance:pending-expense-recurrence:${householdId}`;

function storage() {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

export function parsePendingExpenseRecurrence(raw: string, householdId: string): PendingExpenseRecurrence | null {
  try {
    const parsed = JSON.parse(raw) as PersistedPendingExpenseRecurrence;
    if (parsed.householdId !== householdId || typeof parsed.transactionId !== 'string' || !parsed.transactionId) return null;
    if (typeof parsed.startDate !== 'string' || !parsed.startDate) return null;

    const legacyFrequency = typeof parsed.frequency === 'string' && parsed.frequency !== 'monthly';
    const legacyInterval = parsed.intervalCount !== undefined && Number(parsed.intervalCount) !== 1;

    return {
      householdId,
      transactionId: parsed.transactionId,
      recurringRuleId: typeof parsed.recurringRuleId === 'string' && parsed.recurringRuleId ? parsed.recurringRuleId : null,
      startDate: parsed.startDate,
      endDate: typeof parsed.endDate === 'string' ? parsed.endDate : '',
      legacyIntent: Boolean(parsed.legacyIntent || legacyFrequency || legacyInterval),
    };
  } catch {
    return null;
  }
}

export function loadPendingExpenseRecurrence(householdId: string): PendingExpenseRecurrence | null {
  const target = storage();
  if (!target || !householdId) return null;
  const raw = target.getItem(storageKey(householdId));
  if (!raw) return null;
  return parsePendingExpenseRecurrence(raw, householdId);
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
