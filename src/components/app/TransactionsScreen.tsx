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
import { RecurringExpenseManagement } from './RecurringExpenseManagement.js';
import { DirectExpensePaymentAction } from './DirectExpensePaymentAction.js';
import { ExternalExpensePaymentAction } from './ExternalExpensePaymentAction.js';
import { PartialDirectRefundAction } from './PartialDirectRefundAction.js';
import { CardRefundAction } from './CardRefundAction.js';
import { PostPaymentCardRefundAction } from './PostPaymentCardRefundAction.js';
import { ExpenseRoleCorrectionAction } from './ExpenseRoleCorrectionAction.js';
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
  const [detailActionsOpen,setDetailActionsOpen]=useState(false);
  const [recurringManagementOpen,setRecurringManagementOpen]=useState(false);

  if (mode === 'income') return <ScreenErrorBoundary screenName="suas entradas"><IncomeLedgerScreen perspective={perspective} onPerspectiveChange={onPerspectiveChange} initialMoneyMovementId={incomeIntent?.moneyMovementId} initialReviewMoneyMovementId={projectionIncomeIntent?.moneyMovementId} createRequestId={createRequestId} /></ScreenErrorBoundary>;

  return <div className="space-y-4">
    <NewExpenseWizard openRequestId={createRequestId} onSaved={() => { setExpenseSaved(true); setExpenseListVersion((value) => value + 1); }} />
    {expenseSaved && <p role="status" className="rounded-xl border border-emerald-900 bg-emerald-950/30 p-3 text-sm text-emerald-200">Despesa registrada. O Casa atualizou o fato econômico e os efeitos financeiros correspondentes.</p>}

    {projectionExpenseIntent && <ForecastExpenseReviewCard commitmentKey={projectionExpenseIntent?.commitmentKey} />}
    {recurringIntent && <RecurringExpenseCommitmentCenter initialIntent={recurringIntent} />}
    {directExpenseIntent && <DirectExpensePaymentAction initialTransactionId={directExpenseIntent?.transactionId} />}

    <ExpenseMonthBrowser perspective={perspective} onPerspectiveChange={onPerspectiveChange} refreshKey={expenseListVersion} onOpenTransaction={(transactionId)=>{setDetailTransactionId(transactionId);setDetailActionsOpen(false)}} />
    <details className="rounded-2xl bg-slate-900/45 p-3" onToggle={event=>setRecurringManagementOpen(event.currentTarget.open)}>
      <summary className="min-h-11 cursor-pointer list-none py-2 text-sm font-bold text-slate-300">Recorrências<span className="mt-1 block text-xs font-normal text-slate-500">Veja ou altere gastos que se repetem.</span></summary>
      {recurringManagementOpen&&<div className="mt-3 border-t border-slate-800 pt-4"><RecurringExpenseManagement onChanged={()=>setExpenseListVersion(value=>value+1)}/></div>}
    </details>
    {detailTransactionId&&<div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center"><section role="dialog" aria-modal="true" aria-label="Detalhe do gasto" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-slate-900 p-4 shadow-2xl"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-rose-300">Detalhe do gasto</p><p className="text-sm text-slate-500">Histórico, correções e ações especiais ficam ligados a este lançamento.</p></div><button type="button" aria-label="Fechar detalhe do gasto" onClick={()=>{setDetailTransactionId(null);setDetailActionsOpen(false)}} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-800 text-slate-300"><X className="h-5 w-5"/></button></div><HouseholdTransactionsSetup embedded mode="expense" focusTransactionId={detailTransactionId}/><details className="mt-4 rounded-2xl bg-slate-950/45 p-3" onToggle={event=>setDetailActionsOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer list-none py-2 text-sm font-bold text-slate-300">Outras ações deste gasto<span className="mt-1 block text-xs font-normal text-slate-500">Pagamento por terceiro, devoluções e correção de comprador/responsabilidade.</span></summary>{detailActionsOpen&&<div className="mt-3 space-y-4 border-t border-slate-800 pt-4"><ExternalExpensePaymentAction initialTransactionId={detailTransactionId}/><PartialDirectRefundAction initialTransactionId={detailTransactionId}/><CardRefundAction initialTransactionId={detailTransactionId}/><PostPaymentCardRefundAction initialTransactionId={detailTransactionId}/><ExpenseRoleCorrectionAction initialTransactionId={detailTransactionId}/></div>}</details></section></div>}
  </div>;
}
