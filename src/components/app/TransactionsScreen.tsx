import { useMemo } from 'react';
import { HouseholdTransactionsSetup } from '../auth/HouseholdTransactionsSetup.js';
import type { TransactionKind } from '../../finance/householdTransactions.js';
import { consumeRecurringExpenseActionIntent } from '../../finance/recurringExpenseIntent.js';
import { consumeProjectionExpenseReviewIntent } from '../../finance/projectionExpenseReviewIntent.js';
import { consumeIncomeReceiptIntent } from '../../finance/incomeReceiptIntent.js';
import { consumeProjectionIncomeReviewIntent } from '../../finance/projectionIncomeReviewIntent.js';
import { consumeDirectExpensePaymentIntent } from '../../finance/directExpensePaymentIntent.js';
import { IncomeLedgerScreen } from './IncomeLedgerScreen.js';
import { ForecastExpenseReviewCard } from './ForecastExpenseReviewCard.js';
import { RecurringExpenseAction } from './RecurringExpenseAction.js';
import { RecurringExpenseManagement } from './RecurringExpenseManagement.js';
import { RecurringExpenseCommitmentCenter } from './RecurringExpenseCommitmentCenter.js';
import { DirectExpensePaymentAction } from './DirectExpensePaymentAction.js';
import { ExternalExpensePaymentAction } from './ExternalExpensePaymentAction.js';
import { PartialDirectRefundAction } from './PartialDirectRefundAction.js';
import { CardRefundAction } from './CardRefundAction.js';
import { PostPaymentCardRefundAction } from './PostPaymentCardRefundAction.js';
import { ExpenseRoleCorrectionAction } from './ExpenseRoleCorrectionAction.js';
import { CardPixExpenseAction } from './CardPixExpenseAction.js';
import { ExpenseMonthBrowser } from './ExpenseMonthBrowser.js';

export function TransactionsScreen({ mode, createRequestId = 0 }: { mode: TransactionKind; createRequestId?: number }) {
  const recurringIntent = useMemo(() => mode === 'expense' ? consumeRecurringExpenseActionIntent() : null, [mode]);
  const projectionExpenseIntent = useMemo(() => mode === 'expense' ? consumeProjectionExpenseReviewIntent() : null, [mode]);
  const directExpenseIntent = useMemo(() => mode === 'expense' ? consumeDirectExpensePaymentIntent() : null, [mode]);
  const incomeIntent = useMemo(() => mode === 'income' ? consumeIncomeReceiptIntent() : null, [mode]);
  const projectionIncomeIntent = useMemo(() => mode === 'income' ? consumeProjectionIncomeReviewIntent() : null, [mode]);
  if (mode === 'income') return <IncomeLedgerScreen initialMoneyMovementId={incomeIntent?.moneyMovementId} initialReviewMoneyMovementId={projectionIncomeIntent?.moneyMovementId} />;
  return <div className="space-y-4">
    {projectionExpenseIntent && <ForecastExpenseReviewCard commitmentKey={projectionExpenseIntent?.commitmentKey} />}
    {recurringIntent && <RecurringExpenseCommitmentCenter initialIntent={recurringIntent} />}
    {directExpenseIntent && <DirectExpensePaymentAction initialTransactionId={directExpenseIntent?.transactionId} />}

    <ExpenseMonthBrowser />
    <HouseholdTransactionsSetup embedded mode={mode} createRequestId={createRequestId} />

    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-slate-100">
      <summary className="cursor-pointer list-none font-semibold text-slate-200">
        Precisa ajustar algo?
        <span className="mt-1 block text-xs font-normal text-slate-500">Estornos, pagamentos por terceiros, correções e recorrências ficam aqui para não atrapalhar o uso do dia a dia. PIX no cartão também fica nesta área especial.</span>
      </summary>
      <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
        <CardPixExpenseAction />
        {!recurringIntent && <RecurringExpenseCommitmentCenter initialIntent={null} />}
        {!directExpenseIntent && <DirectExpensePaymentAction />}
        <ExternalExpensePaymentAction />
        <PartialDirectRefundAction />
        <CardRefundAction />
        <PostPaymentCardRefundAction />
        <ExpenseRoleCorrectionAction />
        <RecurringExpenseAction />
        <RecurringExpenseManagement />
      </div>
    </details>
  </div>;
}
