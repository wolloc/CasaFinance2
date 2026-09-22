import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { HouseholdTransactionsSetup } from '../auth/HouseholdTransactionsSetup.js';
import type { TransactionKind } from '../../finance/householdTransactions.js';
import { consumeRecurringExpenseActionIntent } from '../../finance/recurringExpenseIntent.js';
import { consumeProjectionExpenseReviewIntent } from '../../finance/projectionExpenseReviewIntent.js';
import { consumeIncomeReceiptIntent } from '../../finance/incomeReceiptIntent.js';
import { consumeProjectionIncomeReviewIntent } from '../../finance/projectionIncomeReviewIntent.js';
import { consumeDirectExpensePaymentIntent } from '../../finance/directExpensePaymentIntent.js';
import { IncomeLedgerScreen } from './IncomeLedgerScreen.js';
import { ForecastExpenseReviewCard } from './ForecastExpenseReviewCard.js';
import { RecurringExpenseCommitmentCenter } from './RecurringExpenseCommitmentCenter.js';
import { DirectExpensePaymentAction } from './DirectExpensePaymentAction.js';
import { ExpenseMonthBrowser } from './ExpenseMonthBrowser.js';
import { NewExpenseWizard } from './NewExpenseWizard.js';
import { ScreenErrorBoundary } from './ScreenErrorBoundary.js';
import type { FinancialPerspective } from './FinancialPerspectiveSelector.js';

export function TransactionsScreen({ mode, perspective, onPerspectiveChange, createRequestId = 0 }: { mode: TransactionKind; perspective: FinancialPerspective; onPerspectiveChange: (value: FinancialPerspective)=>void; createRequestId?: number; onGrantLoan?:()=>void }) {
  const recurringIntent = useMemo(() => mode === 'expense' ? consumeRecurringExpenseActionIntent() : null, [mode]);
  const projectionExpenseIntent = useMemo(() => mode === 'expense' ? consumeProjectionExpenseReviewIntent() : null, [mode]);
  const directExpenseIntent = useMemo(() => mode === 'expense' ? consumeDirectExpensePaymentIntent() : null, [mode]);
  const incomeIntent = useMemo(() => mode === 'income' ? consumeIncomeReceiptIntent() : null, [mode]);
  const projectionIncomeIntent = useMemo(() => mode === 'income' ? consumeProjectionIncomeReviewIntent() : null, [mode]);
  const [expenseListVersion, setExpenseListVersion] = useState(0);
  const [expenseSaved, setExpenseSaved] = useState(false);
  const [detailTransactionId,setDetailTransactionId]=useState<string|null>(null);

  if (mode === 'income') return <ScreenErrorBoundary screenName="suas entradas"><IncomeLedgerScreen perspective={perspective} onPerspectiveChange={onPerspectiveChange} initialMoneyMovementId={incomeIntent?.moneyMovementId} initialReviewMoneyMovementId={projectionIncomeIntent?.moneyMovementId} /></ScreenErrorBoundary>;

  return <div className="space-y-4">
    <NewExpenseWizard openRequestId={createRequestId} onSaved={() => { setExpenseSaved(true); setExpenseListVersion((value) => value + 1); }} />
    {expenseSaved && <p role="status" className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-200">Despesa registrada. O Casa atualizou o fato econômico e os efeitos financeiros correspondentes.</p>}

    {projectionExpenseIntent && <ForecastExpenseReviewCard commitmentKey={projectionExpenseIntent?.commitmentKey} />}
    {recurringIntent && <RecurringExpenseCommitmentCenter initialIntent={recurringIntent} />}
    {directExpenseIntent && <DirectExpensePaymentAction initialTransactionId={directExpenseIntent?.transactionId} />}

    <ExpenseMonthBrowser perspective={perspective} onPerspectiveChange={onPerspectiveChange} refreshKey={expenseListVersion} onOpenTransaction={setDetailTransactionId} />
    {detailTransactionId&&<div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center"><section role="dialog" aria-modal="true" aria-label="Detalhe do gasto" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-slate-900 p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-rose-300">Detalhe do gasto</p><p className="text-sm text-slate-500">Histórico e correções ficam ligados a este lançamento.</p></div><button type="button" aria-label="Fechar detalhe do gasto" onClick={()=>setDetailTransactionId(null)} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-800 text-slate-300"><X className="h-5 w-5"/></button></div><HouseholdTransactionsSetup embedded mode="expense" focusTransactionId={detailTransactionId}/></section></div>}
  </div>;
}
