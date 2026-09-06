import { useMemo } from 'react';
import { HouseholdTransactionsSetup } from '../auth/HouseholdTransactionsSetup.js';
import type { TransactionKind } from '../../finance/householdTransactions.js';
import { consumeRecurringExpenseActionIntent } from '../../finance/recurringExpenseIntent.js';
import { consumeIncomeReceiptIntent } from '../../finance/incomeReceiptIntent.js';
import { IncomeLedgerScreen } from './IncomeLedgerScreen.js';
import { RecurringExpenseAction } from './RecurringExpenseAction.js';
import { RecurringExpenseManagement } from './RecurringExpenseManagement.js';
import { RecurringExpenseCommitmentCenter } from './RecurringExpenseCommitmentCenter.js';
import { DirectExpensePaymentAction } from './DirectExpensePaymentAction.js';
import { ExternalExpensePaymentAction } from './ExternalExpensePaymentAction.js';
import { PartialDirectRefundAction } from './PartialDirectRefundAction.js';
import { CardRefundAction } from './CardRefundAction.js';
import { PostPaymentCardRefundAction } from './PostPaymentCardRefundAction.js';
import { ExpenseRoleCorrectionAction } from './ExpenseRoleCorrectionAction.js';

export function TransactionsScreen({ mode }: { mode: TransactionKind }) {
  const recurringIntent = useMemo(() => mode === 'expense' ? consumeRecurringExpenseActionIntent() : null, [mode]);
  const incomeIntent = useMemo(() => mode === 'income' ? consumeIncomeReceiptIntent() : null, [mode]);
  if (mode === 'income') return <IncomeLedgerScreen initialMoneyMovementId={incomeIntent?.moneyMovementId} />;
  return <div className="space-y-4">
    <RecurringExpenseCommitmentCenter initialIntent={recurringIntent} />
    <DirectExpensePaymentAction />
    <ExternalExpensePaymentAction />
    <PartialDirectRefundAction />
    <CardRefundAction />
    <PostPaymentCardRefundAction />
    <ExpenseRoleCorrectionAction />
    <RecurringExpenseAction />
    <RecurringExpenseManagement />
    <HouseholdTransactionsSetup embedded mode={mode} />
  </div>;
}
