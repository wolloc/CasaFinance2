import { useEffect, useMemo, useState } from 'react';
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
import { FinancialSaveFeedback } from './FinancialSaveFeedback.js';
import type { FinancialPerspective } from './FinancialPerspectiveSelector.js';
import { FinancialDetailDialogHeader } from './FinancialDetailDialogHeader.js';

export function TransactionsScreen({ mode, perspective, onPerspectiveChange, createRequestId = 0, refreshKey = 0, onFinancialChange, onCreate }: { mode: TransactionKind; perspective: FinancialPerspective; onPerspectiveChange: (value: FinancialPerspective)=>void; createRequestId?: number; refreshKey?: number; onFinancialChange?:()=>void; onCreate?:()=>void }) {
  const recurringIntent = useMemo(() => mode === 'expense' ? consumeRecurringExpenseActionIntent() : null, [mode]);
  const projectionExpenseIntent = useMemo(() => mode === 'expense' ? consumeProjectionExpenseReviewIntent() : null, [mode]);
  const directExpenseIntent = useMemo(() => mode === 'expense' ? consumeDirectExpensePaymentIntent() : null, [mode]);
  const incomeIntent = useMemo(() => mode === 'income' ? consumeIncomeReceiptIntent() : null, [mode]);
  const projectionIncomeIntent = useMemo(() => mode === 'income' ? consumeProjectionIncomeReviewIntent() : null, [mode]);
  const [expenseListVersion, setExpenseListVersion] = useState(0);
  const [expenseSaved, setExpenseSaved] = useState(false);
  const [detailTransactionId,setDetailTransactionId]=useState<string|null>(null);
  const [detailRecurringRuleId,setDetailRecurringRuleId]=useState<string|null>(null);
  const [detailActionsOpen,setDetailActionsOpen]=useState(false);
  const [detailRecurringOpen,setDetailRecurringOpen]=useState(false);
  useEffect(()=>{if(!expenseSaved)return;const timer=window.setTimeout(()=>setExpenseSaved(false),3500);return()=>window.clearTimeout(timer);},[expenseSaved]);

  if (mode === 'income') return <ScreenErrorBoundary screenName="suas entradas"><IncomeLedgerScreen refreshKey={refreshKey} onFinancialChange={onFinancialChange} onCreate={onCreate} perspective={perspective} onPerspectiveChange={onPerspectiveChange} initialMoneyMovementId={incomeIntent?.moneyMovementId} initialReviewMoneyMovementId={projectionIncomeIntent?.moneyMovementId} createRequestId={createRequestId} /></ScreenErrorBoundary>;

  return <div className="space-y-4">
    <NewExpenseWizard openRequestId={createRequestId} onSaved={() => { setExpenseSaved(true); setExpenseListVersion((value) => value + 1); onFinancialChange?.(); }} />
    {expenseSaved && <FinancialSaveFeedback message="Despesa registrada. A lista e os efeitos financeiros foram atualizados."/>}

    {projectionExpenseIntent && <ForecastExpenseReviewCard commitmentKey={projectionExpenseIntent?.commitmentKey} />}
    {recurringIntent && <RecurringExpenseCommitmentCenter initialIntent={recurringIntent} onChanged={onFinancialChange}/>}
    {directExpenseIntent && <DirectExpensePaymentAction initialTransactionId={directExpenseIntent?.transactionId} onCompleted={onFinancialChange}/>}

    <ExpenseMonthBrowser perspective={perspective} onPerspectiveChange={onPerspectiveChange} onCreate={onCreate} refreshKey={expenseListVersion+refreshKey} onOpenTransaction={(transactionId,recurringRuleId)=>{setDetailTransactionId(transactionId);setDetailRecurringRuleId(recurringRuleId??null);setDetailActionsOpen(false);setDetailRecurringOpen(false)}} />
    {detailTransactionId&&<div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center"><section role="dialog" aria-modal="true" aria-label="Detalhe do gasto" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-slate-900 p-4 shadow-2xl"><FinancialDetailDialogHeader tone="expense" eyebrow="Gasto" title="Detalhe do gasto" subtitle="Ajuste o compromisso ou consulte outros detalhes quando precisar." onClose={()=>{setDetailTransactionId(null);setDetailRecurringRuleId(null);setDetailActionsOpen(false);setDetailRecurringOpen(false)}} closeLabel="Fechar detalhe do gasto"/><details className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 py-3 text-sm font-semibold text-slate-300">Outros detalhes do lançamento<span className="text-xs text-slate-500">categoria e histórico</span></summary><div className="border-t border-slate-800 p-3"><HouseholdTransactionsSetup embedded mode="expense" focusTransactionId={detailTransactionId}/></div></details><div className="mt-4"><ExpenseRoleCorrectionAction initialTransactionId={detailTransactionId} onCompleted={onFinancialChange}/></div>{detailRecurringRuleId&&<div className="mt-4"><button type="button" onClick={()=>setDetailRecurringOpen(value=>!value)} className="min-h-11 w-full rounded-xl border border-violet-900 bg-violet-950/20 px-3 text-sm font-bold text-violet-300">{detailRecurringOpen?'Fechar recorrência':'Gerenciar esta recorrência'}</button>{detailRecurringOpen&&<div className="mt-3"><RecurringExpenseManagement focusRuleId={detailRecurringRuleId} onChanged={()=>{setExpenseListVersion(value=>value+1);onFinancialChange?.();setDetailRecurringOpen(false)}}/></div>}</div>}<details className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/45" onToggle={event=>setDetailActionsOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer list-none px-3 py-3 text-sm font-semibold text-slate-300">Outras ações<span className="mt-1 block text-xs font-normal text-slate-500">Devoluções e pagamentos excepcionais.</span></summary>{detailActionsOpen&&<div className="space-y-4 border-t border-slate-800 p-3"><ExternalExpensePaymentAction initialTransactionId={detailTransactionId} onCompleted={onFinancialChange}/><PartialDirectRefundAction initialTransactionId={detailTransactionId} onCompleted={onFinancialChange}/><CardRefundAction initialTransactionId={detailTransactionId} onCompleted={onFinancialChange}/><PostPaymentCardRefundAction initialTransactionId={detailTransactionId} onCompleted={onFinancialChange}/></div>}</details></section></div>}
  </div>;
}
