import { useEffect, useMemo, useState } from 'react';
import { HouseholdTransactionsSetup } from '../auth/HouseholdTransactionsSetup.js';
import type { HouseholdTransaction, TransactionKind } from '../../finance/householdTransactions.js';
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
import { CardPaymentInstrumentCorrectionAction } from './CardPaymentInstrumentCorrectionAction.js';
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
  const [detailRecurringOpen,setDetailRecurringOpen]=useState(false);
  const [detailSpecialAction,setDetailSpecialAction]=useState<'card_refund'|'post_payment_refund'|'direct_refund'|'external_payment'|null>(null);
  const [detailTransaction,setDetailTransaction]=useState<HouseholdTransaction|null>(null);
  useEffect(()=>{if(!expenseSaved)return;const timer=window.setTimeout(()=>setExpenseSaved(false),3500);return()=>window.clearTimeout(timer);},[expenseSaved]);

  if (mode === 'income') return <ScreenErrorBoundary screenName="suas entradas"><IncomeLedgerScreen refreshKey={refreshKey} onFinancialChange={onFinancialChange} onCreate={onCreate} perspective={perspective} onPerspectiveChange={onPerspectiveChange} initialMoneyMovementId={incomeIntent?.moneyMovementId} initialReviewMoneyMovementId={projectionIncomeIntent?.moneyMovementId} createRequestId={createRequestId} /></ScreenErrorBoundary>;

  return <div className="space-y-4">
    <NewExpenseWizard openRequestId={createRequestId} onSaved={() => { setExpenseSaved(true); setExpenseListVersion((value) => value + 1); onFinancialChange?.(); }} />
    {expenseSaved && <FinancialSaveFeedback message="Despesa registrada. A lista e os efeitos financeiros foram atualizados."/>}

    {projectionExpenseIntent && <ForecastExpenseReviewCard commitmentKey={projectionExpenseIntent?.commitmentKey} />}
    {recurringIntent && <RecurringExpenseCommitmentCenter initialIntent={recurringIntent} onChanged={onFinancialChange}/>}
    {directExpenseIntent && <DirectExpensePaymentAction initialTransactionId={directExpenseIntent?.transactionId} onCompleted={onFinancialChange}/>}

    <ExpenseMonthBrowser perspective={perspective} onPerspectiveChange={onPerspectiveChange} onCreate={onCreate} refreshKey={expenseListVersion+refreshKey} onOpenTransaction={(transactionId,recurringRuleId)=>{setDetailTransactionId(transactionId);setDetailRecurringRuleId(recurringRuleId??null);setDetailRecurringOpen(false);setDetailSpecialAction(null);setDetailTransaction(null)}} />
    {detailTransactionId&&<div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center"><section role="dialog" aria-modal="true" aria-label="Detalhe do gasto" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-slate-700 bg-slate-900 p-4 shadow-2xl">
      <FinancialDetailDialogHeader tone="expense" eyebrow="Gasto" title={detailTransaction?.description ?? 'Detalhe do gasto'} subtitle="Consulte ou corrija este lançamento." onClose={()=>{setDetailTransactionId(null);setDetailRecurringRuleId(null);setDetailRecurringOpen(false);setDetailSpecialAction(null);setDetailTransaction(null)}} closeLabel="Fechar detalhe do gasto"/>
      <div className="mt-4"><HouseholdTransactionsSetup embedded mode="expense" focusTransactionId={detailTransactionId} onFocusedTransactionChange={setDetailTransaction} onChanged={()=>{setDetailTransactionId(null);setDetailRecurringRuleId(null);setDetailRecurringOpen(false);setDetailSpecialAction(null);setDetailTransaction(null);onFinancialChange?.();}}/></div>
      <div className="mt-4"><ExpenseRoleCorrectionAction initialTransactionId={detailTransactionId} onCompleted={onFinancialChange}/></div>
      <div className="mt-4"><CardPaymentInstrumentCorrectionAction initialTransactionId={detailTransactionId} onCompleted={onFinancialChange}/></div>
      {detailRecurringRuleId&&<div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/35 p-3"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recorrência</p><p className="mt-1 text-sm text-slate-300">Este gasto pertence a uma recorrência.</p></div><button type="button" onClick={()=>setDetailRecurringOpen(value=>!value)} className="min-h-10 rounded-xl border border-violet-800 px-3 text-xs font-semibold text-violet-300">{detailRecurringOpen?'Fechar':'Gerenciar'}</button></div>{detailRecurringOpen&&<div className="mt-3"><RecurringExpenseManagement focusRuleId={detailRecurringRuleId} onChanged={()=>{setExpenseListVersion(value=>value+1);onFinancialChange?.();setDetailRecurringOpen(false)}}/></div>}</div>}
      {detailTransaction&&<section className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/35 p-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ações especiais</p><p className="mt-1 text-xs text-slate-500">Use somente quando algo excepcional aconteceu com este gasto.</p></div><div className="mt-3 grid gap-2 sm:grid-cols-2">
        {detailTransaction.payment_instrument?.kind==='card' && (Boolean(detailTransaction.invoice_id) || detailTransaction.mutation_dependencies.has_installment_plan) && !detailTransaction.mutation_dependencies.has_funding_event && !detailTransaction.mutation_dependencies.has_external_payment_event && !detailTransaction.mutation_dependencies.has_financial_obligation && <button type="button" onClick={()=>setDetailSpecialAction(value=>value==='card_refund'?null:'card_refund')} className="min-h-11 rounded-xl border border-violet-800 bg-violet-950/20 px-3 text-left text-sm font-semibold text-violet-200">Devolução no cartão<span className="mt-1 block text-xs font-normal text-slate-500">Crédito em fatura ainda não paga</span></button>}
        {detailTransaction.payment_instrument?.kind==='card' && detailTransaction.mutation_dependencies.has_funding_event && <button type="button" onClick={()=>setDetailSpecialAction(value=>value==='post_payment_refund'?null:'post_payment_refund')} className="min-h-11 rounded-xl border border-fuchsia-800 bg-fuchsia-950/20 px-3 text-left text-sm font-semibold text-fuchsia-200">Devolução após pagamento<span className="mt-1 block text-xs font-normal text-slate-500">Crédito futuro ou dinheiro de volta</span></button>}
        {detailTransaction.payment_instrument?.kind==='account' && !detailTransaction.mutation_dependencies.has_external_payment_event && <button type="button" onClick={()=>setDetailSpecialAction(value=>value==='direct_refund'?null:'direct_refund')} className="min-h-11 rounded-xl border border-emerald-800 bg-emerald-950/20 px-3 text-left text-sm font-semibold text-emerald-200">Dinheiro devolvido<span className="mt-1 block text-xs font-normal text-slate-500">A compra foi paga e parte do valor voltou</span></button>}
        {!detailTransaction.mutation_dependencies.has_external_payment_event && detailTransaction.payment_instrument?.kind==='account' && <button type="button" onClick={()=>setDetailSpecialAction(value=>value==='external_payment'?null:'external_payment')} className="min-h-11 rounded-xl border border-amber-800 bg-amber-950/20 px-3 text-left text-sm font-semibold text-amber-200">Outra pessoa pagou<span className="mt-1 block text-xs font-normal text-slate-500">Presente ou reembolso a terceiro</span></button>}
      </div>
      {detailSpecialAction==='card_refund'&&<div className="mt-3"><ScreenErrorBoundary screenName="devolução no cartão"><CardRefundAction initialTransactionId={detailTransactionId} onCompleted={onFinancialChange}/></ScreenErrorBoundary></div>}
      {detailSpecialAction==='post_payment_refund'&&<div className="mt-3"><ScreenErrorBoundary screenName="devolução após pagamento"><PostPaymentCardRefundAction initialTransactionId={detailTransactionId} onCompleted={onFinancialChange}/></ScreenErrorBoundary></div>}
      {detailSpecialAction==='direct_refund'&&<div className="mt-3"><ScreenErrorBoundary screenName="devolução de gasto"><PartialDirectRefundAction initialTransactionId={detailTransactionId} onCompleted={onFinancialChange}/></ScreenErrorBoundary></div>}
      {detailSpecialAction==='external_payment'&&<div className="mt-3"><ScreenErrorBoundary screenName="pagamento por outra pessoa"><ExternalExpensePaymentAction initialTransactionId={detailTransactionId} onCompleted={onFinancialChange}/></ScreenErrorBoundary></div>}
      </section>}
    </section></div>}
  </div>;
}
