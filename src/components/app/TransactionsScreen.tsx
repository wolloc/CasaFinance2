import { HouseholdTransactionsSetup } from '../auth/HouseholdTransactionsSetup.js';
import type { TransactionKind } from '../../finance/householdTransactions.js';
import { IncomeLedgerScreen } from './IncomeLedgerScreen.js';
import { RecurringExpenseAction } from './RecurringExpenseAction.js';
import { RecurringExpenseManagement } from './RecurringExpenseManagement.js';
import { RecurringExpenseCommitmentCenter } from './RecurringExpenseCommitmentCenter.js';
import { DirectExpensePaymentAction } from './DirectExpensePaymentAction.js';
import { PartialDirectRefundAction } from './PartialDirectRefundAction.js';

export function TransactionsScreen({ mode }: { mode: TransactionKind }) {
  if (mode === 'income') return <IncomeLedgerScreen />;
  return <div className="space-y-4">
    <RecurringExpenseCommitmentCenter />
    <DirectExpensePaymentAction />
    <PartialDirectRefundAction />
    <RecurringExpenseAction />
    <RecurringExpenseManagement />
    <HouseholdTransactionsSetup embedded mode={mode} />
  </div>;
}
