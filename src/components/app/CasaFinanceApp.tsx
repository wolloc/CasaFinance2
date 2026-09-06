import { useState } from 'react';
import { ArrowLeft, CreditCard, Home, Receipt, Settings, TrendingUp } from 'lucide-react';
import { CasaHomeScreen } from './CasaHomeScreen.js';
import { TransactionsScreen } from './TransactionsScreen.js';
import { InvoicesScreen } from './InvoicesScreen.js';
import { SettingsScreen } from './SettingsScreen.js';
import { GlobalActions } from './GlobalActions.js';
import { NewAdjustmentScreen } from './NewAdjustmentScreen.js';
import { setCoverageActionIntent, type CoverageActionKind } from '../../finance/coverageActionIntent.js';

type Screen = 'home' | 'expenses' | 'income' | 'settings' | 'invoices' | 'new-adjustment';
type PrimaryTab = 'home' | 'expenses' | 'income' | 'settings';

const tabs = [['home','Casa',Home],['expenses','Gastos',Receipt],['income','Entradas',TrendingUp],['settings','Ajustes',Settings]] as const;

export function CasaFinanceApp(){
 const[screen,setScreen]=useState<Screen>('home');const[returnTab,setReturnTab]=useState<PrimaryTab>('home');const activeTab:PrimaryTab=screen==='invoices'?'home':screen==='new-adjustment'?returnTab:screen;
 const openAdjustment=()=>{setReturnTab(activeTab);setScreen('new-adjustment');};
 const openCoverageAction=(kind:CoverageActionKind,suggestedAmount:number)=>{setCoverageActionIntent({kind,suggestedAmount});setReturnTab('home');setScreen('new-adjustment');};
 return <main className="min-h-[100dvh] bg-slate-950 text-slate-100"><div className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col"><div className="flex-1 overflow-y-auto px-4 pb-44 pt-6 sm:px-6">
 {screen==='home'&&<><div className="mb-4 flex justify-end"><button type="button" onClick={()=>setScreen('invoices')} className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 text-xs font-semibold text-slate-300"><CreditCard className="h-4 w-4"/>Faturas</button></div><CasaHomeScreen onCoverageAction={openCoverageAction}/></>}
 {screen==='expenses'&&<TransactionsScreen mode="expense"/>}{screen==='income'&&<TransactionsScreen mode="income"/>}{screen==='settings'&&<SettingsScreen/>}
 {screen==='invoices'&&<><button type="button" onClick={()=>setScreen('home')} className="mb-4 flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-300"><ArrowLeft className="h-4 w-4"/>Voltar para Casa</button><InvoicesScreen/></>}
 {screen==='new-adjustment'&&<><button type="button" onClick={()=>setScreen(returnTab)} className="mb-4 flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-300"><ArrowLeft className="h-4 w-4"/>Voltar</button><NewAdjustmentScreen/></>}
 </div><GlobalActions onExpense={()=>setScreen('expenses')} onIncome={()=>setScreen('income')} onAdjustment={openAdjustment}/><nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-2xl border-t border-slate-800 bg-slate-900/95 px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur"><div className="grid grid-cols-4">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>setScreen(id)} aria-current={activeTab===id?'page':undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${activeTab===id?'text-blue-400':'text-slate-400'}`}><Icon className="h-5 w-5"/>{label}</button>)}</div></nav></div></main>;
}
