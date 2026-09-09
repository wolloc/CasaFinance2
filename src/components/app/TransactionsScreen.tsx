import { useMemo, useState } from 'react';
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
import { NewExpenseWizard } from './NewExpenseWizard.js';

export function TransactionsScreen({ mode, createRequestId = 0 }: { mode: TransactionKind; createRequestId?: number; onGrantLoan?:()=>void }) {
  const recurringIntent = useMemo(() => mode === 'expense' ? consumeRecurringExpenseActionIntent() : null, [mode]);
  const projectionExpenseIntent = useMemo(() => mode === 'expense' ? consumeProjectionExpenseReviewIntent() : null, [mode]);
  const directExpenseIntent = useMemo(() => mode === 'expense' ? consumeDirectExpensePaymentIntent() : null, [mode]);
  const incomeIntent = useMemo(() => mode === 'income' ? consumeIncomeReceiptIntent() : null, [mode]);
  const projectionIncomeIntent = useMemo(() => mode === 'income' ? consumeProjectionIncomeReviewIntent() : null, [mode]);
  const [expenseListVersion, setExpenseListVersion] = useState(0);
  const [expenseSaved, setExpenseSaved] = useState(false);

  if (mode === 'income') return <IncomeLedgerScreen initialMoneyMovementId={incomeIntent?.moneyMovementId} initialReviewMoneyMovementId={projectionIncomeIntent?.moneyMovementId} />;

  return <div className="space-y-4">
    <NewExpenseWizard openRequestId={createRequestId} onSaved={() => { setExpenseSaved(true); setExpenseListVersion((value) => value + 1); }} />
    {expenseSaved && <p role="status" className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-200">Despesa registrada. O Casa atualizou o fato econômico e os efeitos financeiros correspondentes.</p>}

    {projectionExpenseIntent && <ForecastExpenseReviewCard commitmentKey={projectionExpenseIntent?.commitmentKey} />}
    {recurringIntent && <RecurringExpenseCommitmentCenter initialIntent={recurringIntent} />}
    {directExpenseIntent && <DirectExpensePaymentAction initialTransactionId={directExpenseIntent?.transactionId} />}

    <ExpenseMonthBrowser />
    <div key={expenseListVersion} className="[&_header>button]:hidden">
      <HouseholdTransactionsSetup embedded mode={mode} />
    </div>

    <details className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-slate-100">
      <summary className="cursor-pointer list-none font-semibold text-slate-200">
        Precisa fazer algo diferente?
        <span className="mt-1 block text-xs font-normal text-slate-500">As situações menos comuns ficam organizadas por tipo para não atrapalhar o registro normal de gastos.</span>
      </summary>
      <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
        <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <summary className="cursor-pointer font-semibold text-slate-200">Formas especiais de pagar</summary>
          <p className="mt-1 text-xs text-slate-500">PIX usando cartão, pagamento de gasto já registrado ou quando outra pessoa pagou.</p>
          <div className="mt-3 space-y-4 border-t border-slate-800 pt-3">
            <CardPixExpenseAction />
            {!directExpenseIntent && <DirectExpensePaymentAction />}
            <ExternalExpensePaymentAction />
          </div>
        </details>

        <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <summary className="cursor-pointer font-semibold text-slate-200">Recebeu dinheiro de volta?</summary>
          <p className="mt-1 text-xs text-slate-500">Use quando houve devolução ou estorno de uma compra já registrada.</p>
          <div className="mt-3 space-y-4 border-t border-slate-800 pt-3">
            <PartialDirectRefundAction />
            <CardRefundAction />
            <PostPaymentCardRefundAction />
          </div>
        </details>

        <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <summary className="cursor-pointer font-semibold text-slate-200">Corrigir quem participou do gasto</summary>
          <p className="mt-1 text-xs text-slate-500">Corrija papéis do lançamento sem apagar o histórico financeiro que já aconteceu.</p>
          <div className="mt-3 border-t border-slate-800 pt-3"><ExpenseRoleCorrectionAction /></div>
        </details>

        <details className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
          <summary className="cursor-pointer font-semibold text-slate-200">Gastos que se repetem</summary>
          <p className="mt-1 text-xs text-slate-500">Crie, acompanhe ou ajuste contas e gastos recorrentes.</p>
          <div className="mt-3 space-y-4 border-t border-slate-800 pt-3">
            {!recurringIntent && <RecurringExpenseCommitmentCenter initialIntent={null} />}
            <RecurringExpenseAction />
            <RecurringExpenseManagement />
          </div>
        </details>
      </div>
    </details>
  </div>;
}
