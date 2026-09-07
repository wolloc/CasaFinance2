import { useState } from 'react';
import { ArrowLeft, CreditCard, Home, Receipt, Settings, TrendingUp } from 'lucide-react';
import { CasaHomeScreen } from './CasaHomeScreen.js';
import { TransactionsScreen } from './TransactionsScreen.js';
import { InvoicesScreen } from './InvoicesScreen.js';
import { SettingsScreen } from './SettingsScreen.js';
import { CoverageReviewScreen } from './CoverageReviewScreen.js';
import { GlobalActions } from './GlobalActions.js';
import { NewAdjustmentScreen } from './NewAdjustmentScreen.js';
import { useSupabaseAuth } from '../../context/SupabaseAuthContext.js';
import { supabase } from '../../lib/supabase.js';
import { setCoverageActionIntent, type CoverageActionKind } from '../../finance/coverageActionIntent.js';
import { setSettlementActionIntent, type SettlementActionIntent } from '../../finance/settlementActionIntent.js';
import { setInvoicePaymentIntent } from '../../finance/invoicePaymentIntent.js';
import { setInvoiceReviewIntent } from '../../finance/invoiceReviewIntent.js';
import { setProjectionInvoiceReviewIntent } from '../../finance/projectionInvoiceReviewIntent.js';
import { setCardReviewIntent } from '../../finance/cardReviewIntent.js';
import { setAccountReviewIntent } from '../../finance/accountReviewIntent.js';
import { setRecurringExpenseActionIntent } from '../../finance/recurringExpenseIntent.js';
import { setProjectionExpenseReviewIntent } from '../../finance/projectionExpenseReviewIntent.js';
import { setDirectExpensePaymentIntent } from '../../finance/directExpensePaymentIntent.js';
import { setIncomeReceiptIntent } from '../../finance/incomeReceiptIntent.js';
import { setProjectionIncomeReviewIntent } from '../../finance/projectionIncomeReviewIntent.js';
import { getScheduledMemberSettlementContext } from '../../finance/memberSettlements.js';
import { getOverdueCommitmentContext } from '../../finance/overdueCommitments.js';
import type { FinancialInvoice } from '../../finance/financialInvoices.js';
import type { AttentionNavigationAction } from './FinancialPriorityCenter.js';

type Screen = 'home' | 'expenses' | 'income' | 'settings' | 'invoices' | 'new-adjustment' | 'coverage-review';
type PrimaryTab = 'home' | 'expenses' | 'income' | 'settings';
const tabs = [['home','Casa',Home],['expenses','Gastos',Receipt],['income','Entradas',TrendingUp],['settings','Ajustes',Settings]] as const;

export function CasaFinanceApp(){
 const{household}=useSupabaseAuth();const[screen,setScreen]=useState<Screen>('home');const[returnTab,setReturnTab]=useState<PrimaryTab>('home');const[coverageReviewAmount,setCoverageReviewAmount]=useState(0);const activeTab:PrimaryTab=screen==='invoices'||screen==='coverage-review'?'home':screen==='new-adjustment'?returnTab:screen;
 const openAdjustment=()=>{setReturnTab(activeTab);setScreen('new-adjustment');};
 const openCoverageAction=(kind:CoverageActionKind,suggestedAmount:number)=>{setCoverageActionIntent({kind,suggestedAmount});setReturnTab('home');setScreen('new-adjustment');};
 const openSettlementAction=(intent:SettlementActionIntent)=>{setSettlementActionIntent(intent);setReturnTab('home');setScreen('new-adjustment');};
 const openInvoicePaymentIntent=(invoiceId:string,suggestedAmount:number)=>{setInvoicePaymentIntent({invoiceId,suggestedAmount});setReturnTab('home');setScreen('new-adjustment');};
 const openInvoicePayment=(invoice:FinancialInvoice)=>openInvoicePaymentIntent(invoice.invoice_id,Number(invoice.outstanding_amount));
 const openAttentionAction=async(action:AttentionNavigationAction)=>{if(action.kind==='recurring-expense'){setRecurringExpenseActionIntent({occurrenceId:action.occurrenceId,mode:'pay'});setScreen('expenses');return;}if(action.kind==='projection-recurring-review'){setRecurringExpenseActionIntent({occurrenceId:action.occurrenceId,mode:'confirm'});setScreen('expenses');return;}if(action.kind==='projection-expense-review'){setProjectionExpenseReviewIntent({commitmentKey:action.commitmentKey});setScreen('expenses');return;}if(action.kind==='overdue-commitment'){if(!supabase||!household)return;try{const context=await getOverdueCommitmentContext(supabase,household.id,action.commitmentKey);if(context?.kind==='recurring-expense')setRecurringExpenseActionIntent({occurrenceId:context.occurrenceId,mode:'pay'});else if(context?.kind==='direct-expense')setDirectExpensePaymentIntent({transactionId:context.transactionId});else return;setScreen('expenses');}catch{return;}return;}if(action.kind==='income-receipt'){setIncomeReceiptIntent({moneyMovementId:action.moneyMovementId});setScreen('income');return;}if(action.kind==='projection-income-review'){setProjectionIncomeReviewIntent({moneyMovementId:action.moneyMovementId});setScreen('income');return;}if(action.kind==='invoice-payment'){openInvoicePaymentIntent(action.invoiceId,action.amount);return;}if(action.kind==='invoice-coverage-risk'){setInvoiceReviewIntent({invoiceId:action.invoiceId});setScreen('invoices');return;}if(action.kind==='projection-invoice-review'){setProjectionInvoiceReviewIntent({invoiceId:action.invoiceId});setScreen('invoices');return;}if(action.kind==='card-over-limit'){setCardReviewIntent({cardId:action.cardId});setScreen('invoices');return;}if(action.kind==='overdraft-account'){setAccountReviewIntent({accountId:action.accountId});setScreen('settings');return;}if(action.kind==='negative-projection'){setCoverageReviewAmount(action.amount);setScreen('coverage-review');return;}if(action.kind==='member-settlement-schedule'){if(!supabase||!household)return;const context=await getScheduledMemberSettlementContext(supabase,household.id,action.scheduleId);if(context)openSettlementAction({kind:'members',debtorMemberId:context.payerMemberId,creditorMemberId:context.receiverMemberId,amount:context.amount});return;}if(action.kind==='third-party-obligation'){openSettlementAction({kind:'third-party',obligationId:action.obligationId,amount:action.amount});return;}if(action.kind==='navigate'){if(action.destination==='expenses')setScreen('expenses');else if(action.destination==='invoices')setScreen('invoices');else if(action.destination==='income')setScreen('income');}};
 return <main className="min-h-[100dvh] bg-slate-950 text-slate-100"><div className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col"><div className="flex-1 overflow-y-auto px-4 pb-44 pt-6 sm:px-6">
 {screen==='home'&&<><div className="mb-4 flex justify-end"><button type="button" onClick={()=>setScreen('invoices')} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-semibold text-slate-300"><CreditCard className="h-4 w-4"/>Faturas</button></div><CasaHomeScreen onCoverageAction={openCoverageAction} onAttentionAction={openAttentionAction} onSettlementAction={openSettlementAction}/></>}
 {screen==='expenses'&&<TransactionsScreen mode="expense"/>}{screen==='income'&&<TransactionsScreen mode="income"/>}{screen==='settings'&&<SettingsScreen/>}
 {screen==='invoices'&&<><button type="button" onClick={()=>setScreen('home')} className="mb-4 flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-300"><ArrowLeft className="h-4 w-4"/>Voltar para Casa</button><InvoicesScreen onPay={openInvoicePayment}/></>}
 {screen==='coverage-review'&&<><button type="button" onClick={()=>setScreen('home')} className="mb-4 flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-300"><ArrowLeft className="h-4 w-4"/>Voltar para Casa</button><CoverageReviewScreen suggestedAmount={coverageReviewAmount} onChoose={openCoverageAction}/></>}
 {screen==='new-adjustment'&&<><button type="button" onClick={()=>setScreen(returnTab)} className="mb-4 flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-300"><ArrowLeft className="h-4 w-4"/>Voltar</button><NewAdjustmentScreen/></>}
 </div><GlobalActions onExpense={()=>setScreen('expenses')} onIncome={()=>setScreen('income')} onAdjustment={openAdjustment}/><nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl border-t border-slate-800 bg-slate-900/95 px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"><div className="grid grid-cols-4">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>setScreen(id)} aria-current={activeTab===id?'page':undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${activeTab===id?'text-blue-400':'text-slate-400'}`}><Icon className="h-5 w-5"/>{label}</button>)}</div></nav></div></main>;
}
