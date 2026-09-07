import { useEffect, useMemo, useState } from 'react';
import { Banknote, Receipt } from 'lucide-react';
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

export function TransactionsScreen({ mode, createRequestId = 0, onGrantLoan }: { mode: TransactionKind; createRequestId?: number; onGrantLoan?:()=>void }) {
  const recurringIntent = useMemo(() => mode === 'expense' ? consumeRecurringExpenseActionIntent() : null, [mode]);
  const projectionExpenseIntent = useMemo(() => mode === 'expense' ? consumeProjectionExpenseReviewIntent() : null, [mode]);
  const directExpenseIntent = useMemo(() => mode === 'expense' ? consumeDirectExpensePaymentIntent() : null, [mode]);
  const incomeIntent = useMemo(() => mode === 'income' ? consumeIncomeReceiptIntent() : null, [mode]);
  const projectionIncomeIntent = useMemo(() => mode === 'income' ? consumeProjectionIncomeReviewIntent() : null, [mode]);
  const[handledCreateRequestId,setHandledCreateRequestId]=useState(0);const[showNature,setShowNature]=useState(false);const[expenseFormRequestId,setExpenseFormRequestId]=useState(0);
  useEffect(()=>{if(mode==='expense'&&createRequestId>0&&createRequestId!==handledCreateRequestId){setHandledCreateRequestId(createRequestId);setShowNature(true);}},[mode,createRequestId,handledCreateRequestId]);
  if (mode === 'income') return <IncomeLedgerScreen initialMoneyMovementId={incomeIntent?.moneyMovementId} initialReviewMoneyMovementId={projectionIncomeIntent?.moneyMovementId} />;
  const chooseExpense=()=>{setShowNature(false);setExpenseFormRequestId(value=>value+1);};
  const chooseLoan=()=>{setShowNature(false);onGrantLoan?.();};
  return <div className="space-y-4">
    {showNature&&<section role="dialog" aria-label="Natureza do acontecimento" className="rounded-2xl border border-blue-800 bg-blue-950/30 p-4"><h2 className="font-bold">O que aconteceu?</h2><p className="mt-1 text-sm text-slate-400">Escolha antes de registrar para o Casa não confundir dinheiro que vai voltar com um gasto.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" onClick={chooseExpense} className="min-h-14 rounded-xl border border-rose-800 bg-rose-950/30 px-3 text-left"><Receipt className="mr-2 inline h-4 w-4 text-rose-300"/><strong>Foi um gasto</strong><span className="mt-1 block text-xs text-slate-500">Algo foi consumido ou comprado pela Casa.</span></button><button type="button" onClick={chooseLoan} className="min-h-14 rounded-xl border border-cyan-800 bg-cyan-950/30 px-3 text-left"><Banknote className="mr-2 inline h-4 w-4 text-cyan-300"/><strong>Emprestei dinheiro — vão me devolver</strong><span className="mt-1 block text-xs text-slate-500">O dinheiro saiu, mas vira valor a receber; não é despesa.</span></button></div><button type="button" onClick={()=>setShowNature(false)} className="mt-3 text-xs font-semibold text-slate-400">Cancelar</button></section>}
    {projectionExpenseIntent && <ForecastExpenseReviewCard commitmentKey={projectionExpenseIntent?.commitmentKey} />}
    {recurringIntent && <RecurringExpenseCommitmentCenter initialIntent={recurringIntent} />}
    {directExpenseIntent && <DirectExpensePaymentAction initialTransactionId={directExpenseIntent?.transactionId} />}

    <ExpenseMonthBrowser />
    <HouseholdTransactionsSetup embedded mode={mode} createRequestId={expenseFormRequestId} />
    <p className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500">Se o dinheiro saiu porque você emprestou para alguém e espera receber de volta, use a ação global <strong className="text-slate-300">Nova despesa</strong> e escolha “Emprestei dinheiro — vão me devolver”. Não cadastre isso como gasto.</p>

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
