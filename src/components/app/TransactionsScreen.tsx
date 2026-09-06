import { HouseholdTransactionsSetup } from '../auth/HouseholdTransactionsSetup.js';
import type { TransactionKind } from '../../finance/householdTransactions.js';
import { IncomeLedgerScreen } from './IncomeLedgerScreen.js';
import { RecurringExpenseAction } from './RecurringExpenseAction.js';
import { RecurringExpenseManagement } from './RecurringExpenseManagement.js';
import { DirectExpensePaymentAction } from './DirectExpensePaymentAction.js';

export function TransactionsScreen({ mode }: { mode: TransactionKind }) {
  if (mode === 'income') return <IncomeLedgerScreen />;
  return <div className="space-y-4">
    <DirectExpensePaymentAction />
    <RecurringExpenseAction />
    <RecurringExpenseManagement />
    <HouseholdTransactionsSetup embedded mode={mode} />
  </div>;
}
