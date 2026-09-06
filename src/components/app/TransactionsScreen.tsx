import { HouseholdTransactionsSetup } from '../auth/HouseholdTransactionsSetup.js';
import type { TransactionKind } from '../../finance/householdTransactions.js';
import { IncomeLedgerScreen } from './IncomeLedgerScreen.js';
import { RecurringExpenseAction } from './RecurringExpenseAction.js';
import { RecurringExpenseManagement } from './RecurringExpenseManagement.js';
import { RecurringExpenseCommitmentCenter } from './RecurringExpenseCommitmentCenter.js';
import { DirectExpensePaymentAction } from './DirectExpensePaymentAction.js';
import { PartialDirectRefundAction } from './PartialDirectRefundAction.js';
import { CardRefundAction } from './CardRefundAction.js';
import { PostPaymentCardRefundAction } from './PostPaymentCardRefundAction.js';

export function TransactionsScreen({ mode }: { mode: TransactionKind }) {
  if (mode === 'income') return <IncomeLedgerScreen />;
  return <div className="space-y-4">
    <RecurringExpenseCommitmentCenter />
    <DirectExpensePaymentAction />
    <PartialDirectRefundAction />
    <CardRefundAction />
    <PostPaymentCardRefundAction />
    <RecurringExpenseAction />
    <RecurringExpenseManagement />
    <HouseholdTransactionsSetup embedded mode={mode} />
  </div>;
}
